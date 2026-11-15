const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/logo.svg', (req, res) => res.sendFile(path.join(__dirname, 'logo.svg')));

const waiting = [];            // ids en attente d'un partenaire
const partners = new Map();    // id -> id du partenaire
const reportCount = new Map(); // ip -> nombre de signalements reçus
const bannedUntil = new Map(); // ip -> timestamp de fin de bannissement

const REPORTS_BEFORE_BAN = 3;
const BAN_MS = 60 * 60 * 1000; // 1 heure

const ipOf = (s) =>
  (s.handshake.headers['x-forwarded-for'] || s.handshake.address || '').split(',')[0].trim();

const isBanned = (s) => (bannedUntil.get(ipOf(s)) || 0) > Date.now();

function removeFromQueue(id) {
  const i = waiting.indexOf(id);
  if (i !== -1) waiting.splice(i, 1);
}

function leave(socket) {
  removeFromQueue(socket.id);
  const pid = partners.get(socket.id);
  if (pid) {
    partners.delete(socket.id);
    partners.delete(pid);
    io.to(pid).emit('partner-left');
  }
}

function enqueue(socket) {
  removeFromQueue(socket.id);
  while (waiting.length) {
    const other = io.sockets.sockets.get(waiting.shift());
    if (!other || other.id === socket.id || !other.data.ready) continue;
    if (socket.data.blocked.has(other.id) || other.data.blocked.has(socket.id)) {
      continue;
    }
    partners.set(socket.id, other.id);
    partners.set(other.id, socket.id);
    socket.emit('matched', { initiator: true });
    other.emit('matched', { initiator: false });
    return;
  }
  waiting.push(socket.id);
  socket.emit('waiting');
}

io.on('connection', (socket) => {
  socket.data.ready = false;
  socket.data.blocked = new Set();

  socket.on('ready', ({ adult } = {}) => {
    if (!adult) return socket.emit('refused', 'Tu dois confirmer avoir 18 ans ou plus.');
    if (isBanned(socket)) return socket.emit('refused', 'Accès suspendu suite à des signalements.');
    socket.data.ready = true;
    enqueue(socket);
  });

  socket.on('next', () => {
    if (!socket.data.ready) return;
    leave(socket);
    enqueue(socket);
  });

  socket.on('stop', () => {
    socket.data.ready = false;
    leave(socket);
  });

  // Relais WebRTC (offre, réponse, candidats ICE)
  socket.on('signal', (data) => {
    const pid = partners.get(socket.id);
    if (pid) io.to(pid).emit('signal', data);
  });

  socket.on('chat', (text) => {
    const pid = partners.get(socket.id);
    if (!pid || typeof text !== 'string') return;
    const clean = text.trim().slice(0, 500);
    if (clean) io.to(pid).emit('chat', clean);
  });

  socket.on('report', () => {
    const pid = partners.get(socket.id);
    if (!pid) return;
    const target = io.sockets.sockets.get(pid);
    socket.data.blocked.add(pid); // plus jamais remis en relation avec cette personne
    if (target) {
      const ip = ipOf(target);
      const n = (reportCount.get(ip) || 0) + 1;
      reportCount.set(ip, n);
      if (n >= REPORTS_BEFORE_BAN) {
        bannedUntil.set(ip, Date.now() + BAN_MS);
        reportCount.set(ip, 0);
        target.data.ready = false;
        target.emit('refused', 'Accès suspendu suite à des signalements.');
      }
    }
    leave(socket);
    enqueue(socket);
  });

  socket.on('disconnect', () => leave(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Roma Chat sur http://localhost:${PORT}`));

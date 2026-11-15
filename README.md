# Roma Chat

Chat vidéo aléatoire en 1 contre 1 (Node.js, Socket.io, WebRTC).

## Lancer en local
    npm install
    npm start
Puis ouvre http://localhost:3000 dans deux onglets.

## Mettre en ligne
Déploie le dossier sur Render, Railway ou Fly.io (commande de démarrage : `npm start`).
Le site doit être en HTTPS pour que la caméra fonctionne.

## À prévoir avant d'ouvrir au public
- Un serveur TURN (ex. Twilio, Metered, coturn) à ajouter dans `ICE` de `index.html` : sans lui, certaines connexions mobiles échouent.
- Une modération réelle (signalements examinés, conditions d'utilisation, mentions légales).
- Une vraie vérification d'âge : la case à cocher ne suffit pas à protéger les mineurs.

## Logo
`logo.svg` : drapeau romani (bleu, vert, roue rouge à 16 rayons).

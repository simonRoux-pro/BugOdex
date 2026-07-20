# Parcours de Lecture

Application qui génère, sur un thème donné, un parcours de lecture ordonné d'au moins
10 textes, puis propose un lecteur intégré (zoom, marque-page, résumés progressifs en
marge) pour s'y former.

Ce projet est indépendant de BugOdex : dossier, dépendances et déploiement séparés,
il vit simplement dans le même dépôt.

## Fonctionnement

1. L'utilisateur donne un thème → `api/generate-parcours.js` interroge Gemini (sortie JSON
   structurée) pour construire la liste ordonnée de textes, du plus accessible au plus
   exigeant.
2. À l'ouverture d'un livre, `api/find-source.js` cherche une source lisible : d'abord sur
   Project Gutenberg, puis sur Internet Archive. Si rien n'est trouvé, l'utilisateur peut
   chercher manuellement (lien Google pré-rempli) ou coller une URL directe.
3. `api/proxy-pdf.js` relaie le fichier trouvé (contournement CORS), affiché par le lecteur
   PDF intégré (pdf.js) : zoom, navigation, marque-page automatique.
4. Les couvertures viennent de l'API Open Library.
5. Historique, progression et notes sont stockés dans `localStorage`.

## Configuration

Variable d'environnement requise : `GOOGLE_AI_KEY` (clé API Google Gemini, obtenue sur
aistudio.google.com). Voir `.env.example`.

## Déploiement sur Vercel

Ce dossier est un projet indépendant à l'intérieur du dépôt `BugOdex` : configure Vercel
pour qu'il ne build que ce sous-dossier (*Add New Project* → importe `BugOdex` →
**Root Directory** → `parcours-lecture` → variable `GOOGLE_AI_KEY` → Deploy).

## Développement local

```bash
cd parcours-lecture
npm install -g vercel
npm install
echo "GOOGLE_AI_KEY=AIza..." > .env.local
npm run dev
```

## Limites connues (lot 1)

- La recherche automatique de source ne couvre que Project Gutenberg et Internet Archive.
- Le lecteur intégré ne gère que les PDF ; pour les autres formats, un lien vers la source
  s'ouvre dans un nouvel onglet.
- Le proxy PDF bloque les cibles réseau privées/locales évidentes, mais ce n'est pas une
  garantie de sécurité absolue.
- Pas de compte ni de synchronisation : tout est stocké sur l'appareil.

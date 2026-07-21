# Parcours de Lecture

Application qui génère, sur un thème donné, un parcours de lecture ordonné d'au moins
10 textes, puis propose un lecteur intégré (zoom, marque-page, résumés progressifs en
marge) pour s'y former.

## Fonctionnement

1. L'utilisateur donne un thème → `api/generate-parcours.js` interroge Gemini (sortie JSON
   structurée) pour construire la liste ordonnée de textes, du plus accessible au plus
   exigeant. Les modèles disponibles sont découverts dynamiquement pour chaque clé API
   (via l'endpoint ListModels de Google) plutôt que codés en dur, et plusieurs clés
   optionnelles peuvent être configurées pour cumuler les quotas gratuits.
2. À l'ouverture d'un livre, `api/find-source.js` cherche une source lisible : Project
   Gutenberg, puis Internet Archive, puis une recherche web générale (DuckDuckGo, sans
   clé) en dernier recours. Si rien n'est trouvé, l'utilisateur peut chercher manuellement
   (lien Google pré-rempli) ou coller une URL directe.
3. `api/proxy-pdf.js` relaie le fichier trouvé (contournement CORS), affiché par le lecteur
   PDF intégré (pdf.js) : zoom, navigation, marque-page automatique.
4. Les couvertures viennent de l'API Open Library.
5. Historique, progression et notes sont stockés dans `localStorage`.
6. PWA installable (manifest, icônes, service worker) avec mode sombre.

## Configuration

Variable d'environnement requise : `GOOGLE_AI_KEY` (clé API Google Gemini, obtenue
gratuitement sur aistudio.google.com, sans carte bancaire). Voir `.env.example`.

Optionnel : `GOOGLE_AI_KEY_2`, `GOOGLE_AI_KEY_3`, … — des clés Gemini supplémentaires
(comptes Google différents, toujours gratuits) pour cumuler les quotas si besoin.

## Déploiement sur Vercel

Projet Vite standard à la racine du dépôt : *Add New Project* → importe le repo →
variable `GOOGLE_AI_KEY` → Deploy.

## Développement local

```bash
npm install -g vercel
npm install
echo "GOOGLE_AI_KEY=AIza..." > .env.local
npm run dev
```

## Limites connues

- Le lecteur intégré ne gère que les PDF ; pour les autres formats, un lien vers la source
  s'ouvre dans un nouvel onglet.
- Le proxy PDF bloque les cibles réseau privées/locales évidentes, mais ce n'est pas une
  garantie de sécurité absolue.
- Pas de compte ni de synchronisation : tout est stocké sur l'appareil.

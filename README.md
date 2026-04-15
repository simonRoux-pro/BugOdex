# BugOdex

Pokédex des animaux et insectes — prends une photo, identifie l'espèce, collectionne.

## Stack (100% gratuit)

- **Identification** : Google Gemini 2.0 Flash — tier gratuit (1 500 req/jour, sans carte bancaire)
- **Photos officielles** : iNaturalist API — gratuit, aucune clé requise
- **Hébergement** : Vercel — tier gratuit
- **Frontend** : React 18 + Vite + Tailwind CSS
- **Stockage** : localStorage (collection sauvegardée sur l'appareil)

---

## Déploiement sur Vercel (accès mobile sans ordi)

### 1. Obtenir une clé API Google (gratuite)
- Va sur **aistudio.google.com**
- Connecte-toi avec un compte Google
- Clique **"Get API key"** → "Create API key"
- Copie la clé `AIza...`

### 2. Déployer sur Vercel
1. Va sur **vercel.com** → "Sign Up" avec GitHub
2. "Add New Project" → importe le repo `BugOdex`
3. Dans **"Environment Variables"**, ajoute :
   - `GOOGLE_AI_KEY` → ta clé `AIza...`
4. Clique **Deploy**

Tu reçois une URL publique — ouvre-la sur ton téléphone, c'est tout.

---

## Développement local

```bash
npm install -g vercel
npm install
echo "GOOGLE_AI_KEY=AIza..." > .env.local
npm run dev
```

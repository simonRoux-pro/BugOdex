# BugOdex

Pokédex des animaux et insectes — prends une photo, identifie l'espèce, collectionne.

## Déploiement (accès mobile sans ordi)

### 1. Déployer sur Vercel (gratuit)

1. Va sur [vercel.com](https://vercel.com) et connecte ton compte GitHub
2. Clique **"Add New Project"** → importe le repo `BugOdex`
3. Dans **"Environment Variables"**, ajoute :
   - `ANTHROPIC_API_KEY` → ta clé depuis [console.anthropic.com](https://console.anthropic.com)
4. Clique **Deploy**

Vercel te donne une URL publique (ex: `bugodex.vercel.app`). Ouvre-la sur ton téléphone, c'est tout.

---

## Développement local

```bash
# Installer Vercel CLI
npm install -g vercel

# Installer les dépendances
npm install

# Créer un fichier .env.local avec ta clé
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# Lancer (simule Vercel en local, fonctions serverless incluses)
npm run dev
```

## Stack

- **Frontend** : React 18 + Vite + Tailwind CSS
- **Backend** : Vercel Serverless Functions
- **IA** : Anthropic API (identification d'espèce par vision)
- **Images** : Wikipedia REST API
- **Stockage** : localStorage (collection sauvegardée sur l'appareil)

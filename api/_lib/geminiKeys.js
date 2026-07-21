// Clés API Gemini optionnelles supplémentaires (GOOGLE_AI_KEY_2, GOOGLE_AI_KEY_3, …) —
// chaque clé Google gratuite a son propre quota, donc en ajouter une seconde
// (compte Google différent, toujours gratuit, aucune carte requise) multiplie
// la capacité disponible sans rien changer d'autre. Partagé entre les
// fonctions serverless qui appellent l'API Gemini.
export function getApiKeys() {
  const keys = [process.env.GOOGLE_AI_KEY]
  for (let i = 2; i <= 5; i += 1) {
    const extra = process.env[`GOOGLE_AI_KEY_${i}`]
    if (extra) keys.push(extra)
  }
  return keys.filter(Boolean)
}

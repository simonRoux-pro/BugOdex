// Fonction Edge : proxy la récupération d'un document distant (PDF/EPUB/HTML) pour
// contourner les restrictions CORS des sites sources, en streamant la réponse
// (nécessaire pour les gros PDF — les fonctions Node classiques sur Vercel plafonnent
// la taille de réponse bien en dessous de la taille d'un livre complet).
export const config = { runtime: 'edge' }

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'text/html',
  'application/octet-stream',
]

const MAX_REDIRECTS = 5

// Injecté dans les pages HTML proxyées pour retenir et restaurer la position
// de lecture (en proportion du document, indépendante de la taille d'écran).
// On communique avec la page parente via postMessage, qui marche aussi bien
// en cross-origin qu'en same-origin — pas besoin d'accès direct au DOM.
const SCROLL_SCRIPT = `<script>(function(){
function ratio(){var el=document.scrollingElement||document.documentElement;var max=(el.scrollHeight-el.clientHeight)||1;return Math.max(0,Math.min(1,el.scrollTop/max));}
function send(){try{parent.postMessage({source:'parcours-lecture',scrollRatio:ratio()},'*');}catch(e){}}
var params=new URLSearchParams(location.search);
var initial=parseFloat(params.get('scrollRatio'));
if(!isNaN(initial)&&initial>0){
  window.addEventListener('load',function(){
    setTimeout(function(){var el=document.scrollingElement||document.documentElement;el.scrollTop=initial*(el.scrollHeight-el.clientHeight);},80);
  });
}
var t=null;
window.addEventListener('scroll',function(){
  clearTimeout(t);
  t=setTimeout(send,400);
},{passive:true});
// Le debounce sur "scroll" peut ne jamais se déclencher si l'app est
// fermée/mise en arrière-plan juste après avoir arrêté de défiler (cas très
// courant sur mobile) : on force l'envoi immédiat dès que la page devient
// cachée ou va se décharger, pour ne jamais perdre la dernière position.
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){clearTimeout(t);send();}});
window.addEventListener('pagehide',send);
})();</script>`

function injectScrollTracking(html, baseUrl) {
  let out = html
  const baseTag = `<base href="${baseUrl}">`
  out = /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`) : baseTag + out
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${SCROLL_SCRIPT}</body>`) : out + SCROLL_SCRIPT
  return out
}

/**
 * Vérifie si un hostname/IP cible une ressource interne/privée (protection SSRF).
 * Ceci est une protection best-effort basée sur le nom d'hôte littéral : elle bloque
 * les IP privées/loopback explicites, mais ne protège pas contre le "DNS rebinding"
 * (résolution DNS non disponible en runtime Edge). Suffisant pour un usage personnel,
 * pas pour un service exposé à fort enjeu de sécurité.
 */
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 127) return true // loopback
    if (a === 10) return true // 10.0.0.0/8
    if (a === 0) return true // 0.0.0.0/8
    if (a === 169 && b === 254) return true // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 (CGNAT)
    return false
  }

  if (h === '::1' || h === '[::1]') return true
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('[fc') || h.startsWith('[fd')) return true // fc00::/7
  if (h.startsWith('fe80') || h.startsWith('[fe80')) return true // fe80::/10

  return false
}

function validateUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { error: 'URL_INVALIDE' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'PROTOCOLE_NON_AUTORISE' }
  }
  if (isBlockedHost(parsed.hostname)) {
    return { error: 'HOTE_NON_AUTORISE' }
  }
  return { url: parsed }
}

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const target = new URL(req.url).searchParams.get('url')
  if (!target) {
    return new Response(JSON.stringify({ error: 'URL_MANQUANTE' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let current = validateUrl(target)
  if (current.error) {
    return new Response(JSON.stringify({ error: current.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Tout le reste (réseau vers le site source, lecture du corps, injection
  // dans le HTML) peut échouer de façon inattendue et imprévisible (panne
  // momentanée, flux interrompu…). Sans ce filet, une telle erreur fait
  // planter toute la fonction Edge (500 FUNCTION_INVOCATION_FAILED) au lieu
  // de renvoyer une erreur exploitable par l'appli.
  try {
    return await proxyRequest(current, corsHeaders)
  } catch (err) {
    console.error('proxy-pdf — erreur inattendue :', err?.message)
    return new Response(JSON.stringify({ error: 'ERREUR_PROXY', detail: err?.message ?? 'erreur inconnue' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

async function proxyRequest(initial, corsHeaders) {
  let current = initial
  let upstream
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    upstream = await fetch(current.url, {
      redirect: 'manual',
      // Beaucoup de sites sources bloquent ou dégradent les requêtes dont le
      // User-Agent ne ressemble pas à un navigateur. On imite un navigateur
      // mobile réel plutôt que de s'identifier comme un script.
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36' },
    })

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location')
      if (!location) break
      const nextUrl = new URL(location, current.url)
      current = validateUrl(nextUrl.toString())
      if (current.error) {
        return new Response(JSON.stringify({ error: current.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      continue
    }
    break
  }

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'SOURCE_INACCESSIBLE', status: upstream.status }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const contentType = (upstream.headers.get('content-type') ?? '').split(';')[0].trim()
  if (contentType && !ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return new Response(JSON.stringify({ error: 'TYPE_CONTENU_NON_AUTORISE', contentType }), {
      status: 415,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (contentType === 'text/html') {
    // Pages HTML : on les bufferise (elles sont petites, contrairement aux PDF)
    // pour y injecter le suivi de position de lecture. Si l'injection échoue
    // pour une raison quelconque, on sert quand même la page telle quelle
    // (juste sans le suivi automatique) plutôt que de faire échouer la lecture.
    const html = await upstream.text()
    let withTracking = html
    try {
      withTracking = injectScrollTracking(html, current.url.toString())
    } catch (err) {
      console.error('injectScrollTracking a échoué :', err?.message)
    }
    return new Response(withTracking, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

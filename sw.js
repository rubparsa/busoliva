// Service worker de l'app.
// - Estructura de l'app: memòria cau prèvia (canvieu VERSIO quan publiqueu canvis en l'app).
// - Dades: primer per xarxa, amb l'última còpia vàlida de reserva.
// - Tessel·les del mapa i altres orígens: no es toquen (van directes a la xarxa).
importScripts('js/valida-dades.js');

const VERSIO = '14';
const CAU_APP = 'busoliva-app-' + VERSIO;
const CAU_DADES = 'busoliva-dades';
const APP = [
  './', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/i18n.js', 'js/valida-dades.js', 'js/servei.js', 'js/diagrama.js', 'js/mapa.js',
  'fonts/lexend-latin-400-normal.woff2', 'fonts/archivo-black-latin-400-normal.woff2',
  'icons/icona.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];
const DADES_INICIALS = ['data/servei.json', 'data/festius.json', 'data/avisos.json'];
const DADES = new Set([...DADES_INICIALS, 'data/recorregut.geojson', 'data/carrers.json']);
const BASE = new URL('./', self.location).href;

async function validaResposta(ruta, res) {
  if (!res.ok || !globalThis.validaDadesBusOliva(ruta, await res.clone().json())) {
    throw new Error('Resposta de dades invàlida: ' + ruta);
  }
}

async function descarregaDades(ruta, cau) {
  const control = new AbortController();
  const limit = setTimeout(() => control.abort(), 4000);
  try {
    const res = await fetch(ruta, { cache: 'no-cache', signal: control.signal });
    await validaResposta(ruta, res);
    if (cau) {
      const capcaleres = new Headers(res.headers);
      capcaleres.set('x-desat-el', new Date().toISOString());
      const copia = new Response(await res.clone().blob(), { headers: capcaleres });
      await cau.put(ruta, copia).catch(() => {});
    }
    return res;
  } finally {
    clearTimeout(limit);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const app = await caches.open(CAU_APP);
    await app.addAll(APP.map((ruta) => new Request(ruta, { cache: 'no-cache' })));
    const dades = await caches.open(CAU_DADES).catch(() => null);
    if (dades) await Promise.allSettled(DADES_INICIALS.map((ruta) => descarregaDades(ruta, dades)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n.indexOf('busoliva-app-') === 0 && n !== CAU_APP).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// L'app demana activar la versió nova quan es toca «Actualitza».
self.addEventListener('message', (event) => {
  if (event.data === 'actualitza') self.skipWaiting();
});

async function xarxaPrimer(ruta) {
  const cau = await caches.open(CAU_DADES).catch(() => null);
  try {
    return await descarregaDades(ruta, cau);
  } catch (error) {
    // En actualitzar des d'una versió antiga, la còpia pot no haver sigut validada.
    const desat = await cau?.match(ruta).catch(() => null);
    if (desat) {
      try {
        await validaResposta(ruta, desat);
        return desat;
      } catch (error) { /* no hi ha cap còpia vàlida */ }
    }
    return new Response(null, { status: 503 });
  }
}

async function memoriaPrimer(request, ruta) {
  const desat = await caches.match(request, { ignoreSearch: true });
  if (desat) return desat;
  const res = await fetch(request);
  if (res.ok && ruta.indexOf('vendor/') === 0) (await caches.open(CAU_APP)).put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.url.indexOf(BASE) !== 0) return;
  const ruta = request.url.slice(BASE.length).split(/[?#]/)[0];
  if (DADES.has(ruta)) {
    event.respondWith(xarxaPrimer(ruta));
  } else if (request.mode === 'navigate') {
    if (ruta === '' || ruta === 'index.html') {
      event.respondWith(caches.match('./').then((res) => res || fetch(request)));
    }
  } else {
    event.respondWith(memoriaPrimer(request, ruta));
  }
});

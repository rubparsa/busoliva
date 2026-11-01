// Service worker de l'app.
// - Estructura de l'app: memòria cau prèvia (canvieu VERSIO quan publiqueu canvis en l'app).
// - Dades (data/*): primer per xarxa; si no n'hi ha, la còpia desada, amb la data en què es va desar.
// - Tessel·les del mapa i altres orígens: no es toquen (van directes a la xarxa).
const VERSIO = '1';
const CAU_APP = 'busoliva-app-' + VERSIO;
const CAU_DADES = 'busoliva-dades';
const APP = [
  './', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/i18n.js', 'js/servei.js', 'js/diagrama.js', 'js/mapa.js',
  'fonts/lexend-latin-400-normal.woff2', 'fonts/archivo-black-latin-400-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];
const DADES = ['data/servei.json', 'data/festius.json', 'data/avisos.json', 'data/recorregut.geojson'];
const BASE = new URL('./', self.location).href;

async function ambData(res) {
  const capcaleres = new Headers(res.headers);
  capcaleres.set('x-desat-el', new Date().toISOString());
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: capcaleres });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const app = await caches.open(CAU_APP);
    await app.addAll(APP.map((ruta) => new Request(ruta, { cache: 'no-cache' })));
    const dades = await caches.open(CAU_DADES);
    await Promise.all(DADES.map(async (ruta) => {
      const res = await fetch(ruta, { cache: 'no-cache' });
      if (res.ok) await dades.put(ruta, await ambData(res));
    }));
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
  const cau = await caches.open(CAU_DADES);
  const xarxa = fetch(ruta, { cache: 'no-cache' }).then(async (res) => {
    if (res.ok) await cau.put(ruta, await ambData(res.clone()));
    return res;
  });
  xarxa.catch(() => {});
  const limit = new Promise((resol) => setTimeout(resol, 4000, null));
  try {
    const res = await Promise.race([xarxa, limit]);
    if (res) return res;
  } catch (error) {
    // sense xarxa: es fa servir la còpia desada
  }
  return (await cau.match(ruta)) || xarxa;
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
  if (ruta.indexOf('data/') === 0) {
    event.respondWith(xarxaPrimer(ruta));
  } else if (request.mode === 'navigate') {
    if (ruta === '' || ruta === 'index.html') {
      event.respondWith(caches.match('./').then((res) => res || fetch(request)));
    }
  } else {
    event.respondWith(memoriaPrimer(request, ruta));
  }
});

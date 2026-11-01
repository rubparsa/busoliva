// Mapa Leaflet + OSM. Leaflet només es carrega quan s'obri la vista del mapa.
// El traçat ix de data/recorregut.geojson: l'app no crida mai OSRM.
let promesa = null;
let mapa = null;
let jo = null;
let ctx = null;
const marcadors = [];

function carregaLeaflet() {
  if (window.L) return Promise.resolve();
  if (!promesa) {
    promesa = new Promise((ok, ko) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'vendor/leaflet/leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'vendor/leaflet/leaflet.js';
      js.onload = ok;
      js.onerror = () => { promesa = null; ko(new Error('Leaflet')); };
      document.head.appendChild(js);
    });
  }
  return promesa;
}

// Les parades que són el mateix punt (una per sentit) comparteixen marcador.
function grups() {
  const ps = ctx.servei.parades.slice(0, -1);
  const perPunt = {};
  const ordre = [];
  ps.forEach((p) => {
    if (!perPunt[p.punt]) { perPunt[p.punt] = []; ordre.push(p.punt); }
    perPunt[p.punt].push(p);
  });
  return ordre.map((punt) => perPunt[punt]);
}

function contingut(grup) {
  return grup.map((p) => '<p><strong>' + ctx.escapa(ctx.etiqueta(p)) + '</strong><br>' +
    ctx.escapa(ctx.t('mapa.proper', { hora: ctx.proper(p) })) + '</p>' +
    (grup.length > 1 ? '<p><button type="button" class="boto" data-tria="' + p.num + '">' + ctx.escapa(ctx.t('mapa.tria')) + '</button></p>' : '')
  ).join('') + '<p><a href="#proper">' + ctx.escapa(ctx.t('mapa.veure')) + '</a></p>';
}

function crea() {
  const L = window.L;
  const redueix = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  mapa = L.map('mapa', { zoomAnimation: !redueix, fadeAnimation: !redueix, markerZoomAnimation: !redueix, inertia: !redueix });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).on('tileerror', () => ctx.senseTesseles()).addTo(mapa);
  mapa.getContainer().addEventListener('click', (e) => {
    const boto = e.target.closest ? e.target.closest('[data-tria]') : null;
    if (boto) ctx.tria(+boto.getAttribute('data-tria'));
  });
  grups().forEach((grup) => {
    const icona = L.divIcon({ className: 'marcador', html: '<span>' + grup.map((p) => p.num).join('·') + '</span>', iconSize: [grup.length > 1 ? 64 : 44, 44] });
    const m = L.marker([grup[0].lat, grup[0].lon], { icon: icona, title: '', keyboard: true, riseOnHover: true });
    m.bindPopup(() => contingut(grup));
    m.on('click', () => {
      const actual = grup.filter((p) => p.num === ctx.parada)[0];
      ctx.tria(actual ? actual.num : grup[0].num);
    });
    m.addTo(mapa);
    marcadors.push({ m, grup });
  });
  mapa.fitBounds(L.latLngBounds(ctx.servei.parades.map((p) => [p.lat, p.lon])), { padding: [24, 24] });
  return fetch('data/recorregut.geojson').then((r) => r.json()).then((geo) => {
    const capa = L.geoJSON(geo, { style: { color: '#0D8F8C', weight: 5, opacity: 0.9 }, interactive: false }).addTo(mapa);
    capa.bringToBack();
    ctx.rectes(geo.features[0].properties.origen !== 'osrm');
    mapa.fitBounds(capa.getBounds(), { padding: [24, 24] });
  });
}

function actualitza() {
  marcadors.forEach((x) => {
    const el = x.m.getElement();
    if (!el) return;
    const sel = x.grup.some((p) => p.num === ctx.parada);
    el.classList.toggle('sel', sel);
    el.setAttribute('title', x.grup.map((p) => ctx.etiqueta(p)).join(' / '));
    el.setAttribute('aria-label', x.grup.map((p) => ctx.etiqueta(p)).join(' / '));
  });
  if (ctx.ubicacio) {
    const lloc = [ctx.ubicacio.lat, ctx.ubicacio.lon];
    if (!jo) {
      jo = window.L.circleMarker(lloc, { radius: 9, color: '#fff', weight: 3, fillColor: '#0F5FA8', fillOpacity: 1, interactive: false })
        .bindTooltip(ctx.t('mapa.tu'), { permanent: true, direction: 'top', offset: [0, -8] }).addTo(mapa);
    } else {
      jo.setLatLng(lloc);
      jo.setTooltipContent(ctx.t('mapa.tu'));
    }
  }
}

export function mostra(nouCtx) {
  ctx = nouCtx;
  return carregaLeaflet().then(() => (mapa ? null : crea())).then(() => {
    actualitza();
    mapa.invalidateSize();
  });
}

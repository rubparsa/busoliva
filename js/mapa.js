// Mapa Leaflet + OSM. Leaflet només es carrega quan s'obri la vista del mapa.
// El traçat ix de data/recorregut.geojson: l'app no crida mai OSRM.
let promesa = null;
let mapa = null;
let capa = null;
let jo = null;
let ctx = null;
let marcadors = [];

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
  const perPunt = {};
  const ordre = [];
  ctx.servei.parades.slice(0, -1).forEach((p) => {
    if (!perPunt[p.punt]) { perPunt[p.punt] = []; ordre.push(p.punt); }
    perPunt[p.punt].push(p);
  });
  return ordre.map((punt) => perPunt[punt]);
}

function contingut(grup) {
  return grup.map((p) => '<p><strong>' + ctx.escapa(ctx.etiqueta(p)) + '</strong><br>' +
    ctx.escapa(ctx.proper(p)) + '</p>' +
    (grup.length > 1 ? '<p><button type="button" class="boto" data-tria="' + p.num + '">' + ctx.escapa(ctx.t('mapa.tria')) + '</button></p>' : '')
  ).join('') + '<p><a href="#proper">' + ctx.escapa(ctx.t('mapa.veure')) + '</a></p>';
}

const text = (parades) => (parades.length > 3
  ? ctx.t('mapa.grup', { n: parades.length })
  : parades.map((p) => p.num).sort((a, b) => a - b).join('·'));
const amplada = (parades) => Math.max(44, Math.round(text(parades).length * 9 + 20));

// Els marcadors fan 44 px d'alt com a mínim. Els que es trepitjarien en este zoom
// s'agrupen en un sol marcador; en tocar-lo, el mapa s'hi apropa.
function agrupa() {
  let conjunts = grups().map((grup) => ({ parades: grup, punt: mapa.latLngToLayerPoint([grup[0].lat, grup[0].lon]) }));
  const xoquen = (a, b) => Math.abs(a.punt.x - b.punt.x) < (amplada(a.parades) + amplada(b.parades)) / 2 + 8 &&
    Math.abs(a.punt.y - b.punt.y) < 44 + 8;
  for (let canvi = true; canvi;) {
    canvi = false;
    for (let i = 0; i < conjunts.length && !canvi; i++) {
      for (let j = i + 1; j < conjunts.length && !canvi; j++) {
        if (!xoquen(conjunts[i], conjunts[j])) continue;
        const parades = conjunts[i].parades.concat(conjunts[j].parades);
        const n = parades.length;
        const centre = window.L.point(
          parades.reduce((s, p) => s + mapa.latLngToLayerPoint([p.lat, p.lon]).x, 0) / n,
          parades.reduce((s, p) => s + mapa.latLngToLayerPoint([p.lat, p.lon]).y, 0) / n,
        );
        conjunts = conjunts.filter((c, k) => k !== i && k !== j).concat([{ parades, punt: centre, grup: true }]);
        canvi = true;
      }
    }
  }
  return conjunts;
}

function pintaMarcadors() {
  const L = window.L;
  capa.clearLayers();
  marcadors = agrupa().map((c) => {
    const icona = L.divIcon({ className: 'marcador', html: '<span>' + ctx.escapa(text(c.parades)) + '</span>', iconSize: [amplada(c.parades), 44] });
    const m = L.marker(mapa.layerPointToLatLng(c.punt), { icon: icona, keyboard: true, riseOnHover: true });
    const accio = c.grup
      ? () => mapa.fitBounds(L.latLngBounds(c.parades.map((p) => [p.lat, p.lon])), { padding: [70, 70], maxZoom: 18 })
      : () => {
        const actual = c.parades.filter((p) => p.num === ctx.parada)[0];
        ctx.tria(actual ? actual.num : c.parades[0].num);
      };
    if (!c.grup) m.bindPopup(() => contingut(c.parades));
    m.on('click', accio);
    m.on('keypress', (e) => { if (e.originalEvent.keyCode === 13) accio(); });
    capa.addLayer(m);
    return { m, parades: c.parades };
  });
  actualitza();
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
  mapa.fitBounds(L.latLngBounds(ctx.servei.parades.map((p) => [p.lat, p.lon])), { padding: [30, 30] });
  capa = L.layerGroup().addTo(mapa);
  mapa.on('zoomend', pintaMarcadors);
  pintaMarcadors();
  return fetch('data/recorregut.geojson').then((r) => r.json()).then((geo) => {
    L.geoJSON(geo, { style: { color: '#0D8F8C', weight: 5, opacity: 0.9 }, interactive: false }).addTo(mapa).bringToBack();
    ctx.rectes(geo.features[0].properties.origen !== 'osrm');
  });
}

function actualitza() {
  marcadors.forEach((x) => {
    const el = x.m.getElement();
    if (!el) return;
    const nom = text(x.parades) + ': ' + x.parades.map((p) => ctx.etiqueta(p)).join(' / ');
    el.classList.toggle('sel', x.parades.some((p) => p.num === ctx.parada));
    el.setAttribute('title', nom);
    el.setAttribute('aria-label', nom);
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
    mapa.invalidateSize();
    actualitza();
  });
}

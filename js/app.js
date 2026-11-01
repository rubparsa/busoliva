import { IDIOMES, DIES, estableixIdioma, idioma, idiomaInicial, t } from './i18n.js';
import * as S from './servei.js';
import { pintaDiagrama } from './diagrama.js';

const VISTES = ['proper', 'anar', 'horari', 'mapa', 'linia', 'sobre'];
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
const escapa = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const estat = {
  servei: null, festius: new Map(), avisos: [],
  parada: null, ubicacio: null, ubicEstat: '', desades: null,
  vista: 'proper', minut: -1, anunci: '', mapa: null,
};

function llig(clau) {
  try { return localStorage.getItem('busoliva.' + clau); } catch (e) { return null; }
}
function desa(clau, valor) {
  try {
    if (valor === null) localStorage.removeItem('busoliva.' + clau);
    else localStorage.setItem('busoliva.' + clau, valor);
  } catch (e) { /* sense emmagatzematge: no es recorda */ }
}

// ---------- Format ----------
const separador = () => (idioma() === 'en' ? ':' : '.');
function hora(ms) {
  const p = S.partsMadrid(ms);
  return p.hora + separador() + (p.minut < 10 ? '0' : '') + p.minut;
}
const horaText = (hhmm) => +hhmm.split(':')[0] + separador() + hhmm.split(':')[1];
function data(dataIso) {
  const d = dataIso.split('-');
  return idioma() === 'en' ? +d[2] + '/' + +d[1] + '/' + d[0] : +d[2] + '-' + +d[1] + '-' + d[0];
}
function quanDia(ms) {
  const avui = S.diaMadrid(Date.now());
  const dia = S.diaMadrid(ms);
  if (dia === avui) return '';
  if (dia === S.sumaDies(avui, 1)) return t('dia.dema');
  const d = dia.split('-');
  return DIES[idioma()][S.diaSetmana(dia)] + ' ' + +d[2] + (idioma() === 'en' ? '/' : '-') + +d[1];
}
const parades = () => estat.servei.parades;
const aprox = (parada) => parada !== parades()[0];
// «a les 7.30», «demà a les 9.00», «a les 7.43 aprox.»
function quan(ms, parada, plantilla) {
  const dia = quanDia(ms);
  const text = t(plantilla || 'hora.ales', { hora: hora(ms) });
  return (dia ? dia + ' ' : '') + text + (aprox(parada) ? ' ' + t('hora.aprox') : '');
}
// «8.30», «demà 9.00», «7.43 aprox.»
function quanCurt(ms, parada) {
  const dia = quanDia(ms);
  return (dia ? dia + ' ' : '') + hora(ms) + (aprox(parada) ? ' ' + t('hora.aprox') : '');
}
function compte(ms, ara) {
  const min = Math.floor((ms - ara) / 60000);
  if (min <= 0) return t('proper.ara');
  if (min < 60) return t('temps.min', { m: min });
  return t('temps.hmin', { h: Math.floor(min / 60), m: min % 60 });
}
function distancia(metres) {
  if (metres < 1000) return Math.round(metres / 10) * 10 + ' m';
  const km = (Math.round(metres / 100) / 10).toFixed(1);
  return (idioma() === 'en' ? km : km.replace('.', ',')) + ' km';
}

// ---------- Parades ----------
const parada = (num) => parades().filter((p) => p.num === num)[0];
const paradaActual = () => parada(estat.parada) || parades()[0];
const nom = (p) => (idioma() === 'es' ? p.nom.es : p.nom.va);
function sentit(p) {
  const ps = parades();
  const i = ps.indexOf(p);
  if (i === 0) return t('sentit.eixida');
  if (i === ps.length - 1) return t('sentit.final');
  const mateixPunt = ps.filter((q) => q.punt === p.punt);
  if (mateixPunt.length < 2) return '';
  return mateixPunt.indexOf(p) === 0 ? t('sentit.platja') : t('sentit.poble');
}
function etiqueta(p) {
  const s = sentit(p);
  return t('proper.parada', { num: p.num }) + ' · ' + nom(p) + (s ? ' · ' + s : '');
}
function botoParada(p, detall) {
  const s = sentit(p);
  return '<li><button type="button" class="parada" data-num="' + p.num + '"' +
    (p.num === estat.parada ? ' aria-current="true"' : '') + '>' +
    '<span class="num" aria-hidden="true">' + p.num + '</span>' +
    '<span><span class="vh">' + escapa(t('proper.parada', { num: p.num })) + ' · </span>' + escapa(nom(p)) +
    (s ? ' · ' + escapa(s) : '') +
    (detall ? '<span class="detall">' + escapa(detall) + '</span>' : '') + '</span></button></li>';
}

function tria(num, mouFocus) {
  estat.parada = num;
  desa('parada', String(num));
  $('#accions-estat').textContent = '';
  pintaLlista();
  if (mouFocus) {
    $('#triador').open = false;
    if (estat.vista !== 'proper') location.hash = '#proper';
    else pinta();
    $('#proper').focus();
  } else {
    pinta();
  }
}

// ---------- Pròxim bus ----------
function pintaProper(ara) {
  const p = paradaActual();
  const el = $('#proper-parada');
  el.textContent = etiqueta(p);
  el.setAttribute('data-num', p.num);
  $('#proper-estimat').hidden = !p.estimat;
  const avis = $('#proper-avis');
  const compteEl = $('#proper-compte');
  const horaEl = $('#proper-hora');
  avis.hidden = true;
  $('#proper-seguents').innerHTML = '';
  $('#proper-falten').textContent = '';
  compteEl.textContent = '';
  horaEl.textContent = '';
  ['data-minuts', 'data-hora', 'data-data'].forEach((a) => { compteEl.removeAttribute(a); horaEl.removeAttribute(a); });

  const llista = S.finalitzat(estat.servei, ara) ? [] : S.passades(estat.servei, estat.festius, p, ara, 4);
  if (!llista.length) {
    avis.textContent = t(S.finalitzat(estat.servei, ara) ? 'proper.finalitzat' : 'proper.capBus');
    avis.hidden = false;
    $('#ubic-apeu').hidden = true;
    anuncia([el.textContent, avis.textContent]);
    return;
  }
  const primer = llista[0];
  const resta = llista.slice(1);
  const minuts = Math.max(0, Math.floor((primer.ms - ara) / 60000));
  $('#proper-falten').textContent = minuts > 0 ? t('proper.falten') : '';
  compteEl.textContent = compte(primer.ms, ara);
  compteEl.setAttribute('data-minuts', minuts);
  horaEl.textContent = quan(primer.ms, p);
  horaEl.setAttribute('data-hora', S.horaMadrid(primer.ms));
  horaEl.setAttribute('data-data', S.diaMadrid(primer.ms));

  const avui = S.diaMadrid(ara);
  if (S.diaMadrid(primer.ms) !== avui) {
    avis.textContent = t('proper.capMes', { quan: quan(primer.ms, p) });
    avis.hidden = false;
  } else if (!resta.length || S.diaMadrid(resta[0].ms) !== avui) {
    avis.textContent = t('proper.ultim');
    avis.hidden = false;
  }
  $('#proper-seguents').innerHTML = resta.length
    ? '<span>' + escapa(t('proper.despres')) + ':</span> <ul>' + resta.map((r) => '<li>' + escapa(quanCurt(r.ms, p)) + '</li>').join('') + '</ul>'
    : '';
  pintaAPeu(p, primer, ara);
  anuncia([el.textContent, (minuts > 0 ? t('proper.falten') + ' ' : '') + compteEl.textContent, horaEl.textContent, avis.hidden ? '' : avis.textContent]);
}

// L'aria-live només canvia quan canvia el text, és a dir, una vegada per minut.
function anuncia(parts) {
  const text = parts.filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join('. ');
  if (text !== estat.anunci) {
    estat.anunci = text;
    $('#anunci').textContent = text;
  }
}

function pintaAPeu(p, primer, ara) {
  const el = $('#ubic-apeu');
  if (!estat.ubicacio) { el.hidden = true; return; }
  const min = S.minutsAPeu(S.distancia(estat.ubicacio, p));
  if (primer.ms - ara >= min * 60000) {
    el.className = 'nota';
    el.textContent = t('ubic.atemps', { min });
  } else {
    const seguent = S.passades(estat.servei, estat.festius, p, ara + min * 60000, 1)[0];
    el.className = 'avis';
    el.textContent = t('ubic.noArribes', { min, hora: hora(primer.ms) }) +
      (seguent ? ' ' + t('ubic.seguent', { hora: quanCurt(seguent.ms, p) }) : '');
  }
  el.hidden = false;
}

function pintaProperes() {
  const caixa = $('#ubic-properes');
  $('#ubic-estat').textContent = estat.ubicEstat ? t(estat.ubicEstat) : '';
  if (!estat.ubicacio) { caixa.hidden = true; return; }
  $('#llista-properes').innerHTML = S.properes(estat.servei, estat.ubicacio, 3).map((r) =>
    botoParada(r.parada, t('ubic.distancia', { dist: distancia(r.metres), min: S.minutsAPeu(r.metres) }))).join('');
  caixa.hidden = false;
}

function localitza() {
  if (!navigator.geolocation) { estat.ubicEstat = 'ubic.noDisponible'; pintaProperes(); return; }
  estat.ubicEstat = 'ubic.buscant';
  pintaProperes();
  navigator.geolocation.getCurrentPosition((pos) => {
    estat.ubicacio = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    estat.ubicEstat = '';
    desa('ubicacio', '1');
    tria(S.properes(estat.servei, estat.ubicacio, 1)[0].parada.num, false);
  }, (error) => {
    if (error.code === 1) desa('ubicacio', null);
    estat.ubicEstat = error.code === 1 ? 'ubic.denegat' : 'ubic.error';
    pintaProperes();
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}

// Si ja hi ha permís, es busca la parada més propera en obrir l'app.
function localitzaSiHiHaPermis() {
  if (llig('ubicacio') === '1') { localitza(); return; }
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' })
      .then((r) => { if (r.state === 'granted') localitza(); })
      .catch(() => {});
  }
}

// ---------- Favorites, compartir i visualització ----------
const MAX_FAVORITES = 3;
function favorites() {
  try {
    const llista = JSON.parse(llig('favorites') || '[]');
    return Array.isArray(llista) ? llista.filter((n) => parada(n)) : [];
  } catch (e) { return []; }
}
function commutaFavorita() {
  const num = paradaActual().num;
  const llista = favorites();
  const i = llista.indexOf(num);
  if (i >= 0) llista.splice(i, 1);
  else if (llista.length >= MAX_FAVORITES) { $('#accions-estat').textContent = t('fav.maxim', { n: MAX_FAVORITES }); return; }
  else llista.push(num);
  desa('favorites', JSON.stringify(llista));
  $('#accions-estat').textContent = '';
  pinta();
}
function pintaFavorites(ara) {
  const llista = favorites();
  $('#boto-favorita').setAttribute('aria-pressed', String(llista.indexOf(paradaActual().num) >= 0));
  $('#favorites').hidden = !llista.length;
  $('#llista-favorites').innerHTML = llista.map((n) => {
    const p = parada(n);
    const r = S.finalitzat(estat.servei, ara) ? null : S.passades(estat.servei, estat.festius, p, ara, 1)[0];
    return botoParada(p, r ? quanCurt(r.ms, p) : '');
  }).join('');
}
function comparteix() {
  const p = paradaActual();
  const url = new URL('./?parada=' + p.num, location.href).href;
  const avisa = (clau) => { $('#accions-estat').textContent = t(clau, { url }); };
  if (navigator.share) {
    navigator.share({ title: t('doc.titol'), text: etiqueta(p), url }).catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => avisa('comparteix.copiat'), () => avisa('comparteix.enllac'));
  } else {
    avisa('comparteix.enllac');
  }
}
const MODES = { contrast: 'alt-contrast', text: 'text-gran' };
function aplicaModes() {
  Object.keys(MODES).forEach((mode) => {
    const actiu = llig(mode) === '1';
    document.documentElement.classList.toggle(MODES[mode], actiu);
    const boto = $('[data-mode="' + mode + '"]');
    if (boto) boto.setAttribute('aria-pressed', String(actiu));
  });
}

// ---------- Selector i cerca ----------
const normalitza = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[·.]/g, '');
function pintaLlista() {
  $('#llista-parades').innerHTML = parades().slice(0, -1).map((p) => botoParada(p)).join('');
  filtra();
}
function filtra() {
  const consulta = normalitza($('#cerca').value.trim());
  let visibles = 0;
  $$('#llista-parades li').forEach((li) => {
    const p = parada(+li.firstChild.getAttribute('data-num'));
    const text = normalitza(p.num + ' ' + p.nom.va + ' ' + p.nom.es);
    const ok = !consulta || (/^\d+$/.test(consulta)
      ? String(p.num) === consulta
      : consulta.split(/\s+/).every((paraula) => text.indexOf(paraula) >= 0));
    li.hidden = !ok;
    if (ok) visibles++;
  });
  $('#cerca-cap').hidden = visibles > 0;
}

// ---------- On vols anar? ----------
function punts() {
  const vistos = {};
  return parades().filter((p) => (vistos[p.punt] ? false : (vistos[p.punt] = true)));
}
function pintaAnar(ara) {
  const origen = $('#anar-origen');
  const desti = $('#anar-desti');
  const vo = origen.value || paradaActual().punt;
  const vd = desti.value;
  const opcions = punts().map((p) => '<option value="' + p.punt + '">' + escapa(nom(p)) + '</option>').join('');
  origen.innerHTML = opcions;
  desti.innerHTML = '<option value="">' + escapa(t('anar.tria')) + '</option>' + opcions;
  origen.value = vo;
  desti.value = vd;
  const res = $('#anar-resultat');
  res.hidden = !vd;
  if (!vd) { res.innerHTML = ''; return; }
  if (vd === vo) { res.innerHTML = '<p>' + escapa(t('anar.mateix')) + '</p>'; return; }
  const v = S.viatge(estat.servei, estat.festius, vo, vd, ara);
  if (!v) { res.innerHTML = '<p>' + escapa(t('proper.capBus')) + '</p>'; return; }
  const ps = parades();
  const lloc = (p) => { const s = sentit(p); return p.num + ' · ' + nom(p) + (s ? ', ' + s + ',' : ''); };
  const atributs = (ms, p) => ' data-num="' + p.num + '" data-hora="' + S.horaMadrid(ms) + '" data-data="' + S.diaMadrid(ms) + '"';
  res.innerHTML =
    '<p class="anar-pas" id="anar-puja"' + atributs(v.puja, v.origen) + '>' + escapa(t('anar.puja', { parada: lloc(v.origen), hora: quan(v.puja, v.origen) })) + '</p>' +
    (v.volta ? '<p>' + escapa(t('anar.volta', { num: ps[ps.length - 1].num, hora: quan(v.final, ps[ps.length - 1], 'hora.capales'), hora2: quan(v.volta.ms, ps[0]) })) + '</p>' : '') +
    '<p class="anar-pas" id="anar-arribada"' + atributs(v.arriba, v.desti) + '>' + escapa(t('anar.baixa', { parada: lloc(v.desti), hora: quan(v.arriba, v.desti, 'hora.capales') })) + '</p>' +
    '<p>' + escapa(t('anar.durada', { min: Math.round((v.arriba - v.puja) / 60000) })) + '</p>';
}

// ---------- Horari ----------
function taula(tipus, p, seguent, hui) {
  const ambPas = aprox(p);
  const titol = t(tipus === 'laborables' ? 'horari.laborables' : 'horari.festius');
  const files = estat.servei.eixides[tipus].map((h) => {
    const proxima = seguent && seguent.eixida.hora === h;
    const dia = proxima ? quanDia(seguent.ms) : '';
    return '<tr' + (proxima ? ' class="proxima"' : '') + '><td>' + horaText(h) +
      (proxima ? ' <span class="etiqueta">' + escapa(t('horari.proxima') + (dia ? ', ' + dia : '')) + '</span>' : '') + '</td>' +
      (ambPas ? '<td>' + horaText(S.sumaMinuts(h, p.minuts_des_de_eixida)) + ' ' + escapa(t('hora.aprox')) + '</td>' : '') + '</tr>';
  }).join('');
  return '<table class="horari' + (hui ? ' hui' : '') + '" data-tipus="' + tipus + '"><caption>' + escapa(titol) +
    (hui ? ' <span class="etiqueta">' + escapa(t('dia.hui')) + '</span>' : '') + '</caption><thead><tr><th scope="col">' +
    escapa(t('horari.eixida')) + '</th>' + (ambPas ? '<th scope="col">' + escapa(t('horari.pas', { num: p.num })) + '</th>' : '') +
    '</tr></thead><tbody>' + files + '</tbody></table>';
}
function pintaHorari(ara) {
  const sv = estat.servei;
  const sel = $('#horari-parada');
  const valor = sel.value || String(paradaActual().num);
  sel.innerHTML = parades().map((p) => { const s = sentit(p); return '<option value="' + p.num + '">' + p.num + ' · ' + escapa(nom(p)) + (s ? ' · ' + escapa(s) : '') + '</option>'; }).join('');
  sel.value = valor;
  const p = parada(+sel.value) || parades()[0];
  $('#horari-vigent').textContent = sv.vigent_fins_a
    ? t('horari.vigentFins', { data: data(sv.vigent_des_de), fi: data(sv.vigent_fins_a) })
    : t('horari.vigent', { data: data(sv.vigent_des_de) });
  $('#horari-eixides').textContent = t('horari.eixides', { nom: nom(parades()[0]) });
  const avui = S.diaMadrid(ara);
  const tipus = S.tipusDia(avui, estat.festius);
  const festiu = estat.festius.get(avui);
  $('#horari-hui').textContent = (festiu ? t('horari.festiu', { nom: festiu.nom[idioma()] }) + ' ' : '') +
    t('horari.aplica', { taula: t(tipus === 'laborables' ? 'horari.laborables' : 'horari.festius') });
  const seguent = S.finalitzat(sv, ara) ? null : S.passades(sv, estat.festius, parades()[0], ara, 1)[0];
  const tipusSeguent = seguent ? S.tipusDia(seguent.eixida.data, estat.festius) : null;
  $('#horari-taules').innerHTML = ['laborables', 'caps_de_setmana_i_festius']
    .map((tp) => taula(tp, p, tipusSeguent === tp ? seguent : null, tp === tipus)).join('');
}

// ---------- Mapa (es carrega en diferit) ----------
function pintaMapa() {
  const avis = $('#mapa-avis');
  if (!navigator.onLine) { avis.hidden = false; return; }
  import('./mapa.js').then((m) => m.mostra({
    servei: estat.servei, parada: estat.parada, ubicacio: estat.ubicacio,
    t, etiqueta, escapa,
    proper: (p) => { const r = S.passades(estat.servei, estat.festius, p, Date.now(), 1)[0]; return r ? quanCurt(r.ms, p) : '–'; },
    tria: (num) => tria(num, false),
    senseTesseles: () => { avis.hidden = false; },
    rectes: (si) => { $('#mapa-rectes').hidden = !si; },
  })).catch(() => { avis.hidden = false; });
}

// ---------- Avisos, bàner i estat de la xarxa ----------
function pintaComuns(ara) {
  const sv = estat.servei;
  const avui = S.diaMadrid(ara);
  $('#banner-gratuit').hidden = !sv.gratuit;
  $('#banner-comprovat').textContent = t('banner.comprovat', { data: data(sv.font.comprovat) });
  $('#banner-font').href = sv.font.url[idioma() === 'va' ? 'va' : 'es'];
  $('#avisos').innerHTML = estat.avisos
    .filter((a) => a.inici <= avui && (!a.fi || a.fi >= avui))
    .map((a) => '<p class="avis-oficial">' + escapa(a.text[idioma()] || a.text.va) + '</p>').join('');
  const xarxa = $('#estat-xarxa');
  if (estat.desades) {
    xarxa.textContent = t('pwa.desades', { data: data(S.diaMadrid(estat.desades)) + ' ' + t('hora.ales', { hora: hora(estat.desades) }) });
  } else {
    xarxa.textContent = t('pwa.sensexarxa');
  }
  xarxa.hidden = !estat.desades && navigator.onLine;
}

function pintaSobre() {
  const sv = estat.servei;
  $('#sobre-font').textContent = t('sobre.font', { titol: sv.font.titol, data: data(sv.font.data_avis), comprovat: data(sv.font.comprovat) });
  const enllac = $('#sobre-enllac');
  enllac.href = sv.font.url[idioma() === 'va' ? 'va' : 'es'];
  enllac.textContent = t('banner.font');
  $('#sobre-festius').textContent = estat.festiusComprovat ? t('sobre.festius', { data: data(estat.festiusComprovat) }) : '';
}

// ---------- Cicle de pintat ----------
function pinta() {
  if (!estat.servei) return;
  const ara = Date.now();
  pintaComuns(ara);
  if (estat.vista === 'proper') { pintaProper(ara); pintaFavorites(ara); pintaProperes(); }
  if (estat.vista === 'anar') pintaAnar(ara);
  if (estat.vista === 'horari') pintaHorari(ara);
  if (estat.vista === 'mapa') pintaMapa();
  if (estat.vista === 'linia') pintaDiagrama($('#diagrama'), { servei: estat.servei, parada: estat.parada, t, nom, escapa });
  if (estat.vista === 'sobre') pintaSobre();
}

function mostraVista(vista, mouFocus) {
  estat.vista = vista;
  VISTES.forEach((v) => { $('#vista-' + v).hidden = v !== vista; });
  $$('.navegacio a').forEach((a) => {
    if (a.getAttribute('data-vista') === vista) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  pinta();
  if (mouFocus) $('#t-' + vista).focus();
}

function aplicaTextos() {
  document.documentElement.lang = IDIOMES[idioma()];
  document.title = t('doc.titol');
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  $$('[data-idioma]').forEach((b) => { b.setAttribute('aria-pressed', String(b.getAttribute('data-idioma') === idioma())); });
}

function canviaIdioma(nou) {
  estableixIdioma(nou);
  desa('idioma', nou);
  $('#accions-estat').textContent = '';
  aplicaTextos();
  if (estat.servei) { pintaLlista(); pinta(); }
}

// ---------- Dades ----------
// Si la resposta ve de la còpia del service worker, porta la data en què es va desar.
function carrega(ruta) {
  return fetch(ruta, { cache: 'no-cache' }).then((res) => {
    if (!res.ok) throw new Error(ruta + ': ' + res.status);
    const desat = res.headers.get('x-desat-el');
    return res.json().then((json) => ({ json, desat: desat ? Date.parse(desat) : null }));
  });
}

function carregaDades() {
  const opcional = (ruta) => carrega(ruta).catch(() => null);
  return Promise.all([carrega('data/servei.json'), opcional('data/festius.json'), opcional('data/avisos.json')])
    .then((r) => {
      estat.servei = r[0].json;
      estat.festius = new Map(r[1] ? r[1].json.festius.map((f) => [f.data, f]) : []);
      estat.festiusComprovat = r[1] ? r[1].json.comprovat : null;
      estat.avisos = r[2] ? r[2].json.avisos : [];
      estat.desades = r[0].desat;
      $('#error-dades').hidden = true;
    });
}

// ---------- Service worker i nova versió ----------
function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let actualitzant = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (actualitzant) location.reload(); });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const avisa = () => {
      if (!reg.waiting || !navigator.serviceWorker.controller) return;
      $('#nova-versio').hidden = false;
      $('#boto-actualitza').onclick = () => { actualitzant = true; reg.waiting.postMessage('actualitza'); };
    };
    avisa();
    reg.addEventListener('updatefound', () => {
      const nou = reg.installing;
      if (nou) nou.addEventListener('statechange', () => { if (nou.state === 'installed') avisa(); });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

// ---------- Inici ----------
function inicia() {
  aplicaModes();
  estableixIdioma(idiomaInicial());
  aplicaTextos();
  document.addEventListener('click', (e) => {
    const boto = e.target.closest ? e.target.closest('button.parada') : null;
    if (boto) tria(+boto.getAttribute('data-num'), true);
    const idiomaBoto = e.target.closest ? e.target.closest('[data-idioma]') : null;
    if (idiomaBoto) canviaIdioma(idiomaBoto.getAttribute('data-idioma'));
    const modeBoto = e.target.closest ? e.target.closest('[data-mode]') : null;
    if (modeBoto) {
      const mode = modeBoto.getAttribute('data-mode');
      desa(mode, llig(mode) === '1' ? null : '1');
      aplicaModes();
    }
  });
  $('#boto-ubicacio').addEventListener('click', localitza);
  $('#boto-favorita').addEventListener('click', commutaFavorita);
  $('#boto-comparteix').addEventListener('click', comparteix);
  $('#cerca').addEventListener('input', filtra);
  $('#anar-origen').addEventListener('change', () => pintaAnar(Date.now()));
  $('#anar-desti').addEventListener('change', () => pintaAnar(Date.now()));
  $('#horari-parada').addEventListener('change', () => pintaHorari(Date.now()));
  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (VISTES.indexOf(v) >= 0) mostraVista(v, true);
  });
  window.addEventListener('online', () => { carregaDades().then(pinta).catch(pinta); });
  window.addEventListener('offline', pinta);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pinta(); });

  // Un enllaç compartit (?parada=N) mana sobre la parada desada i sobre la ubicació.
  const compartida = +new URLSearchParams(location.search).get('parada');
  carregaDades().then(() => {
    const valida = (n) => n && parada(n) && n !== parades()[parades().length - 1].num;
    if (valida(compartida)) {
      estat.parada = compartida;
      desa('parada', String(compartida));
      history.replaceState(null, '', location.pathname + location.hash);
    } else {
      const desada = +llig('parada');
      estat.parada = valida(desada) ? desada : parades()[0].num;
    }
    pintaLlista();
    const v = location.hash.slice(1);
    mostraVista(VISTES.indexOf(v) >= 0 ? v : 'proper', false);
    setInterval(() => {
      const minut = Math.floor(Date.now() / 60000);
      if (minut !== estat.minut) { estat.minut = minut; pinta(); }
    }, 1000);
    estat.minut = Math.floor(Date.now() / 60000);
    if (!valida(compartida)) localitzaSiHiHaPermis();
  }).catch(() => {
    $('#error-dades').hidden = false;
  });
  registraServiceWorker();
}

inicia();

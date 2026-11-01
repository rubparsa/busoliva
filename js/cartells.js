// Cartells A4 per a imprimir: un per parada, amb l'horari de servei.json i el codi QR
// generat en local (qr/parada-N.svg, amb npm run qr).
import { IDIOMES, estableixIdioma, idioma, idiomaInicial, t } from './i18n.js';
import { sumaMinuts } from './servei.js';

const $ = (sel) => document.querySelector(sel);
const escapa = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let servei = null;

const horaText = (hhmm) => Number(hhmm.slice(0, 2)) + (idioma() === 'en' ? ':' : '.') + hhmm.slice(3, 5);
function data(iso) {
  const d = iso.split('-');
  return idioma() === 'en' ? +d[2] + '/' + +d[1] + '/' + d[0] : +d[2] + '-' + +d[1] + '-' + d[0];
}
const nom = (p) => (idioma() === 'es' ? p.nom.es : p.nom.va);
function sentit(p) {
  const ps = servei.parades;
  if (p === ps[0]) return t('sentit.eixida');
  const mateixPunt = ps.filter((q) => q.punt === p.punt);
  if (mateixPunt.length < 2) return '';
  return mateixPunt.indexOf(p) === 0 ? t('sentit.platja') : t('sentit.poble');
}

function taula(tipus, p) {
  const ambPas = p !== servei.parades[0];
  const files = servei.eixides[tipus].map((h) => '<tr><td>' + horaText(h) + '</td>' +
    (ambPas ? '<td>' + horaText(sumaMinuts(h, p.minuts_des_de_eixida)) + ' ' + escapa(t('hora.aprox')) + '</td>' : '') + '</tr>').join('');
  return '<table class="horari"><caption>' + escapa(t(tipus === 'laborables' ? 'horari.laborables' : 'horari.festius')) +
    '</caption><thead><tr><th scope="col">' + escapa(t('horari.eixida')) + '</th>' +
    (ambPas ? '<th scope="col">' + escapa(t('cartells.pas')) + '</th>' : '') + '</tr></thead><tbody>' + files + '</tbody></table>';
}

function cartell(p) {
  const url = new URL('./?parada=' + p.num, location.href).href;
  const s = sentit(p);
  const vigencia = servei.vigent_fins_a
    ? t('horari.vigentFins', { data: data(servei.vigent_des_de), fi: data(servei.vigent_fins_a) })
    : t('horari.vigent', { data: data(servei.vigent_des_de) });
  return '<article class="cartell" aria-labelledby="cartell-' + p.num + '">' +
    '<div class="cartell-cap"><p class="cartell-marca">' + escapa(t('app.titol')) + ' · Oliva</p>' +
    '<p>' + escapa(t('banner.temporal')) + (servei.gratuit ? ' ' + escapa(t('banner.gratuit')) : '') + '</p></div>' +
    '<h2 class="cartell-parada" id="cartell-' + p.num + '"><span class="cartell-num" aria-hidden="true">' + p.num + '</span>' +
    '<span><span class="vh">' + escapa(t('proper.parada', { num: p.num })) + ' · </span>' + escapa(nom(p)) + '</span></h2>' +
    (s ? '<p><strong>' + escapa(s) + '</strong></p>' : '') +
    '<p>' + escapa(t('horari.eixides', { nom: nom(servei.parades[0]) })) + ' ' + escapa(vigencia) + '</p>' +
    '<div class="cartell-taules">' + taula('laborables', p) + taula('caps_de_setmana_i_festius', p) + '</div>' +
    '<div class="cartell-qr"><img src="qr/parada-' + p.num + '.svg" width="160" height="160" alt="' + escapa(t('cartells.qrAlt', { url })) + '">' +
    '<div><p><strong>' + escapa(t('cartells.qr')) + '</strong></p><p class="cartell-url">' + escapa(url) + '</p></div></div>' +
    '<p class="cartell-peu">' + escapa(t('cartells.peu', { titol: servei.font.titol, data: data(servei.font.data_avis), comprovat: data(servei.font.comprovat) })) + '</p>' +
    '</article>';
}

function pinta() {
  document.documentElement.lang = IDIOMES[idioma()];
  document.title = t('cartells.titol') + ' · ' + t('doc.titol');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  document.querySelectorAll('[data-idioma]').forEach((b) => { b.setAttribute('aria-pressed', String(b.getAttribute('data-idioma') === idioma())); });
  if (!servei) return;
  const sel = $('#cartell-parada');
  const valor = sel.value;
  const ps = servei.parades.slice(0, -1);
  sel.innerHTML = '<option value="">' + escapa(t('cartells.totes')) + '</option>' +
    ps.map((p) => '<option value="' + p.num + '">' + p.num + ' · ' + escapa(nom(p)) + '</option>').join('');
  sel.value = valor;
  $('#cartells').innerHTML = ps.filter((p) => !sel.value || String(p.num) === sel.value).map(cartell).join('');
}

try {
  document.documentElement.classList.toggle('alt-contrast', localStorage.getItem('busoliva.contrast') === '1');
  document.documentElement.classList.toggle('text-gran', localStorage.getItem('busoliva.text') === '1');
  const fosc = localStorage.getItem('busoliva.fosc');
  const sistema = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('fosc', fosc === '1' || (fosc !== '0' && sistema));
  document.documentElement.classList.toggle('clar', !(fosc === '1' || (fosc !== '0' && sistema)));
} catch (e) { /* sense emmagatzematge */ }
estableixIdioma(idiomaInicial());
pinta();
document.addEventListener('click', (e) => {
  const boto = e.target.closest ? e.target.closest('[data-idioma]') : null;
  if (!boto) return;
  estableixIdioma(boto.getAttribute('data-idioma'));
  try { localStorage.setItem('busoliva.idioma', idioma()); } catch (er) { /* sense emmagatzematge */ }
  pinta();
});
$('#cartell-parada').addEventListener('change', pinta);
$('#imprimeix').addEventListener('click', () => window.print());
fetch('data/servei.json', { cache: 'no-cache' }).then((r) => r.json()).then((json) => {
  servei = json;
  pinta();
  const inicial = new URLSearchParams(location.search).get('parada');
  if (inicial) {
    $('#cartell-parada').value = inicial;
    pinta();
  }
});

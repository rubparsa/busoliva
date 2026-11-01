// Tests d'acceptació (Playwright + node:test). Execució: npm test
// Rellotge fixat amb page.clock, zona Europe/Madrid si no s'indica una altra,
// tessel·les del mapa avortades i comprovacions amb page.evaluate.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { iniciaServidor } from './servidor.mjs';
import { TEXTOS } from '../js/i18n.js';

const llig = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const servei = llig('../data/servei.json');
const festius = llig('../data/festius.json');
const parada = (num) => servei.parades.find((p) => p.num === num);
const TESSELES = /^https:\/\/tile\.openstreetmap\.org\//;
const VISTES = ['proper', 'anar', 'horari', 'mapa', 'linia', 'sobre'];

// Instant d'una hora de Madrid calculat sense el codi de l'app (CET/CEST).
function madrid(data, hhmm) {
  const [a, m, d] = data.split('-').map(Number);
  const ultimDiumenge = (mes) => { const t = new Date(Date.UTC(a, mes, 0)); return t.getUTCDate() - t.getUTCDay(); };
  const estiu = (m > 3 && m < 10) || (m === 3 && d >= ultimDiumenge(3)) || (m === 10 && d < ultimDiumenge(10));
  return new Date(`${data}T${hhmm}:00${estiu ? '+02:00' : '+01:00'}`);
}
const minuts = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

let srv;
let navegador;
before(async () => {
  srv = await iniciaServidor();
  navegador = await chromium.launch();
});
after(async () => {
  await navegador.close();
  await srv.tanca();
});

async function obri({ hora, zona = 'Europe/Madrid', amplada = 360, geolocation, servidor = srv, abans } = {}) {
  const context = await navegador.newContext({
    timezoneId: zona,
    locale: 'ca-ES',
    viewport: { width: amplada, height: 740 },
    geolocation,
    permissions: geolocation ? ['geolocation'] : [],
  });
  await context.route(TESSELES, (ruta) => ruta.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !TESSELES.test(m.location().url || '')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  if (hora) await page.clock.setFixedTime(hora);
  if (abans) await abans(context);
  await page.goto(servidor.url);
  await page.waitForSelector('#proper-parada[data-num]', { state: 'attached' });
  return { context, page, errors };
}

async function triaParada(page, num) {
  await page.click('#triador summary');
  await page.fill('#cerca', String(num));
  await page.click(`#llista-parades button[data-num="${num}"]`);
  await page.waitForFunction((n) => document.querySelector('#proper-parada').dataset.num === String(n), num);
}

const proper = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return {
    parada: q('#proper-parada').dataset.num,
    hora: q('#proper-hora').dataset.hora,
    data: q('#proper-hora').dataset.data,
    minuts: q('#proper-compte').dataset.minuts,
    compte: q('#proper-compte').textContent,
    textHora: q('#proper-hora').textContent,
    avis: q('#proper-avis').hidden ? '' : q('#proper-avis').textContent,
  };
});

async function vesA(page, vista) {
  await page.evaluate((v) => { location.hash = '#' + v; }, vista);
  await page.waitForFunction((v) => !document.querySelector('#vista-' + v).hidden, vista);
  if (vista === 'mapa') {
    await page.waitForFunction(() => document.querySelector('#mapa.leaflet-container .leaflet-marker-icon') || !document.querySelector('#mapa-avis').hidden);
  }
}

const esperaServiceWorker = (page) => page.evaluate(async () => {
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise((resol) => navigator.serviceWorker.addEventListener('controllerchange', resol, { once: true }));
  }
});

test('1. Dilluns 2026-11-02 a les 07:20, parada 1 → pròxim bus a les 7.30, falten 10 min', async () => {
  const { context, page } = await obri({ hora: madrid('2026-11-02', '07:20') });
  await triaParada(page, 1);
  const r = await proper(page);
  assert.deepEqual(
    { parada: r.parada, data: r.data, hora: r.hora, minuts: r.minuts, compte: r.compte, textHora: r.textHora },
    { parada: '1', data: '2026-11-02', hora: '07:30', minuts: '10', compte: '10 min', textHora: 'a les 7.30' },
  );
  await context.close();
});

test('2. Divendres 2026-11-06 a les 18:40, parada 1 → pròxim bus dissabte a les 9.00', async () => {
  const { context, page } = await obri({ hora: madrid('2026-11-06', '18:40') });
  await triaParada(page, 1);
  const r = await proper(page);
  assert.equal(r.data, '2026-11-07');
  assert.equal(new Date(`${r.data}T12:00:00Z`).getUTCDay(), 6, 'ha de ser dissabte');
  assert.equal(r.hora, '09:00');
  assert.equal(r.textHora, 'demà a les 9.00');
  assert.equal(r.avis, 'Hui ja no hi ha més busos: demà a les 9.00.');
  await context.close();
});

test('3. Dissabte 2026-11-07 a les 10:00, parada 1 → 11.00', async () => {
  const { context, page } = await obri({ hora: madrid('2026-11-07', '10:00') });
  await triaParada(page, 1);
  const r = await proper(page);
  assert.deepEqual({ data: r.data, hora: r.hora, minuts: r.minuts, textHora: r.textHora },
    { data: '2026-11-07', hora: '11:00', minuts: '60', textHora: 'a les 11.00' });
  await context.close();
});

test('4. Dia laborable de festius.json → horari de festius', async () => {
  const festiu = festius.festius.find((f) => f.data >= servei.vigent_des_de && [1, 2, 3, 4, 5].includes(new Date(`${f.data}T12:00:00Z`).getUTCDay()));
  assert.ok(festiu, 'cal algun festiu en dia laborable dins del període del servei');
  const esperada = servei.eixides.caps_de_setmana_i_festius.find((h) => h >= '08:00');
  const laborable = servei.eixides.laborables.find((h) => h >= '08:00');
  assert.notEqual(esperada, laborable, 'les dues taules han de donar hores diferents perquè el test discrimine');
  const { context, page } = await obri({ hora: madrid(festiu.data, '08:00') });
  await triaParada(page, 1);
  const r = await proper(page);
  assert.deepEqual({ data: r.data, hora: r.hora }, { data: festiu.data, hora: esperada });
  await vesA(page, 'horari');
  const h = await page.evaluate(() => ({
    taulaHui: document.querySelector('#horari-taules table.hui').dataset.tipus,
    text: document.querySelector('#horari-hui').textContent,
  }));
  assert.equal(h.taulaHui, 'caps_de_setmana_i_festius');
  assert.ok(h.text.includes(festiu.nom.va), h.text);
  await context.close();
});

test('5. Zona America/New_York, dilluns a les 12:00 de Madrid, parada 1 → 12.30', async () => {
  const { context, page } = await obri({ hora: madrid('2026-11-02', '12:00'), zona: 'America/New_York' });
  await triaParada(page, 1);
  const r = await page.evaluate(() => ({
    zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hora: document.querySelector('#proper-hora').dataset.hora,
    textHora: document.querySelector('#proper-hora').textContent,
  }));
  assert.deepEqual(r, { zona: 'America/New_York', hora: '12:30', textHora: 'a les 12.30' });
  await context.close();
});

test('6. Geolocalització en les coordenades de la parada 8 → la més propera és la 8', async () => {
  const p8 = parada(8);
  const { context, page } = await obri({ hora: madrid('2026-11-02', '09:00'), geolocation: { latitude: p8.lat, longitude: p8.lon } });
  await page.click('#boto-ubicacio');
  await page.waitForSelector('#llista-properes li');
  const r = await page.evaluate(() => ({
    triada: document.querySelector('#proper-parada').dataset.num,
    properes: [...document.querySelectorAll('#llista-properes button')].map((b) => b.dataset.num),
    detall: document.querySelector('#llista-properes .detall').textContent,
  }));
  assert.equal(r.triada, '8');
  assert.equal(r.properes[0], '8');
  assert.equal(r.properes.length, 3, 'la més propera i 2 alternatives');
  // Sense xarxa de carrers (data/carrers.json buit): línia recta corregida i marcada com a aproximada.
  assert.match(r.detall, /^0 m · uns 0 min a peu \(aprox\.\)$/);
  await context.close();

  // Amb xarxa de carrers: distància pel carrer, calculada en el mòbil. Xarxa de prova en L
  // que va de la parada 8 a la 9 passant per la cantonada (lat de la 9, lon de la 8).
  const p9 = parada(9);
  const e5 = (x) => Math.round(x * 1e5);
  const cantonada = { lat: p9.lat, lon: p8.lon };
  const tram = (a, b) => Math.round(2 * 6371008.8 * Math.asin(Math.sqrt(Math.sin((b.lat - a.lat) * Math.PI / 360) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin((b.lon - a.lon) * Math.PI / 360) ** 2)));
  const xarxa = {
    nodes: [e5(p8.lat), e5(p8.lon), e5(cantonada.lat), e5(cantonada.lon), e5(p9.lat), e5(p9.lon)],
    arestes: [0, 1, tram(p8, cantonada), 1, 2, tram(cantonada, p9)],
  };
  const segon = await obri({
    hora: madrid('2026-11-02', '09:00'),
    geolocation: { latitude: p8.lat, longitude: p8.lon },
    abans: (context) => context.route('**/data/carrers.json', (ruta) => ruta.fulfill({ json: xarxa })),
  });
  await segon.page.click('#boto-ubicacio');
  await segon.page.waitForSelector('#llista-properes li');
  const primera = await segon.page.evaluate(() => document.querySelector('#llista-properes button').dataset.num);
  assert.equal(primera, '8');
  await triaParada(segon.page, 9);
  const apeu = await segon.page.evaluate(() => document.querySelector('#ubic-apeu').textContent);
  const metres9 = xarxa.arestes[2] + xarxa.arestes[5];
  const recta9 = Math.ceil(tram(p8, p9) * 1.3 / 75);
  assert.notEqual(Math.ceil(metres9 / 75), recta9, 'la xarxa de prova ha de donar un resultat diferent de la línia recta');
  assert.match(apeu, new RegExp(`uns ${Math.ceil(metres9 / 75)} min`), apeu);
  await segon.context.close();
});

test('7. De la parada 9 a la parada 1 → arribada aproximada segons els minuts de servei.json', async () => {
  const origen = parada(9);
  const desti = parada(1);
  const { context, page } = await obri({ hora: madrid('2026-11-02', '08:00') });
  await vesA(page, 'anar');
  await page.selectOption('#anar-origen', origen.punt);
  await page.selectOption('#anar-desti', desti.punt);
  await page.waitForSelector('#anar-arribada');
  const r = await page.evaluate(() => {
    const dades = (id) => (document.querySelector(id) ? { ...document.querySelector(id).dataset } : null);
    return { puja: dades('#anar-puja'), arribada: dades('#anar-arribada'), eixida: dades('#anar-eixida'), text: document.querySelector('#anar-arribada').textContent };
  });
  // Com que és un circuit, la parada 1 com a destí és la del final del recorregut.
  const i = servei.parades.indexOf(origen);
  const final = servei.parades.find((p, j) => j > i && p.punt === desti.punt);
  assert.equal(r.puja.num, '9');
  assert.equal(r.arribada.num, String(final.num));
  if (origen.minuts_des_de_eixida != null && final.minuts_des_de_eixida != null) {
    const eixida = servei.eixides.laborables.find((h) => minuts(h) + origen.minuts_des_de_eixida >= minuts('08:00'));
    assert.deepEqual(r.puja, { num: '9', hora: hhmm(minuts(eixida) + origen.minuts_des_de_eixida), data: '2026-11-02' });
    assert.deepEqual(r.arribada, { num: String(final.num), hora: hhmm(minuts(eixida) + final.minuts_des_de_eixida), data: '2026-11-02' });
    assert.match(r.text, /aprox\.$/);
  } else {
    // Sense hores de pas conegudes, no s'inventa l'arribada: es dona la pròxima eixida de la parada 1.
    assert.equal(r.arribada.hora, undefined);
    assert.deepEqual(r.eixida, { hora: servei.eixides.laborables.find((h) => h >= '08:00'), data: '2026-11-02' });
  }
  await context.close();
});

test('8. Sense connexió, després d\'una primera visita: pròxim bus i horari visibles i avís en el mapa', async () => {
  const propi = await iniciaServidor();
  const { context, page } = await obri({ hora: madrid('2026-11-02', '09:00'), servidor: propi });
  await esperaServiceWorker(page);
  await propi.tanca();
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#proper-hora[data-hora]');
  const r = await page.evaluate(() => ({
    enLinia: navigator.onLine,
    hora: document.querySelector('#proper-hora').dataset.hora,
    xarxa: document.querySelector('#estat-xarxa').hidden ? '' : document.querySelector('#estat-xarxa').textContent,
  }));
  assert.equal(r.enLinia, false);
  assert.equal(r.hora, '09:30');
  assert.match(r.xarxa, /^Sense connexió: es mostren les dades desades el \d+-\d+-\d{4} a les \d+\.\d\d\.$/);
  await vesA(page, 'horari');
  const files = await page.evaluate(() => document.querySelectorAll('#horari-taules tbody tr').length);
  assert.equal(files, servei.eixides.laborables.length + servei.eixides.caps_de_setmana_i_festius.length);
  await vesA(page, 'mapa');
  const avis = await page.evaluate(() => (document.querySelector('#mapa-avis').hidden ? '' : document.querySelector('#mapa-avis').textContent));
  assert.match(avis, /^Sense connexió: el mapa no es pot carregar/);
  await context.close();
});

test('9. Valencià → castellà → anglès sense claus sense traduir, i l\'idioma es manté', async () => {
  const claus = Object.keys(TEXTOS.va);
  assert.deepEqual(Object.keys(TEXTOS.es).sort(), [...claus].sort());
  assert.deepEqual(Object.keys(TEXTOS.en).sort(), [...claus].sort());
  const p5 = parada(5);
  const { context, page } = await obri({ hora: madrid('2026-11-02', '09:00'), geolocation: { latitude: p5.lat, longitude: p5.lon } });
  await page.click('#boto-ubicacio');
  await page.waitForSelector('#llista-properes li');
  const escaneja = () => page.evaluate((claus) => {
    const atributs = [...document.querySelectorAll('[aria-label], [title], [placeholder], [alt]')]
      .map((e) => ['aria-label', 'title', 'placeholder', 'alt'].map((a) => e.getAttribute(a) || '').join(' '));
    const text = [document.title, document.body.innerText].concat(atributs).join('\n');
    return {
      lang: document.documentElement.lang,
      claus: claus.filter((c) => text.includes(c)),
      plantilles: text.match(/\{\w+\}/g) || [],
    };
  }, claus);
  for (const [boto, lang, nav] of [[null, 'ca-ES-valencia', 'Horari'], ['es', 'es', 'Horario'], ['en', 'en', 'Timetable']]) {
    if (boto) {
      await page.click('#idioma-boto');
      await page.click(`#idioma-menu button[data-idioma="${boto}"]`);
    }
    for (const vista of VISTES) {
      await vesA(page, vista);
      if (vista === 'anar') await page.selectOption('#anar-desti', parada(9).punt);
      const r = await escaneja();
      assert.deepEqual(r, { lang, claus: [], plantilles: [] }, `${lang} · ${vista}`);
    }
    const textNav = await page.evaluate(() => document.querySelector('a[data-vista="horari"]').textContent);
    assert.equal(textNav, nav);
  }
  // En anglès, el nom oficial en valencià.
  await vesA(page, 'proper');
  const nomEn = await page.evaluate(() => document.querySelector('#proper-parada').textContent);
  assert.ok(nomEn.includes(p5.nom.va), nomEn);
  await page.reload();
  await page.waitForSelector('#proper-parada[data-num]');
  const desat = await page.evaluate(() => ({ lang: document.documentElement.lang, nav: document.querySelector('a[data-vista="horari"]').textContent }));
  assert.deepEqual(desat, { lang: 'en', nav: 'Timetable' });
  await context.close();
});

test('10. axe sense violacions serious/critical, sense desplaçament horitzontal a 360 i 1280 px i sense errors de consola', async () => {
  const p8 = parada(8);
  for (const amplada of [360, 1280]) {
    const { context, page, errors } = await obri({ hora: madrid('2026-11-02', '09:00'), amplada, geolocation: { latitude: p8.lat + 0.002, longitude: p8.lon } });
    const problemes = [];
    const revisa = async (on) => {
      const resultat = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      resultat.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .forEach((v) => problemes.push(`${amplada}px · ${on} · ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
      const desborda = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (desborda > 0) problemes.push(`${amplada}px · ${on} · desplaçament horitzontal de ${desborda}px`);
    };
    await page.click('#boto-ubicacio');
    await page.waitForSelector('#llista-properes li');
    await page.click('#boto-favorita');
    await page.waitForSelector('#llista-favorites li');
    await page.click('#idioma-boto');
    await revisa('menú d\'idioma obert');
    await page.keyboard.press('Escape');
    await page.click('#triador summary');
    for (const vista of VISTES) {
      await vesA(page, vista);
      if (vista === 'anar') await page.selectOption('#anar-desti', parada(1).punt);
      await revisa(vista);
    }
    // Modes d'alt contrast i de text gran (P2)
    await vesA(page, 'sobre');
    await page.click('[data-mode="contrast"]');
    await page.click('[data-mode="text"]');
    for (const vista of ['proper', 'horari', 'sobre']) {
      await vesA(page, vista);
      await revisa(`${vista} (alt contrast i text gran)`);
    }
    // Mode fosc
    await page.click('[data-mode="contrast"]');
    await page.click('[data-mode="text"]');
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const vista of ['proper', 'horari', 'linia', 'mapa', 'sobre']) {
      await vesA(page, vista);
      await revisa(`${vista} (mode fosc)`);
    }
    // Cartells per a imprimir (P2)
    for (const ruta of ['cartells.html?parada=8', 'cartells.html']) {
      await page.goto(srv.url + ruta);
      await page.waitForSelector('.cartell img');
      const qr = await page.evaluate(() => Promise.all([...document.querySelectorAll('.cartell img')].map((img) => (img.complete
        ? img.naturalWidth > 0
        : new Promise((resol) => { img.onload = () => resol(true); img.onerror = () => resol(false); })))));
      if (!qr.length || qr.includes(false)) problemes.push(`${amplada}px · ${ruta} · codis QR que no es carreguen`);
      await revisa(ruta);
    }
    assert.deepEqual(problemes, []);
    assert.deepEqual(errors, [], 'errors de consola');
    await context.close();
  }
});

test('11. El manifest és vàlid i el service worker controla la pàgina', async () => {
  const { context, page } = await obri({ hora: madrid('2026-11-02', '09:00') });
  await esperaServiceWorker(page);
  const sw = await page.evaluate(async () => {
    const registre = await navigator.serviceWorker.ready;
    return {
      controlada: Boolean(navigator.serviceWorker.controller),
      script: navigator.serviceWorker.controller.scriptURL,
      abast: registre.scope,
      base: new URL('./', location.href).href,
    };
  });
  assert.equal(sw.controlada, true);
  assert.equal(sw.script, sw.base + 'sw.js');
  assert.equal(sw.abast, sw.base);

  const cdp = await context.newCDPSession(page);
  const app = await cdp.send('Page.getAppManifest');
  assert.deepEqual(app.errors, [], 'errors del manifest segons Chromium');
  const instal = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(instal.installabilityErrors, [], 'errors d\'instal·lació segons Chromium');

  const m = JSON.parse(app.data);
  assert.ok(m.name && m.short_name, 'name i short_name');
  assert.equal(m.display, 'standalone');
  assert.equal(new URL(m.start_url, app.url).href, sw.base);
  const icones = await page.evaluate(async (llista) => Promise.all(llista.map(async (i) => {
    const res = await fetch(i.src);
    const imatge = await createImageBitmap(await res.blob());
    return { src: i.src, sizes: i.sizes, purpose: i.purpose || 'any', tipus: res.headers.get('content-type'), real: `${imatge.width}x${imatge.height}` };
  })), m.icons);
  for (const i of icones) assert.equal(i.real, i.sizes, i.src);
  assert.ok(icones.some((i) => i.sizes === '192x192' && i.purpose === 'any' && i.tipus === 'image/png'), 'icona de 192');
  assert.ok(icones.some((i) => i.sizes === '512x512' && i.purpose === 'any' && i.tipus === 'image/png'), 'icona de 512');
  assert.ok(icones.some((i) => i.purpose === 'maskable'), 'icona maskable');
  const apple = await page.evaluate(async () => {
    const enllac = document.querySelector('link[rel="apple-touch-icon"]');
    const imatge = await createImageBitmap(await (await fetch(enllac.href)).blob());
    return `${imatge.width}x${imatge.height}`;
  });
  assert.equal(apple, '180x180');
  await context.close();
});

// Comprovació addicional de les restriccions: la primera visita (pàgina i memòria
// cau del service worker) ha d'ocupar menys de 300 KB sense comprimir. Es compten
// els bytes que envia el servidor. Ací no s'intercepten peticions, perquè Playwright
// desactivaria la memòria cau HTTP; es comprova que la vista inicial no demana tessel·les.
test('Restricció: la primera càrrega ocupa menys de 300 KB', async (t) => {
  const propi = await iniciaServidor();
  const context = await navegador.newContext({ timezoneId: 'Europe/Madrid', locale: 'ca-ES', viewport: { width: 360, height: 740 } });
  let tesseles = 0;
  context.on('request', (req) => { if (TESSELES.test(req.url())) tesseles += 1; });
  const page = await context.newPage();
  await page.clock.setFixedTime(madrid('2026-11-02', '09:00'));
  await page.goto(propi.url);
  await esperaServiceWorker(page);
  while (Date.now() - propi.comptador.darrera < 1500) await new Promise((r) => setTimeout(r, 250));
  const { bytes, peticions } = propi.comptador;
  t.diagnostic(`primera càrrega: ${(bytes / 1024).toFixed(1)} KB en ${peticions} peticions`);
  assert.equal(tesseles, 0, 'la vista inicial no ha de demanar tessel·les');
  assert.ok(bytes < 300 * 1024, `${(bytes / 1024).toFixed(1)} KB`);
  await context.close();
  await propi.tanca();
});

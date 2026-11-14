// Compartit per l'app, el service worker clàssic i les proves.
(() => {
  const text = (x) => typeof x === 'string' && x.trim() !== '';
  const traduccions = (x, idiomes) => idiomes.every((idioma) => text(x?.[idioma]));
  const entre = (x, min, max) => Number.isFinite(x) && x >= min && x <= max;

  function data(x) {
    if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
    const ms = Date.parse(x);
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === x;
  }

  const hores = (x) => Array.isArray(x) && x.every((h) => typeof h === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(h));
  const coordenades = (lat, lon) => entre(lat, -90, 90) && entre(lon, -180, 180);
  const nomParada = (x) => traduccions(x, ['va', 'es']);
  const textInterficie = (x) => traduccions(x, ['va', 'es', 'en']);
  const datesOrdenades = (inici, fi) => data(inici) && (fi == null || (data(fi) && inici <= fi));
  const adrecaWeb = (x) => text(x) && /^https?:\/\//i.test(x);

  function servei(x) {
    if (!x || !datesOrdenades(x.vigent_des_de, x.vigent_fins_a) ||
        !Number.isFinite(x.durada_volta_minuts) || x.durada_volta_minuts <= 0 ||
        typeof x.gratuit !== 'boolean' || !hores(x.eixides?.laborables) || !hores(x.eixides?.caps_de_setmana_i_festius)) return false;
    const font = x.font;
    if (!text(font?.titol) || !data(font.data_avis) || !data(font.comprovat) || !adrecaWeb(font.url?.va) || !adrecaWeb(font.url?.es) ||
        (x.contacte != null && !adrecaWeb(x.contacte) && !(text(x.contacte) && /^mailto:/i.test(x.contacte)))) return false;
    const ps = x.parades;
    return Array.isArray(ps) && ps.length >= 2 && ps.every((p) =>
      Number.isSafeInteger(p?.num) && p.num > 0 && text(p.punt) && nomParada(p.nom) && coordenades(p.lat, p.lon) &&
      (p.minuts_des_de_eixida == null || (Number.isInteger(p.minuts_des_de_eixida) && p.minuts_des_de_eixida >= 0))) &&
      new Set(ps.map((p) => p.num)).size === ps.length;
  }

  const llista = (x, valida) => Array.isArray(x) && x.every(valida);

  function recorregut(x) {
    return x?.type === 'FeatureCollection' && x.features?.length > 0 && llista(x.features, (f) =>
      f?.type === 'Feature' && text(f.properties?.origen) && f.geometry?.type === 'LineString' &&
      f.geometry.coordinates?.length >= 2 && llista(f.geometry.coordinates, (c) => Array.isArray(c) && coordenades(c[1], c[0])));
  }

  function carrers(x) {
    if (!Array.isArray(x?.nodes) || x.nodes.length % 2 || !Array.isArray(x.arestes) || x.arestes.length % 3) return false;
    const n = x.nodes.length / 2;
    return x.nodes.every((v, i) => entre(v, i % 2 ? -180e5 : -90e5, i % 2 ? 180e5 : 90e5)) &&
      x.arestes.every((v, i) => Number.isSafeInteger(v) && v >= 0 && (i % 3 === 2 || v < n));
  }

  const validadors = new Map([
    ['data/servei.json', servei],
    ['data/festius.json', (x) => (x?.comprovat == null || data(x.comprovat)) &&
      llista(x?.festius, (f) => data(f?.data) && textInterficie(f.nom))],
    ['data/avisos.json', (x) => llista(x?.avisos, (a) => datesOrdenades(a?.inici, a?.fi) && textInterficie(a.text))],
    ['data/recorregut.geojson', recorregut],
    ['data/carrers.json', carrers],
  ]);

  globalThis.validaDadesBusOliva = (ruta, json) => validadors.get(ruta)?.(json) === true;
})();

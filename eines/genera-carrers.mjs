// Genera data/carrers.json: la xarxa de carrers i camins per on es pot anar a peu
// al voltant de les parades, a partir d'OpenStreetMap (Overpass). L'app la fa servir
// per a calcular en el mòbil la distància a peu pel carrer fins a cada parada.
// Ús: npm run carrers   (cal connexió)
import { readFileSync, writeFileSync } from 'node:fs';

const MARGE = 0.01; // graus al voltant de les parades (≈ 1 km)
const servei = JSON.parse(readFileSync(new URL('../data/servei.json', import.meta.url), 'utf8'));
const lats = servei.parades.map((p) => p.lat);
const lons = servei.parades.map((p) => p.lon);
const caixa = [Math.min(...lats) - MARGE, Math.min(...lons) - MARGE, Math.max(...lats) + MARGE, Math.max(...lons) + MARGE].join(',');

const consulta = `[out:json][timeout:90];
way["highway"]["highway"!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed|bus_guideway|raceway)$"]["foot"!~"^(no|private)$"]["access"!~"^(no|private)$"](${caixa});
(._;>;);
out skel qt;`;

const resposta = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'data=' + encodeURIComponent(consulta),
});
if (!resposta.ok) throw new Error(`Overpass ha respost ${resposta.status}`);
const osm = await resposta.json();

const coords = new Map();
const camins = [];
for (const e of osm.elements) {
  if (e.type === 'node') coords.set(e.id, [e.lat, e.lon]);
  else if (e.type === 'way') camins.push(e.nodes);
}

// Només es guarden els encreuaments i els extrems; la resta del traçat es resumeix en metres.
const usos = new Map();
for (const c of camins) c.forEach((id, i) => usos.set(id, (usos.get(id) || 0) + (i === 0 || i === c.length - 1 ? 2 : 1)));
const rad = Math.PI / 180;
const metres = (a, b) => {
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
};
const index = new Map();
const nodes = [];
const arestes = [];
const node = (id) => {
  if (!index.has(id)) {
    index.set(id, nodes.length / 2);
    const [lat, lon] = coords.get(id);
    nodes.push(Math.round(lat * 1e5), Math.round(lon * 1e5));
  }
  return index.get(id);
};
for (const c of camins) {
  let inici = c[0];
  let llarg = 0;
  for (let i = 1; i < c.length; i++) {
    llarg += metres(coords.get(c[i - 1]), coords.get(c[i]));
    if (usos.get(c[i]) > 1 || i === c.length - 1) {
      if (inici !== c[i]) arestes.push(node(inici), node(c[i]), Math.round(llarg));
      inici = c[i];
      llarg = 0;
    }
  }
}

writeFileSync(new URL('../data/carrers.json', import.meta.url), JSON.stringify({
  nota: `Xarxa de carrers per a la distància a peu, generada el ${new Date().toISOString().slice(0, 10)} amb npm run carrers. Dades © col·laboradors d'OpenStreetMap (ODbL).`,
  nodes,
  arestes,
}) + '\n');
console.log(`data/carrers.json: ${nodes.length / 2} nodes i ${arestes.length / 3} trams`);

// Genera data/recorregut.geojson a partir de les parades de data/servei.json.
// Intenta calcular el traçat per carrers amb OSRM. Si no hi ha xarxa, desa
// línies rectes entre parades i ho marca amb "origen": "linies-rectes".
// L'app només llig este fitxer estàtic: mai crida OSRM mentre funciona.
// Ús: npm run recorregut
import { readFileSync, writeFileSync } from 'node:fs';

const servei = JSON.parse(readFileSync(new URL('../data/servei.json', import.meta.url), 'utf8'));
const punts = servei.parades.map((p) => [p.lon, p.lat]);
const arrodoneix = (c) => [+c[0].toFixed(5), +c[1].toFixed(5)];

let coordenades = punts.map(arrodoneix);
let origen = 'linies-rectes';
try {
  const url = 'https://router.project-osrm.org/route/v1/driving/' +
    punts.map((c) => c.join(',')).join(';') + '?overview=full&geometries=geojson';
  const control = new AbortController();
  const temps = setTimeout(() => control.abort(), 20000);
  const resposta = await fetch(url, { signal: control.signal });
  clearTimeout(temps);
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const json = await resposta.json();
  if (json.code !== 'Ok') throw new Error(json.code);
  coordenades = json.routes[0].geometry.coordinates.map(arrodoneix)
    .filter((c, i, tots) => i === 0 || c[0] !== tots[i - 1][0] || c[1] !== tots[i - 1][1]);
  origen = 'osrm';
} catch (error) {
  console.warn(`No s'ha pogut usar OSRM (${error.message}): es desen línies rectes entre parades.`);
}

const geojson = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { origen, generat: new Date().toISOString().slice(0, 10) },
    geometry: { type: 'LineString', coordinates: coordenades },
  }],
};
writeFileSync(new URL('../data/recorregut.geojson', import.meta.url), JSON.stringify(geojson) + '\n');
console.log(`data/recorregut.geojson: ${coordenades.length} punts (origen: ${origen})`);

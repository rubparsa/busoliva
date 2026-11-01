// Copia Leaflet a vendor/ i les fonts (via @fontsource) a fonts/.
// Ús: npm install && npm run vendor
import { copyFileSync, mkdirSync } from 'node:fs';

const arrel = new URL('../', import.meta.url);
const copia = (origen, desti) => {
  const d = new URL(desti, arrel);
  mkdirSync(new URL('./', d), { recursive: true });
  copyFileSync(new URL(origen, arrel), d);
  console.log(`${origen} → ${desti}`);
};

copia('node_modules/leaflet/dist/leaflet.js', 'vendor/leaflet/leaflet.js');
copia('node_modules/leaflet/dist/leaflet.css', 'vendor/leaflet/leaflet.css');
copia('node_modules/leaflet/LICENSE', 'vendor/leaflet/LICENSE');
copia('node_modules/@fontsource/lexend/files/lexend-latin-400-normal.woff2', 'fonts/lexend-latin-400-normal.woff2');
copia('node_modules/@fontsource/lexend/LICENSE', 'fonts/LICENSE-lexend.txt');
copia('node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2', 'fonts/archivo-black-latin-400-normal.woff2');
copia('node_modules/@fontsource/archivo-black/LICENSE', 'fonts/LICENSE-archivo-black.txt');

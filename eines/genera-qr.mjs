// Genera els codis QR dels cartells (qr/parada-N.svg): un per parada, amb
// l'enllaç a l'app en eixa parada (?parada=N). Es fan en local, sense cap servei extern.
// Ús: npm run qr  ·  amb una altra adreça: URL_APP=https://exemple.org/busoliva/ npm run qr
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const base = process.env.URL_APP || 'https://rubparsa.github.io/busoliva/';
const servei = JSON.parse(readFileSync(new URL('../data/servei.json', import.meta.url), 'utf8'));
mkdirSync(new URL('../qr/', import.meta.url), { recursive: true });
for (const parada of servei.parades.slice(0, -1)) {
  const url = new URL('?parada=' + parada.num, base).href;
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
  writeFileSync(new URL(`../qr/parada-${parada.num}.svg`, import.meta.url), svg + '\n');
  console.log(`qr/parada-${parada.num}.svg → ${url}`);
}

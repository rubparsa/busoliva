// Servidor estàtic mínim per a provar l'app sota /busoliva/, com en GitHub Pages.
// Ús: npm start → http://localhost:8080/busoliva/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARREL = fileURLToPath(new URL('../', import.meta.url));
const PREFIX = '/busoliva/';
const TIPUS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function iniciaServidor(port = 0, respon) {
  const comptador = { peticions: 0, bytes: 0, darrera: Date.now() };
  const servidor = createServer(async (req, res) => {
    comptador.peticions += 1;
    comptador.darrera = Date.now();
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/busoliva') {
      res.writeHead(302, { Location: PREFIX });
      res.end();
      return;
    }
    if (respon?.(url, res)) return;
    let ruta = url.pathname.startsWith(PREFIX) ? decodeURIComponent(url.pathname.slice(PREFIX.length)) : null;
    if (ruta === '' || (ruta && ruta.endsWith('/'))) ruta += 'index.html';
    const fitxer = ruta && normalize(join(ARREL, ruta));
    const prohibit = !ruta || !fitxer.startsWith(ARREL) || ruta.split('/').some((part) => part.startsWith('.') || part === 'node_modules');
    try {
      if (prohibit) throw new Error('prohibit');
      const info = await stat(fitxer);
      const etag = `W/"${info.size}-${Math.round(info.mtimeMs)}"`;
      const capcaleres = { 'Content-Type': TIPUS[extname(fitxer)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag };
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, capcaleres);
        res.end();
        return;
      }
      const cos = await readFile(fitxer);
      comptador.bytes += cos.length;
      res.writeHead(200, capcaleres);
      res.end(cos);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No trobat');
    }
  });
  return new Promise((ok) => {
    servidor.listen(port, '127.0.0.1', () => ok({
      url: `http://127.0.0.1:${servidor.address().port}${PREFIX}`,
      comptador,
      tanca: () => new Promise((tancat) => { servidor.closeAllConnections(); servidor.close(tancat); }),
    }));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].split(sep).join(sep)) {
  const { url } = await iniciaServidor(Number(process.env.PORT) || 8080);
  console.log(`App servida en ${url}`);
}

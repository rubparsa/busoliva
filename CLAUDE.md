# Bus poble ⇄ platja · Oliva — estat del projecte

PWA no oficial amb l'horari del servei especial d'autobús de la DANA (Oliva). Publicada amb GitHub Pages des de `main`: https://rubparsa.github.io/busoliva/. El README explica l'ús i el manteniment.

## Com treballar
- Parla amb l'usuari en valencià. **No inventes dades del servei**: el que no isca de l'avís oficial o de l'usuari, pregunta-ho.
- Abans de canvis visuals grans, ensenya una maqueta o una captura i espera el vistiplau.
- Git: es treballa en la branca de la sessió i, quan l'usuari ho demana, es puja també a `main` (`git push origin <branca>:main`). L'usuari de vegades edita `main` directament: fes `git fetch` i integra abans de pujar.
- Si canvies l'app (HTML, CSS, JS, icones), puja `VERSIO` en `sw.js` (ara `'9'`). Per a canvis només en `data/*.json` no cal.
- No deixes fitxers temporals (maquetes, captures) dins del repositori.

## Decisions preses
- **Dades** (`data/`):
  - `servei.json`:
    - noms oficials de les 20 parades en valencià i castellà; en anglès es mostra el valencià;
    - `minuts_des_de_eixida` val `null` en totes les parades llevat de la 1: no hi ha hores de pas estimades. Per a les parades intermèdies es mostra l'hora d'eixida de la parada 1, amb una nota;
    - `durada_volta_minuts: 60` ix de l'avís («aproximadament una hora»);
    - `contacte` és un `mailto:` a l'adreça de l'usuari.
  - `festius.json`:
    - nacionals i autonòmics de 2026–2027 (BOE i DOGV, llegits a través del cercador);
    - locals de 2026: 17-07 i 08-09. **El 7-12-2026 no és festiu.**
  - `avisos.json`: buit a petició de l'usuari.
  - `recorregut.geojson`: traçat calculat amb OSRM.
  - `carrers.json`: encara buit. Mentre ho estiga, la distància a peu és la línia recta × 1,3, marcada «aprox.».
- **Parades 5/14, 6/13 i 7/12**: són parades diferents, en voreres contràries de la mateixa carretera. Es mostren com «A l'altra vorera».
- **Parades a la mateixa distància** (el mateix temps a peu): si fa menys d'una volta que ha eixit un bus, va primer la més avançada en el recorregut; si no, la més pròxima a l'eixida.
- **Text**: cap frase pot donar a entendre que és temps real, i les notes només diuen el que diu l'avís.
- **Estil**:
  - colors de juliol en variables CSS (`--ink`, `--mar`, `--teal`, `--sand`, `--coral`), amb variants per al contrast AA (`--coral-fosc`, `--vora`);
  - mode fosc (segueix el sistema o es força) i alt contrast;
  - tipografies Lexend 400 i Archivo Black.
- **Icona**: `icons/icona.svg` és de l'usuari (un bus vist de front). La capçalera l'enllaça directament. Les PNG (192, 512, maskable i apple-touch) s'han de regenerar si canvia l'SVG.
- **Capçalera**:
  - en pantalles amples: títol, tres botons (contrast, text gran, sol/lluna) i idioma amb bandera i codi;
  - fins a 36rem d'ample: títol en dues línies, menú «Aa» (amb les icones de contrast, sol/lluna i Aa) i idioma només amb bandera.
- **Navegació**: Pròxim bus · On vols anar? · Horari · Mapa · Línia. Al peu: Sobre l'app · Avisa d'un error · Instal·la l'app.
- **Estructura**:
  - `index.html` és una SPA amb vistes per hash;
  - `js/servei.js` conté la lògica (hora de Madrid, passades, viatges, distàncies);
  - `js/app.js` és la interfície i `js/i18n.js` els textos (va/es/en);
  - `js/mapa.js` (Leaflet, carregat en diferit) i `js/diagrama.js` (SVG);
  - `cartells.html` i `js/cartells.js` són els cartells A4 amb QR (`qr/`);
  - `sw.js` és el service worker;
  - `eines/` conté l'editor de parades i els scripts.

## Proves
- `npm test`: 11 tests d'acceptació i la comprovació de pes (menys de 300 KB). Usa node:test, Playwright i axe; també s'executen en GitHub Actions.
- `playwright` està fixat a 1.63.0 perquè coincidisca amb el Chromium preinstal·lat de l'entorn. No executes `playwright install` en l'entorn.
- `npm start` serveix l'app en http://localhost:8080/busoliva/.
- Els scripts amb xarxa necessiten `NODE_USE_ENV_PROXY=1` en l'entorn. OSRM funciona; Overpass talla la connexió.

## Pendent
- L'usuari ha de corregir les coordenades de les parades amb l'editor (les de la 15 i la 18 són provisionals).
- Generar `data/carrers.json` amb `npm run carrers` (Overpass falla des de l'entorn).
- Festius locals de 2027, quan es publiquen.
- La versió 2 (rutes en transport públic des d'Oliva fins a Gandia, l'hospital o València) està aparcada.

## No tocar
- No afegir dependències en execució més enllà de Leaflet i de les fonts del repositori, ni res de CDN, backend, comptes, analítica o push.
- No tornar a posar minuts de pas estimats ni hores d'arribada inventades.
- No canviar els noms oficials de les parades, els horaris ni els festius sense font o sense confirmació de l'usuari.
- No substituir la icona de l'usuari.

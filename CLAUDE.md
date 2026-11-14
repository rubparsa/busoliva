# Bus poble ⇄ platja · Oliva — estat del projecte

PWA no oficial per a consultar el servei especial d’autobús entre el poble i la platja d’Oliva, posat en marxa arran de la DANA. Es publica des de `main` amb GitHub Pages en <https://busoliva.es/>. El `README.md` explica l’ús i el manteniment de l’app.

## Com treballar

- Parla amb l’usuari en valencià. Si una dada del servei no consta en l’avís oficial i l’usuari no l’ha facilitada, demana-li que la confirme.
- Abans de fer canvis visuals grans, mostra una maqueta o una captura i espera el vistiplau de l’usuari.
- Treballa en la branca de la sessió. Abans d’integrar canvis en `main`, fes `git fetch origin` i revisa els canvis que l’usuari hi haja pogut fer. Demana-li l’aprovació abans de publicar en `main`.
- Si canvies l’HTML, el CSS, el JavaScript, les icones o les fonts que precàrrega l’app, incrementa `VERSIO` en `sw.js`. Per a canvis només en `data/*.json`, no cal.
- Guarda les maquetes, les captures i altres fitxers temporals fora del repositori.

## Dades del servei

- **`data/servei.json`** conté les 20 parades i les eixides oficials des de la parada 1. Els noms de les parades estan en valencià i castellà. En la interfície anglesa es mostren en valencià.
- **Hores de pas.** `minuts_des_de_eixida` és `0` en la parada 1 i `null` en la resta. En les parades intermèdies, l’app mostra l’hora d’eixida des de la parada 1 i ho indica. `durada_volta_minuts` val `60` perquè l’avís municipal diu que la volta dura aproximadament una hora.
- **`data/festius.json`** recull festius nacionals i autonòmics de 2026 i 2027. Els locals d’Oliva de 2026 són el 17 de juliol i el 8 de setembre. El 7 de desembre de 2026 es tracta com a dia laborable.
- **`data/avisos.json`** està buit a petició de l’usuari. L’enllaç «Avisa d’un error» usa el `mailto:` configurat en `servei.json`.
- **`data/recorregut.geojson`** conté el traçat calculat amb OSRM. L’app llig el fitxer local i mostra el mapa amb Leaflet i OpenStreetMap.
- **`data/carrers.json`** conté la xarxa de carrers d’OpenStreetMap, generada amb `npm run carrers`. L’app hi calcula la distància a peu. Si el fitxer estiguera buit, usaria la línia recta multiplicada per 1,3 i la marcaria com a aproximada.
- Les coordenades de les 20 parades estan verificades per l’usuari. La 11 no coincideix amb el GTFS d’estiu: és correcta així.

## Comportament de l’app

- Les parelles 5/14, 6/13 i 7/12 són parades diferents, en voreres contràries de la mateixa carretera. L’app les relaciona en «A l’altra vorera».
- Si dues parades tenen els mateixos minuts a peu, es prioritza la més avançada del recorregut quan, segons l’horari, hi pot haver un autobús fent la volta. En la resta de casos, es prioritza la més pròxima a l’inici del recorregut.
- Els textos han de deixar clar que les indicacions es calculen a partir de l’horari. Per a publicar hores de pas o d’arribada cal disposar de dades confirmades.
- La navegació principal té cinc vistes: Pròxim bus, On vols anar?, Horari, Mapa i Línia. Al peu hi ha Sobre l’app, Avisa d’un error i Instal·la l’app.

## Disseny

- La paleta de juliol es defineix en variables CSS (`--ink`, `--mar`, `--teal`, `--sand`, `--coral`), amb variants de contrast com `--coral-fosc` i `--vora`. Les tipografies són Lexend 400 i Archivo Black.
- L’app té text gran, alt contrast i mode fosc. El mode fosc segueix la preferència del sistema fins que l’usuari en tria una.
- En pantalles amples, la capçalera mostra el títol, els tres controls de visualització i el selector d’idioma amb bandera i codi. Fins a `36rem`, el títol ocupa dues línies, els controls passen al menú «Aa» i el selector mostra visualment només la bandera.
- Conserva la icona de bus creada per l’usuari en `icons/icona.svg`. La capçalera usa l’SVG directament. Si es modifica la icona, regenera les PNG de 192 i 512 px, la versió *maskable* i la icona d’Apple.

## Estructura

| Fitxer o directori | Funció |
|---|---|
| `index.html` | Pàgina principal, amb vistes seleccionades pel fragment de l’URL. |
| `js/servei.js` | Lògica d’horaris en `Europe/Madrid`, passades, trajectes i distàncies. |
| `js/app.js` i `js/i18n.js` | Interfície i textos en valencià, castellà i anglès. |
| `js/mapa.js` i `js/diagrama.js` | Mapa Leaflet carregat en diferit i diagrama SVG disponible sense connexió. |
| `cartells.html`, `js/cartells.js` i `qr/` | Cartells A4 amb codis QR per parada. |
| `sw.js` i `manifest.webmanifest` | Memòria cau i instal·lació de la PWA. |
| `eines/` | Editor de parades i scripts de manteniment. |

## Proves i publicació

- `npm start` serveix l’app en <http://localhost:8080/busoliva/>.
- `npm test` executa les proves d’acceptació amb `node:test`, Playwright i axe, i comprova que la primera càrrega ocupa menys de 300 KB.
- La versió de Playwright està fixada en `package.json`. Si l’entorn ja té un Chromium compatible, usa’l. Si cal instal·lar-lo, seguix els passos del `README.md`.
- En entorns amb servidor intermediari, els scripts que fan peticions de xarxa poden necessitar `NODE_USE_ENV_PROXY=1`. Overpass respon 406 si la petició porta el `User-Agent` per defecte de Node; per això `eines/genera-carrers.mjs` n’envia un de propi.
- El workflow **Tests i publicació** executa les proves en cada *push* i *pull request*. El treball `publica` només s’executa en un *push* a `main` si passa `tests`. L’origen de Pages ha de ser **GitHub Actions**.

## Pendent

- Incorporar els festius locals d’Oliva de 2027 quan es confirmen.
- Les rutes en transport públic des d’Oliva fins a Gandia, l’hospital o València estan aparcades.

## Límits del projecte

- Mantín l’app estàtica. Les dependències en execució es limiten a Leaflet i les tipografies que ja estan al repositori. Evita afegir CDN, servidor propi, comptes, analítica o notificacions push.
- Canvia els noms oficials, els horaris, les hores de pas i els festius només amb una font oficial o amb confirmació de l’usuari.

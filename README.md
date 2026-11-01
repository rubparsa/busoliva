# Bus poble ⇄ platja · Oliva

App web instal·lable (PWA) **no oficial** per a consultar el servei especial i temporal d'autobús entre el poble i la platja d'Oliva. L'Ajuntament el va posar en marxa el 22-10-2026 arran de la DANA. Font: [avís oficial «DANA - Servei especial d'autobús a Oliva entre el poble i la platja»](https://www.oliva.es/va/DANA).

L'app **no sap on és l'autobús**: tot es calcula a partir de l'horari oficial, sempre en hora d'Oliva (Europe/Madrid), siga quina siga la zona horària del mòbil. L'avís oficial només dona les hores d'eixida de la parada 1 i diu que la volta dura aproximadament una hora: per a la resta de parades, l'app mostra l'hora d'eixida de la parada 1 i ho indica.

## Què fa

- **Pròxim bus**: la parada més propera (o la triada), un compte enrere, l'hora i les 3 passades següents. Avisa de l'últim bus del dia i de quan ja no en queden.
- **Parada més propera**: amb la ubicació del mòbil, que no ix del dispositiu. Mostra 2 alternatives, la distància i els minuts a peu (pel carrer si hi ha xarxa de carrers; si no, línia recta × 1,3 marcada «aprox.»), i avisa si no arribes a temps. També hi ha un selector i una cerca per nom o número.
- **On vols anar?**: tria la parada del sentit correcte (és un circuit) i dona l'hora d'arribada aproximada.
- **Horari complet**: dues taules (de dilluns a divendres; dissabtes, diumenges i festius) amb la pròxima eixida destacada.
- **Mapa** (Leaflet i OpenStreetMap; necessita connexió) i **diagrama de la línia** (funciona sense connexió).
- **Avisos** amb data d'inici i de fi i bàner del servei temporal. La data de comprovació i l'enllaç a la font són en «Sobre l'app» i en els cartells.
- **Tres idiomes**: valencià (per defecte), castellà i anglès. Es recorda l'idioma triat.
- **Sense connexió**: funciona tot menys el mapa i avisa de la data de les dades desades. Avisa quan hi ha una versió nova i explica com instal·lar-la en iOS.
- **Favorites** (fins a 3), **compartir una parada** (`?parada=N`), **cartells A4 amb codi QR** (`cartells.html`) i modes d'**alt contrast**, **text gran** i **fosc** (per defecte segueix el del mòbil).

## Estructura

```
index.html             l'app
cartells.html          cartells A4 per a imprimir, un per parada
css/  js/              estil i codi (mòduls ES, sense framework ni compilació)
data/                  totes les dades del servei (JSON)
fonts/  vendor/        Lexend, Archivo Black i Leaflet, copiats al repositori
icons/  manifest.webmanifest  sw.js     PWA
qr/                    codis QR dels cartells (es generen amb npm run qr)
eines/                 editor de parades (no enllaçat des de l'app) i scripts
tests/                 tests d'acceptació i servidor local
```

## Com s'actualitzen les dades

Totes les dades són en `data/`. La interfície no té cap hora ni cap parada escrita a mà: per a canviar l'horari, n'hi ha prou d'editar el JSON.

### Horaris: `data/servei.json`

| Camp | Què és |
|---|---|
| `eixides.laborables` | Hores d'eixida de dilluns a divendres, des de la parada 1 (`"HH:MM"`). |
| `eixides.caps_de_setmana_i_festius` | Hores d'eixida de dissabtes, diumenges i festius. |
| `vigent_des_de` / `vigent_fins_a` | Període del servei (`"AAAA-MM-DD"`). `vigent_fins_a` és `null` mentre no hi haja data de fi. Si ja ha passat, l'app mostra «Servei finalitzat. Consulta oliva.es». |
| `font.comprovat` | Data en què s'ha comprovat l'avís oficial. Es mostra en «Sobre l'app» i en els cartells. |
| `font.url`, `font.titol`, `font.data_avis` | Enllaç i dades de l'avís oficial. |
| `durada_volta_minuts` | Durada aproximada de la volta completa (l'avís diu «aproximadament una hora»). |
| `gratuit` | `true` si el servei és gratuït. |

### Parades: `data/servei.json`, camp `parades`

Les parades van en l'ordre del recorregut: la primera és l'eixida i l'última, l'arribada (que és el mateix lloc que l'eixida).

| Camp | Què és |
|---|---|
| `num` | Número de la parada. |
| `punt` | Identificador del lloc. Les parades que són el mateix punt en sentits contraris el comparteixen (1/20, 5/14, 6/13, 7/12); així l'app tria el sentit correcte. |
| `nom.va`, `nom.es` | Nom oficial en valencià i en castellà (en anglès es mostra el valencià). |
| `lat`, `lon` | Coordenades de la parada (de la parada, no del número del carrer). |
| `minuts_des_de_eixida` | Minuts des de l'eixida de la parada 1 fins al pas per esta parada, o `null` si no se saben (ara totes, llevat de la 1). Si es posen, l'app mostra l'hora de pas amb «aprox.». Han de créixer al llarg del recorregut. |
| `estimat` | `true` si els minuts són una estimació i no una dada oficial. |

Per a corregir coordenades i minuts, useu l'**editor de parades**:

1. `npm start` i obriu <http://localhost:8080/busoliva/eines/editor-parades.html>.
2. Arrossegueu cada marcador fins a la parada real. Si sabeu els minuts de pas, poseu-los (i marqueu «Estimat» si no són oficials); si no, deixeu-los buits.
3. Toqueu «Exporta servei.json» i substituïu `data/servei.json` pel fitxer baixat.
4. Executeu `npm run recorregut` per a tornar a generar el traçat del mapa (`data/recorregut.geojson`). Amb connexió, es calcula per carrers amb OSRM; sense connexió, es desen línies rectes i el mapa ho avisa. L'app no crida mai OSRM mentre funciona.
5. Si canvia la numeració de les parades, executeu `npm run qr` per a tornar a fer els codis QR dels cartells.

### Xarxa de carrers: `data/carrers.json`

Serveix per a calcular en el mòbil la distància a peu pel carrer fins a cada parada. Es genera a partir d'OpenStreetMap amb `npm run carrers` (cal connexió). Torneu a generar-la si canvien les parades de lloc o si es tallen o s'obrin carrers. Mentre estiga buida (com ara), l'app fa servir la línia recta multiplicada per 1,3 i ho marca com a aproximat. Només es descarrega quan es toca «Troba la parada més propera».

### Festius: `data/festius.json`

Cada festiu té `data`, `nom` (en `va`, `es` i `en`), `ambit` (`nacional`, `autonomic` o `local`) i `font` (`nom` i `url` del BOE, del DOGV o de l'Ajuntament). Els dies feiners que són festius usen l'horari de dissabtes, diumenges i festius.

> Pendent: falten els festius locals d'Oliva de 2027. Afegiu-los amb `"ambit": "local"` quan es publiquen en el DOGV o en la web de l'Ajuntament. Cal confirmar si el 7-12-2026 és festiu local o només dia de lliure disposició escolar.

### Avisos: `data/avisos.json`

Cada avís té `id`, `inici` i `fi` (`"AAAA-MM-DD"`; `fi` pot ser `null`) i `text` en `va`, `es` i `en`. Es mostra en l'app entre eixes dates, ambdues incloses.

```json
{ "id": "pluja-dimarts", "inici": "2026-11-10", "fi": "2026-11-10",
  "text": { "va": "…", "es": "…", "en": "…" } }
```

### Quan cal tocar `sw.js`

- Si només canvien dades (`data/*.json`), **no cal**: l'app les demana primer a la xarxa.
- Si canvia l'app (HTML, CSS, JS, icones o fonts), canvieu `VERSIO` en `sw.js` (per exemple, de `'1'` a `'2'`). Els mòbils que ja tenen l'app mostraran «Hi ha una versió nova de l'app» i el botó «Actualitza».

## Com es prova en local

Cal Node.js 22 o posterior.

```sh
npm install
npx playwright install chromium   # només la primera vegada
npm start                         # http://localhost:8080/busoliva/
npm test                          # tests d'acceptació
```

Qualsevol servidor estàtic serveix, perquè totes les rutes són relatives. La geolocalització i el service worker només funcionen amb `https` o en `localhost`.

| Ordre | Què fa |
|---|---|
| `npm start` | Servidor local que serveix l'app sota `/busoliva/`, com GitHub Pages. |
| `npm test` | Els 11 tests d'acceptació (Playwright amb el rellotge fixat, zona Europe/Madrid i comprovacions d'accessibilitat amb axe) i la comprovació de pes de la primera càrrega (menys de 300 KB). |
| `npm run recorregut` | Torna a generar el traçat del mapa a partir de les parades. |
| `npm run carrers` | Genera la xarxa de carrers per a la distància a peu (`data/carrers.json`). |
| `npm run qr` | Torna a generar els codis QR dels cartells (`URL_APP=https://…/ npm run qr` per a una altra adreça). |
| `npm run vendor` | Torna a copiar Leaflet i les fonts des de `node_modules`. |

## Com es publica (GitHub Pages)

1. Pugeu el contingut del repositori a la branca `main` de `busoliva`.
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branca `main`, carpeta `/ (root)`, i **Save**.
3. Al cap d'uns minuts l'app és en <https://rubparsa.github.io/busoliva/>.
4. Els codis QR apunten a eixa adreça. Si en feu servir una altra, executeu `URL_APP=https://la-vostra-adreça/ npm run qr` i torneu a publicar.
5. Imprimiu els cartells des de l'adreça publicada: `https://rubparsa.github.io/busoliva/cartells.html` (o `cartells.html?parada=N` per a una sola parada).

Després de cada canvi, n'hi ha prou de tornar a pujar els fitxers a `main`. Recordeu canviar `VERSIO` en `sw.js` si heu tocat l'app.

## Dades pendents de confirmar

- **Coordenades** de les parades: són les candidates del servei d'estiu. Les de les parades 15 i 18 són provisionals.
- **Hores de pas** per les parades intermèdies: l'avís no les dona.
- **Festius**: els nacionals i autonòmics s'han de contrastar amb el text del BOE i del DOGV. Falten els locals de 2027 i confirmar el 7-12-2026.
- **Xarxa de carrers**: buida fins que s'execute `npm run carrers` amb connexió.

## Privacitat

La ubicació es calcula en el mòbil i no s'envia enlloc. No hi ha comptes, ni cookies, ni analítica. En el mòbil només es desen l'idioma, la parada triada, les favorites i les preferències de visualització. El mapa descarrega les imatges de fons d'OpenStreetMap, que veu l'adreça IP i la zona del mapa que es mira, però no la ubicació.

## Crèdits

- Mapa: © col·laboradors d'[OpenStreetMap](https://www.openstreetmap.org/copyright) (dades sota llicència ODbL).
- [Leaflet](https://leafletjs.com/) (llicència BSD-2, `vendor/leaflet/LICENSE`).
- Tipografies Lexend i Archivo Black (llicència SIL OFL 1.1, `fonts/`).

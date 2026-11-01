// Càlculs del servei a partir de data/servei.json i data/festius.json:
// hora d'Europe/Madrid, tipus de dia, passades per parada, viatges i distàncies.
// L'app no sap on és l'autobús: tot ix de l'horari.

const MINUT = 60000;
const rellotge = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Madrid', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
});
const dos = (n) => (n < 10 ? '0' : '') + n;
const iso = (a, m, d) => a + '-' + dos(m) + '-' + dos(d);
const nums = (text, sep) => text.split(sep).map(Number);

// Rellotge de Madrid en un instant (ms), siga quina siga la zona del dispositiu.
export function partsMadrid(ms) {
  const p = {};
  rellotge.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return { any: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour % 24, minut: +p.minute, segon: +p.second };
}

export function diaMadrid(ms) {
  const p = partsMadrid(ms);
  return iso(p.any, p.mes, p.dia);
}

export function horaMadrid(ms) {
  const p = partsMadrid(ms);
  return dos(p.hora) + ':' + dos(p.minut);
}

function desfasament(ms) {
  const p = partsMadrid(ms);
  return Date.UTC(p.any, p.mes - 1, p.dia, p.hora, p.minut, p.segon) - Math.floor(ms / 1000) * 1000;
}

// Instant real d'una hora «HH:MM» de Madrid en una data ISO. El desfasament es
// calcula per a eixa data, així que els canvis d'hora no l'afecten.
export function instantMadrid(data, hhmm) {
  const d = nums(data, '-');
  const h = nums(hhmm, ':');
  const local = Date.UTC(d[0], d[1] - 1, d[2], h[0], h[1]);
  return local - desfasament(local - desfasament(local));
}

export function sumaDies(data, n) {
  const d = nums(data, '-');
  const t = new Date(Date.UTC(d[0], d[1] - 1, d[2] + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// 0 = dilluns … 6 = diumenge
export function diaSetmana(data) {
  const d = nums(data, '-');
  return (new Date(Date.UTC(d[0], d[1] - 1, d[2])).getUTCDay() + 6) % 7;
}

export function tipusDia(data, festius) {
  return diaSetmana(data) < 5 && !festius.has(data) ? 'laborables' : 'caps_de_setmana_i_festius';
}

export function enVigor(servei, data) {
  return data >= servei.vigent_des_de && (!servei.vigent_fins_a || data <= servei.vigent_fins_a);
}

export function finalitzat(servei, ms) {
  return !!servei.vigent_fins_a && diaMadrid(ms) > servei.vigent_fins_a;
}

// Eixides des d'ahir fins a 8 dies vista, en ordre.
export function eixides(servei, festius, ms) {
  const avui = diaMadrid(ms);
  const llista = [];
  for (let i = -1; i <= 8; i++) {
    const data = sumaDies(avui, i);
    if (!enVigor(servei, data)) continue;
    servei.eixides[tipusDia(data, festius)].forEach((hora) => {
      llista.push({ data, hora, ms: instantMadrid(data, hora) });
    });
  }
  return llista.sort((a, b) => a.ms - b.ms);
}

export const pas = (eixida, parada) => eixida.ms + parada.minuts_des_de_eixida * MINUT;

// Un bus compta com a pròxim fins que acaba el minut en què passa.
export const pendent = (instant, ms) => instant - ms > -MINUT;

export function passades(servei, festius, parada, ms, quantes) {
  const res = [];
  const llista = eixides(servei, festius, ms);
  for (let i = 0; i < llista.length && res.length < quantes; i++) {
    const instant = pas(llista[i], parada);
    if (pendent(instant, ms)) res.push({ eixida: llista[i], ms: instant });
  }
  return res;
}

// Millor viatge entre dos punts. Com que és un circuit, un mateix punt pot tindre
// dues parades (una per sentit): es tria la combinació que arriba abans. Si cal
// passar pel final, es continua en la volta següent.
export function viatge(servei, festius, puntOrigen, puntDesti, ms) {
  const ps = servei.parades;
  const ultima = ps.length - 1;
  const indexos = (punt, exclou) => ps.map((p, i) => (p.punt === punt && i !== exclou ? i : -1)).filter((i) => i >= 0);
  const origens = indexos(puntOrigen, ultima);
  const destins = indexos(puntDesti, 0);
  const llista = eixides(servei, festius, ms);
  let millor = null;
  for (let k = 0; k < llista.length; k++) {
    if (millor && llista[k].ms > millor.arriba) break;
    origens.forEach((o) => {
      const puja = pas(llista[k], ps[o]);
      if (!pendent(puja, ms)) return;
      destins.forEach((d) => {
        let volta = null;
        let arriba;
        if (d > o) {
          arriba = pas(llista[k], ps[d]);
        } else {
          const final = pas(llista[k], ps[ultima]);
          volta = llista.slice(k + 1).filter((e) => e.ms >= final)[0];
          if (!volta) return;
          arriba = pas(volta, ps[d]);
        }
        if (!millor || arriba < millor.arriba) {
          millor = { origen: ps[o], desti: ps[d], puja, arriba, volta, final: volta ? pas(llista[k], ps[ultima]) : null };
        }
      });
    });
  }
  return millor;
}

export function distancia(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.pow(Math.sin(dLon / 2), 2);
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

export const minutsAPeu = (metres) => Math.ceil(metres / 75);

// L'última parada només és d'arribada: no compta per a agafar el bus.
export function properes(servei, pos, quantes) {
  return servei.parades.slice(0, -1)
    .map((parada) => ({ parada, metres: distancia(pos, parada) }))
    .sort((a, b) => a.metres - b.metres || a.parada.num - b.parada.num)
    .slice(0, quantes);
}

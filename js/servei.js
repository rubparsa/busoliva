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

// «07:30» + 13 minuts → «07:43» (dins del mateix dia).
export function sumaMinuts(hhmm, min) {
  const total = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + min;
  const h = Math.floor(total / 60) % 24;
  return dos(h) + ':' + dos(total % 60);
}

// Minuts des de l'eixida fins a una parada, si se saben (null si no).
export const minutsConeguts = (parada) => (parada.minuts_des_de_eixida == null ? null : parada.minuts_des_de_eixida);

// Instant de pas per una parada. Si no se sap, es dona l'hora d'eixida de la parada 1.
export const pas = (eixida, parada) => eixida.ms + (minutsConeguts(parada) || 0) * MINUT;

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

// Última eixida que encara pot estar fent la volta (ha eixit fa menys que la durada de la volta).
export function enCurs(servei, festius, ms) {
  const durada = (servei.durada_volta_minuts || 0) * MINUT;
  const llista = eixides(servei, festius, ms).filter((e) => e.ms <= ms - MINUT && e.ms > ms - durada);
  return llista.length ? llista[llista.length - 1] : null;
}

// Millor viatge entre dos punts. Com que és un circuit, un mateix punt pot tindre dues
// parades (una per sentit). Si se saben els minuts de pas, es tria la combinació que
// arriba abans; si no, la que passa per menys parades. Si cal passar pel final, es
// continua en la volta següent.
export function viatge(servei, festius, puntOrigen, puntDesti, ms) {
  const ps = servei.parades;
  const ultima = ps.length - 1;
  const indexos = (punt, exclou) => ps.map((p, i) => (p.punt === punt && i !== exclou ? i : -1)).filter((i) => i >= 0);
  const opcions = [];
  indexos(puntOrigen, ultima).forEach((o) => indexos(puntDesti, 0).forEach((d) => {
    opcions.push({ o, d, parades: d > o ? d - o : ultima - o + d, volta: d <= o });
  }));
  if (!opcions.length) return null;
  const ambHores = opcions.filter((x) => minutsConeguts(ps[x.o]) != null && minutsConeguts(ps[x.d]) != null &&
    (!x.volta || minutsConeguts(ps[ultima]) != null));
  if (ambHores.length < opcions.length) {
    const millor = opcions.sort((a, b) => a.parades - b.parades)[0];
    const seguent = passades(servei, festius, ps[0], ms, 1)[0];
    return { origen: ps[millor.o], desti: ps[millor.d], parades: millor.parades, volta: millor.volta, ambHores: false, eixida: seguent ? seguent.eixida : null };
  }
  const llista = eixides(servei, festius, ms);
  let millor = null;
  for (let k = 0; k < llista.length; k++) {
    if (millor && llista[k].ms > millor.arriba) break;
    opcions.forEach((x) => {
      const puja = pas(llista[k], ps[x.o]);
      if (!pendent(puja, ms)) return;
      let volta = null;
      let arriba;
      if (!x.volta) {
        arriba = pas(llista[k], ps[x.d]);
      } else {
        const final = pas(llista[k], ps[ultima]);
        volta = llista.slice(k + 1).filter((e) => e.ms >= final)[0];
        if (!volta) return;
        arriba = pas(volta, ps[x.d]);
      }
      if (!millor || arriba < millor.arriba) {
        millor = { origen: ps[x.o], desti: ps[x.d], parades: x.parades, ambHores: true, puja, arriba, volta, final: volta ? pas(llista[k], ps[ultima]) : null };
      }
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

// Sense xarxa de carrers, la línia recta es multiplica per este factor (estimat,
// habitual en ciutat) i el resultat es marca com a aproximat.
export const FACTOR_LINIA_RECTA = 1.3;

// Prepara data/carrers.json (nodes en graus × 1e5 i arestes [a, b, metres]) per a buscar camins.
export function preparaCarrers(json) {
  const n = json && json.nodes ? json.nodes.length / 2 : 0;
  if (!n) return null;
  const veins = [];
  for (let i = 0; i < n; i++) veins.push([]);
  for (let i = 0; i < json.arestes.length; i += 3) {
    const a = json.arestes[i];
    const b = json.arestes[i + 1];
    const m = json.arestes[i + 2];
    veins[a].push(b, m);
    veins[b].push(a, m);
  }
  const punt = (i) => ({ lat: json.nodes[2 * i] / 1e5, lon: json.nodes[2 * i + 1] / 1e5 });
  return { n, veins, punt };
}

function nodeMesProper(graf, pos) {
  let millor = 0;
  let dMillor = Infinity;
  for (let i = 0; i < graf.n; i++) {
    const d = distancia(pos, graf.punt(i));
    if (d < dMillor) { dMillor = d; millor = i; }
  }
  return { node: millor, metres: dMillor };
}

// Distància a peu pel carrer des de pos fins a cada parada (Dijkstra sobre la xarxa
// de carrers, calculat en el mòbil). Retorna null per a les parades sense camí.
export function distanciesCarrer(graf, pos, parades) {
  const inici = nodeMesProper(graf, pos);
  const dist = new Float64Array(graf.n).fill(Infinity);
  const cua = [[inici.metres, inici.node]];
  dist[inici.node] = inici.metres;
  const puja = (x) => {
    cua.push(x);
    for (let i = cua.length - 1; i > 0;) {
      const pare = (i - 1) >> 1;
      if (cua[pare][0] <= cua[i][0]) break;
      [cua[pare], cua[i]] = [cua[i], cua[pare]];
      i = pare;
    }
  };
  const trau = () => {
    const primer = cua[0];
    const ultim = cua.pop();
    if (cua.length) {
      cua[0] = ultim;
      for (let i = 0; ;) {
        const e = 2 * i + 1;
        const d = e + 1;
        let m = i;
        if (e < cua.length && cua[e][0] < cua[m][0]) m = e;
        if (d < cua.length && cua[d][0] < cua[m][0]) m = d;
        if (m === i) break;
        [cua[m], cua[i]] = [cua[i], cua[m]];
        i = m;
      }
    }
    return primer;
  };
  while (cua.length) {
    const [d, u] = trau();
    if (d > dist[u]) continue;
    const v = graf.veins[u];
    for (let k = 0; k < v.length; k += 2) {
      const nd = d + v[k + 1];
      if (nd < dist[v[k]]) { dist[v[k]] = nd; puja([nd, v[k]]); }
    }
  }
  return parades.map((p) => {
    const desti = nodeMesProper(graf, p);
    return dist[desti.node] === Infinity ? null : dist[desti.node] + desti.metres;
  });
}

// Distància a peu a cada parada: pel carrer si hi ha xarxa; si no, línia recta corregida.
export function distanciesAPeu(servei, graf, pos) {
  const carrer = graf ? distanciesCarrer(graf, pos, servei.parades) : [];
  return servei.parades.map((p, i) => (carrer[i] != null
    ? { parada: p, metres: carrer[i], aprox: false }
    : { parada: p, metres: distancia(pos, p) * FACTOR_LINIA_RECTA, aprox: true }));
}

// L'última parada només és d'arribada: no compta per a agafar el bus.
export function properes(distancies, quantes) {
  return distancies.slice(0, -1)
    .sort((a, b) => a.metres - b.metres || a.parada.num - b.parada.num)
    .slice(0, quantes);
}

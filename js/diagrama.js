// Diagrama esquemàtic de la línia en SVG, generat a partir de servei.json.
// No depén de la xarxa: funciona sense connexió.
export function pintaDiagrama(llista, ctx) {
  const ps = ctx.servei.parades;
  const n = ps.length;
  llista.innerHTML = ps.map((p, i) => {
    const primer = i === 0;
    const ultim = i === n - 1;
    const sel = p.num === ctx.parada;
    const parella = ps.filter((q) => q !== p && q.punt === p.punt)[0];
    let nota = '';
    if (primer) nota = ctx.t('linia.eixida');
    else if (ultim) nota = ctx.t('linia.final', { num: ps[0].num });
    else if (parella) nota = ctx.t('linia.mateix', { num: parella.num });
    const nomParada = '<span class="vh">' + ctx.escapa(ctx.t('proper.parada', { num: p.num })) + ' · </span>' + ctx.escapa(ctx.nom(p));
    const nom = ultim
      ? '<span>' + nomParada + '</span>'
      : '<button type="button" class="parada" data-num="' + p.num + '"' + (sel ? ' aria-current="true"' : '') + '>' + nomParada + '</button>';
    const svg = '<svg focusable="false">' +
      '<line x1="50%" x2="50%" y1="' + (primer ? '50%' : '0') + '" y2="' + (ultim ? '50%' : '100%') + '"></line>' +
      '<circle cx="50%" cy="50%" r="17"></circle>' +
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central">' + p.num + '</text></svg>';
    return '<li class="linia-fila' + (sel ? ' sel' : '') + '">' +
      '<span class="linia-tras" aria-hidden="true">' + svg + '</span>' +
      '<span class="linia-text">' + nom +
      (primer || p.minuts_des_de_eixida == null ? '' : '<span class="linia-min">' + ctx.escapa(ctx.t('linia.minuts', { min: p.minuts_des_de_eixida })) + '</span>') +
      (nota ? '<span class="linia-nota">' + ctx.escapa(nota) + '</span>' : '') +
      '</span></li>';
  }).join('');
}

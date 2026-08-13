let comparativoRows = [];
let observaciones = {};

function splitVarieties(value) {
  return text(value)
    .split(/\s*\+\s*|\s*,\s*|\s+y\s+/i)
    .map(normalizeVariety)
    .filter(variedad => ALTITUD.variedades.includes(variedad));
}

function rowKey(siembra, variedad, semana) {
  return `${text(siembra || 'SIN SIEMBRA').toUpperCase()}|${normalizeVariety(variedad)}|${asNumber(semana)}`;
}

function fallbackKey(variedad, semana) {
  return `*|${normalizeVariety(variedad)}|${asNumber(semana)}`;
}

function statusFromPercent(percent, diff) {
  if (diff > 0) return 'SUPERA PROYECCION';
  if (percent >= 95) return 'CUMPLE';
  if (percent >= 80) return 'BAJO LO ESPERADO';
  return 'DEFICIENTE';
}

function pillClass(estado) {
  if (estado === 'DEFICIENTE') return 'bad';
  if (estado === 'BAJO LO ESPERADO') return 'warn';
  return '';
}

function looksLikeGuideRow(row) {
  const joined = Object.values(row || {}).map(text).join(' ').toUpperCase();
  return /GUIA|GUÍA|SUBIR|GOOGLE SHEETS|INSTRUCCION|PLANTILLA/.test(joined);
}

function normalizeProjection(rows) {
  const out = [];
  (rows || []).forEach(row => {
    if (looksLikeGuideRow(row)) return;
    const semana = asNumber(row.semana || row.semana_proyectada || row.week);
    const rawSiembra = text(row.siembra || row.bloque || row.lote);
    const variedades = splitVarieties(row.variedad || row.variedades);
    const projected = asNumber(row.tallos_proyectados || row.tallos_vendibles || row.tallos_brutos || row.tallos);
    if (!semana || !projected || !variedades.length) return;

    const perVariety = projected / variedades.length;
    variedades.forEach(variedad => out.push({
      siembra: rawSiembra ? rawSiembra.toUpperCase() : 'SIN SIEMBRA',
      variedad,
      semana_proyectada: semana,
      fecha_cosecha: normalizarFecha(row.fecha_cosecha || row.fecha || row.fecha_inicio),
      tallos_proyectados: perVariety,
      observacion: text(row.observaciones || row.observacion)
    }));
  });
  return out;
}

function normalizeProduction(rows) {
  const grouped = {};
  (rows || []).forEach(row => {
    const siembra = text(row.siembra || row.bloque || row.lote || 'SIN SIEMBRA').toUpperCase();
    const variedad = normalizeVariety(row.variedad);
    const fecha = normalizarFecha(row.fecha);
    const semana = asNumber(row.semana) || isoWeekAltitud(fecha);
    const tallos = asNumber(row.tallos_cortados || row.tallos_cosechados || row.tallos);
    const estado = text(row.estado || 'REGISTRADO').toUpperCase();
    if (!ALTITUD.variedades.includes(variedad) || !semana || !tallos || estado === 'ELIMINADO' || estado === 'ANULADO') return;
    const key = rowKey(siembra, variedad, semana);
    grouped[key] ||= { siembra, variedad, semana, fecha_cosecha: fecha, tallos_cosechados_reales: 0 };
    grouped[key].tallos_cosechados_reales += tallos;
    if (fecha) grouped[key].fecha_cosecha = fecha;
  });
  return grouped;
}

function normalizePostharvest(rows) {
  const grouped = {};
  normalizeProcessed(rows).forEach(row => {
    const siembra = text(row.siembra || row.bloque || row.lote || 'SIN SIEMBRA').toUpperCase();
    const semana = asNumber(row.semana) || isoWeekAltitud(row.fecha);
    if (!semana || !ALTITUD.variedades.includes(row.variedad)) return;
    const key = rowKey(siembra, row.variedad, semana);
    grouped[key] ||= {
      siembra,
      variedad: row.variedad,
      semana,
      fecha_cosecha: row.fecha,
      tallos_procesados_reales: 0,
      descarte_real: 0
    };
    grouped[key].tallos_procesados_reales += row.util || row.tallos_procesados;
    grouped[key].descarte_real += row.basura;
    if (row.fecha) grouped[key].fecha_cosecha = row.fecha;
  });
  return grouped;
}

function findRealRow(map, siembra, variedad, semana) {
  return map[rowKey(siembra, variedad, semana)] || map[fallbackKey(variedad, semana)] || {};
}

function addFallbacks(map) {
  Object.values(map).forEach(row => {
    const key = fallbackKey(row.variedad, row.semana);
    if (!map[key]) map[key] = { ...row, siembra: 'SIN SIEMBRA' };
    else {
      map[key].tallos_cosechados_reales = asNumber(map[key].tallos_cosechados_reales) + asNumber(row.tallos_cosechados_reales);
      map[key].tallos_procesados_reales = asNumber(map[key].tallos_procesados_reales) + asNumber(row.tallos_procesados_reales);
      map[key].descarte_real = asNumber(map[key].descarte_real) + asNumber(row.descarte_real);
    }
  });
  return map;
}

function combineComparativo(projections, productionMap, postMap) {
  if (!projections.length) return [];
  const production = addFallbacks({ ...productionMap });
  const postharvest = addFallbacks({ ...postMap });

  return projections.map((projection, index) => {
    const prod = findRealRow(production, projection.siembra, projection.variedad, projection.semana_proyectada);
    const post = findRealRow(postharvest, projection.siembra, projection.variedad, projection.semana_proyectada);
    const cosechado = asNumber(prod.tallos_cosechados_reales);
    const procesado = asNumber(post.tallos_procesados_reales);
    const reales = cosechado || procesado;
    const diferencia = reales - projection.tallos_proyectados;
    const cumplimiento = projection.tallos_proyectados ? (reales / projection.tallos_proyectados) * 100 : 0;
    const key = rowKey(projection.siembra, projection.variedad, projection.semana_proyectada);
    return {
      id_comparativo: `CMP-${Date.now()}-${index}`,
      fecha_registro: new Date().toISOString(),
      siembra: projection.siembra,
      variedad: projection.variedad,
      semana: projection.semana_proyectada,
      semana_proyectada: projection.semana_proyectada,
      fecha_cosecha: prod.fecha_cosecha || post.fecha_cosecha || projection.fecha_cosecha,
      tallos_proyectados: projection.tallos_proyectados,
      tallos_cosechados_reales: cosechado,
      tallos_procesados_reales: procesado,
      descarte_real: asNumber(post.descarte_real),
      tallos_reales: reales,
      diferencia_tallos: diferencia,
      porcentaje_cumplimiento: cumplimiento,
      estado_resultado: statusFromPercent(cumplimiento, diferencia),
      observacion: observaciones[key] || projection.observacion || ''
    };
  }).sort((a, b) => a.semana - b.semana || a.siembra.localeCompare(b.siembra) || a.variedad.localeCompare(b.variedad));
}

async function loadProjectionRows() {
  try {
    const rows = await loadSheet(ALTITUD.sheets.proyeccion);
    if (normalizeProjection(rows).length) return rows;
  } catch (err) {}
  try {
    return await loadSheet(ALTITUD.sheets.proyeccionCosecha);
  } catch (err) {
    return [];
  }
}

function emptyComparativoMessage() {
  return 'No hay proyeccion valida. Revisa que PROYECCION_COSECHA tenga semana, siembra, variedades y tallos_vendibles.';
}

async function loadComparativo() {
  setStatus('Cargando comparativo...');
  try {
    if (ALTITUD.comparativoProyeccionUrl) {
      const res = await fetch(`${ALTITUD.comparativoProyeccionUrl}?action=comparar&cacheBust=${Date.now()}`);
      const data = await res.json();
      comparativoRows = data.rows || [];
    } else {
      const [projectionRaw, productionRaw, postRaw] = await Promise.all([
        loadProjectionRows(),
        loadSheet(ALTITUD.sheets.produccion).catch(() => []),
        loadSheet(ALTITUD.sheets.poscosecha).catch(() => [])
      ]);
      const projectionRows = normalizeProjection(projectionRaw);
      comparativoRows = combineComparativo(
        projectionRows,
        normalizeProduction(productionRaw),
        normalizePostharvest(postRaw)
      );
    }
    populateFilters();
    renderComparativo();
    setStatus(comparativoRows.length
      ? `Comparativo actualizado - ${fmtInt(comparativoRows.length)} filas`
      : emptyComparativoMessage());
  } catch (err) {
    comparativoRows = [];
    renderComparativo();
    setStatus('No se pudo leer la proyeccion.');
  }
}

function filteredComparativo() {
  const siembra = text($('filterSiembra').value).toUpperCase();
  const variedad = text($('filterVariedad').value);
  const semana = asNumber($('filterSemana').value);
  const fecha = text($('filterFecha').value);
  const estado = text($('filterEstado').value);
  return comparativoRows.filter(row => (!siembra || row.siembra.includes(siembra))
    && (!variedad || row.variedad === variedad)
    && (!semana || row.semana === semana)
    && (!fecha || row.fecha_cosecha === fecha)
    && (!estado || row.estado_resultado === estado));
}

function populateFilters() {
  const varieties = [...new Set(comparativoRows.map(row => row.variedad).filter(Boolean))].sort();
  const options = ['<option value="">Todas</option>', ...varieties.map(v => `<option value="${v}">${v}</option>`)].join('');
  $('filterVariedad').innerHTML = options;
  $('obsVariedad').innerHTML = varieties.length
    ? varieties.map(v => `<option value="${v}">${v}</option>`).join('')
    : ALTITUD.variedades.map(v => `<option value="${v}">${v}</option>`).join('');
}

function renderComparativo() {
  const rows = filteredComparativo();
  const proyectado = rows.reduce((sum, row) => sum + row.tallos_proyectados, 0);
  const real = rows.reduce((sum, row) => sum + row.tallos_reales, 0);
  const diff = real - proyectado;
  const pct = proyectado ? real / proyectado : 0;
  $('kProyectado').textContent = fmtInt(proyectado);
  $('kReal').textContent = fmtInt(real);
  $('kDiferencia').textContent = fmtInt(diff);
  $('kCumplimiento').textContent = fmtPct(pct);
  renderRows($('comparativoBody'), rows, [
    row => row.siembra,
    row => row.variedad,
    row => row.semana,
    row => row.fecha_cosecha || '-',
    row => fmtInt(row.tallos_proyectados),
    row => fmtInt(row.tallos_cosechados_reales),
    row => fmtInt(row.tallos_procesados_reales),
    row => fmtInt(row.descarte_real),
    row => fmtInt(row.diferencia_tallos),
    row => `${(row.porcentaje_cumplimiento || 0).toFixed(1)}%`,
    row => `<span class="pill ${pillClass(row.estado_resultado)}">${row.estado_resultado}</span>`,
    row => row.observacion || '-'
  ], emptyComparativoMessage());
}

async function saveComparativo() {
  if (!comparativoRows.length) {
    setStatus('No hay comparativo para guardar.');
    return;
  }
  if (!ALTITUD.comparativoProyeccionUrl) {
    setStatus('Falta publicar Apps Script comparativo para guardar el analisis.');
    return;
  }
  await fetch(ALTITUD.comparativoProyeccionUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'guardarComparativo', rows: comparativoRows })
  });
  setStatus('Analisis enviado a COMPARATIVO_PROYECCION.');
}

function applyObservation(event) {
  event.preventDefault();
  if (!comparativoRows.length) {
    setStatus('No se puede aplicar observacion: primero debe existir una tabla comparativa cargada.');
    return;
  }
  const key = rowKey($('obsSiembra').value, $('obsVariedad').value, $('obsSemana').value);
  const cause = text($('obsCausa').value);
  const detail = text($('obsTexto').value);
  const exists = comparativoRows.some(row => rowKey(row.siembra, row.variedad, row.semana) === key);
  if (!exists) {
    setStatus('No encontre esa combinacion de siembra, variedad y semana en la tabla. Verifica esos tres campos.');
    return;
  }
  observaciones[key] = detail ? `${cause}: ${detail}` : cause;
  comparativoRows = comparativoRows.map(row => rowKey(row.siembra, row.variedad, row.semana) === key
    ? { ...row, observacion: observaciones[key] }
    : row);
  renderComparativo();
  setStatus('Observacion aplicada en pantalla.');
}

document.addEventListener('DOMContentLoaded', () => {
  ['filterSiembra', 'filterVariedad', 'filterSemana', 'filterFecha', 'filterEstado'].forEach(id => $(id).addEventListener('input', renderComparativo));
  $('refreshBtn').addEventListener('click', loadComparativo);
  $('saveBtn').addEventListener('click', saveComparativo);
  $('obsForm').addEventListener('submit', applyObservation);
  loadComparativo();
});

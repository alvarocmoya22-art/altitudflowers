let comparativoRows = [];
let observaciones = {};

function splitVarieties(value) {
  return text(value).split(/\s*\+\s*|\s*,\s*|\s+y\s+/i).map(normalizeVariety).filter(Boolean);
}

function rowKey(siembra, variedad, semana) {
  return `${text(siembra).toUpperCase()}|${normalizeVariety(variedad)}|${asNumber(semana)}`;
}

function statusFromPercent(percent, diff) {
  if (diff > 0) return 'SUPERA PROYECCIÓN';
  if (percent >= 95) return 'CUMPLE';
  if (percent >= 80) return 'BAJO LO ESPERADO';
  return 'DEFICIENTE';
}

function pillClass(estado) {
  if (estado === 'DEFICIENTE') return 'bad';
  if (estado === 'BAJO LO ESPERADO') return 'warn';
  return '';
}

function normalizeProjection(rows) {
  const out = [];
  (rows || []).forEach(row => {
    const semana = asNumber(row.semana || row.semana_proyectada);
    const siembra = text(row.siembra || row.bloque || row.lote || 'SIN SIEMBRA').toUpperCase();
    const variedades = splitVarieties(row.variedad || row.variedades);
    const projected = asNumber(row.tallos_proyectados || row.tallos_vendibles || row.tallos_brutos || row.tallos);
    if (!semana || !projected || !variedades.length) return;
    const perVariety = projected / variedades.length;
    variedades.forEach(variedad => out.push({
      siembra,
      variedad,
      semana_proyectada: semana,
      fecha_cosecha: text(row.fecha_cosecha || row.fecha || row.fecha_inicio),
      tallos_proyectados: perVariety,
      observacion: text(row.observaciones)
    }));
  });
  return out;
}

function normalizeProduction(rows) {
  const grouped = {};
  (rows || []).forEach(row => {
    const siembra = text(row.siembra || row.bloque || row.lote || 'SIN SIEMBRA').toUpperCase();
    const variedad = normalizeVariety(row.variedad);
    const semana = asNumber(row.semana);
    const tallos = asNumber(row.tallos_cortados || row.tallos_cosechados || row.tallos);
    if (!variedad || !semana || !tallos) return;
    const key = rowKey(siembra, variedad, semana);
    grouped[key] ||= { siembra, variedad, semana, fecha_cosecha: text(row.fecha), tallos_cosechados_reales: 0 };
    grouped[key].tallos_cosechados_reales += tallos;
    if (text(row.fecha)) grouped[key].fecha_cosecha = text(row.fecha);
  });
  return grouped;
}

function normalizePostharvest(rows) {
  const grouped = {};
  normalizeProcessed(rows).forEach(row => {
    const siembra = text(row.siembra || row.bloque || row.lote || 'SIN SIEMBRA').toUpperCase();
    const semana = asNumber(row.semana);
    if (!semana) return;
    const key = rowKey(siembra, row.variedad, semana);
    grouped[key] ||= { siembra, variedad: row.variedad, semana, fecha_cosecha: row.fecha, tallos_procesados_reales: 0, descarte_real: 0 };
    grouped[key].tallos_procesados_reales += row.util || row.tallos_procesados;
    grouped[key].descarte_real += row.basura;
    if (row.fecha) grouped[key].fecha_cosecha = row.fecha;
  });
  return grouped;
}

function combineComparativo(projections, productionMap, postMap) {
  const rows = projections.map((projection, index) => {
    const key = rowKey(projection.siembra, projection.variedad, projection.semana_proyectada);
    const prod = productionMap[key] || {};
    const post = postMap[key] || {};
    const cosechado = asNumber(prod.tallos_cosechados_reales);
    const procesado = asNumber(post.tallos_procesados_reales);
    const reales = cosechado || procesado;
    const diferencia = reales - projection.tallos_proyectados;
    const cumplimiento = projection.tallos_proyectados ? (reales / projection.tallos_proyectados) * 100 : 0;
    const estado = statusFromPercent(cumplimiento, diferencia);
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
      estado_resultado: estado,
      observacion: observaciones[key] || projection.observacion || ''
    };
  });
  return rows.sort((a, b) => a.semana - b.semana || a.siembra.localeCompare(b.siembra) || a.variedad.localeCompare(b.variedad));
}

async function loadProjectionRows() {
  try {
    const rows = await loadSheet(ALTITUD.sheets.proyeccion);
    if (normalizeProjection(rows).length) return rows;
  } catch (err) {
  }
  return await loadSheet(ALTITUD.sheets.proyeccionCosecha);
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
      comparativoRows = combineComparativo(normalizeProjection(projectionRaw), normalizeProduction(productionRaw), normalizePostharvest(postRaw));
    }
    populateFilters();
    renderComparativo();
    setStatus(`Comparativo actualizado - ${fmtInt(comparativoRows.length)} filas`);
  } catch (err) {
    comparativoRows = [];
    renderComparativo();
    setStatus('No se pudo leer la proyección.');
  }
}

function filteredComparativo() {
  const siembra = text($('filterSiembra').value).toUpperCase();
  const variedad = text($('filterVariedad').value);
  const semana = asNumber($('filterSemana').value);
  const fecha = text($('filterFecha').value);
  const estado = text($('filterEstado').value);
  return comparativoRows.filter(row => {
    return (!siembra || row.siembra.includes(siembra))
      && (!variedad || row.variedad === variedad)
      && (!semana || row.semana === semana)
      && (!fecha || row.fecha_cosecha === fecha)
      && (!estado || row.estado_resultado === estado);
  });
}

function populateFilters() {
  const varieties = [...new Set(comparativoRows.map(row => row.variedad).filter(Boolean))].sort();
  const options = ['<option value="">Todas</option>', ...varieties.map(v => `<option value="${v}">${v}</option>`)].join('');
  $('filterVariedad').innerHTML = options;
  $('obsVariedad').innerHTML = varieties.map(v => `<option value="${v}">${v}</option>`).join('');
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
  ]);
}

async function saveComparativo() {
  if (!ALTITUD.comparativoProyeccionUrl) {
    setStatus('Falta publicar Apps Script comparativo para guardar el análisis.');
    return;
  }
  await fetch(ALTITUD.comparativoProyeccionUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'guardarComparativo', rows: comparativoRows })
  });
  setStatus('Análisis enviado a COMPARATIVO_PROYECCION.');
}

function applyObservation(event) {
  event.preventDefault();
  const key = rowKey($('obsSiembra').value, $('obsVariedad').value, $('obsSemana').value);
  const cause = text($('obsCausa').value);
  const detail = text($('obsTexto').value);
  observaciones[key] = detail ? `${cause}: ${detail}` : cause;
  comparativoRows = comparativoRows.map(row => rowKey(row.siembra, row.variedad, row.semana) === key ? { ...row, observacion: observaciones[key] } : row);
  renderComparativo();
  setStatus('Observación aplicada en pantalla.');
}

document.addEventListener('DOMContentLoaded', () => {
  ['filterSiembra', 'filterVariedad', 'filterSemana', 'filterFecha', 'filterEstado'].forEach(id => $(id).addEventListener('input', renderComparativo));
  $('refreshBtn').addEventListener('click', loadComparativo);
  $('saveBtn').addEventListener('click', saveComparativo);
  $('obsForm').addEventListener('submit', applyObservation);
  loadComparativo();
});

let coldProcessedRows = [];
let coldSalesRows = [];
let coldStockData = null;

function coldFilters() {
  return {
    desde: $('filterDesde')?.value,
    hasta: $('filterHasta')?.value,
    semana: $('filterSemana')?.value,
    mes: $('filterMes')?.value,
    variedad: $('filterVariedad')?.value,
    medida: $('filterMedida')?.value,
    estado: $('filterEstado')?.value,
    soloDisponibles: $('filterDisponibles')?.checked,
    soloBajoStock: $('filterBajo')?.checked,
    soloAgotados: $('filterAgotados')?.checked,
    minimo: 500
  };
}

function statePill(estado) {
  const e = text(estado).toUpperCase();
  const cls = e === 'AGOTADO' || e === 'INCONSISTENCIA' ? 'bad' : e === 'BAJO STOCK' ? 'warn' : 'ok';
  return `<span class="pill ${cls}">${e}</span>`;
}

function renderColdRoom(data) {
  coldStockData = data;
  const r = data.resumen;
  $('kProcesado').textContent = fmtInt(r.procesadoUtil);
  $('kVendido').textContent = fmtInt(r.vendido);
  $('kStock').textContent = fmtInt(r.stockDisponible);
  $('kVariedades').textContent = fmtInt(r.variedadesDisponibles);
  $('kAgotadas').textContent = fmtInt(r.variedadesAgotadas);
  $('kBajoStock').textContent = fmtInt(r.variedadesBajoStock);

  renderRows($('stockVariedadBody'), data.porVariedad, [
    row => row.variedad,
    row => fmtInt(row.procesadoUtil),
    row => fmtInt(row.vendido),
    row => fmtInt(row.stockDisponible),
    row => fmtPct(row.porcentajeVendido),
    row => statePill(row.estado)
  ]);

  renderRows($('stockMedidaBody'), data.porVariedadMedida, [
    row => row.variedad,
    row => medidaLabel(row.medida),
    row => fmtInt(row.procesadoUtil),
    row => fmtInt(row.vendido),
    row => fmtInt(row.stockDisponible),
    row => fmtPct(row.porcentajeVendido),
    row => statePill(row.estado)
  ]);

  renderRows($('stockDetalleBody'), data.detalle, [
    row => row.fecha,
    row => row.semana,
    row => row.variedad,
    row => medidaLabel(row.medida),
    row => fmtInt(row.procesado),
    row => fmtInt(row.vendido),
    row => fmtInt(row.stockDisponible),
    row => row.observacion || statePill(row.estado)
  ]);

  $('stockAlertsBody').innerHTML = data.alertas.length
    ? data.alertas.slice(0, 12).map(a => `<div class="alert-item ${a.tipo || 'warn'}"><strong>${a.tipo === 'bad' ? 'Atencion' : 'Revision'}</strong><span>${a.mensaje}</span></div>`).join('')
    : '<div class="alert-item"><strong>Sin alertas criticas</strong><span>El inventario no presenta agotados, bajo stock ni inconsistencias bajo los filtros actuales.</span></div>';
}

function coldFilterSummary(filters) {
  const items = [];
  if (filters.desde) items.push(`Desde: ${filters.desde}`);
  if (filters.hasta) items.push(`Hasta: ${filters.hasta}`);
  if (filters.semana) items.push(`Semana: ${filters.semana}`);
  if (filters.mes) items.push(`Mes: ${filters.mes}`);
  if (filters.variedad) items.push(`Variedad: ${filters.variedad}`);
  if (filters.medida) items.push(`Medida: ${medidaLabel(filters.medida)}`);
  if (filters.estado) items.push(`Estado: ${filters.estado}`);
  if (filters.soloDisponibles) items.push('Solo disponibles');
  if (filters.soloBajoStock) items.push('Solo bajo stock');
  if (filters.soloAgotados) items.push('Solo agotados');
  return items.length ? items.join(' · ') : 'Sin filtros aplicados';
}

function reportRows(rows, columns) {
  return rows.length
    ? rows.map(row => `<tr>${columns.map(col => `<td>${col(row)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}">Sin datos para los filtros actuales.</td></tr>`;
}

function buildColdPrintReport(data = coldStockData, filters = coldFilters(), options = {}) {
  if (!data) return '';
  const now = new Date();
  const titleDate = now.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
  const r = data.resumen;
  const stockRows = data.porVariedadMedida.filter(row => row.stockDisponible > 0);
  const reportTitle = options.title || 'Reporte de cuarto frio';
  const reportSubtitle = options.subtitle || 'Stock estimado disponible por variedad y medida';
  const filterText = options.filterText || coldFilterSummary(filters);

  return `
    <div class="print-report-page">
      <header class="print-report-head">
        <div>
          <div class="print-brand">Altitud Flowers</div>
          <h1>${reportTitle}</h1>
          <p>${reportSubtitle}</p>
        </div>
        <div class="print-meta">
          <strong>Generado</strong>
          <span>${titleDate}</span>
        </div>
      </header>
      <section class="print-filter-line"><strong>Filtros:</strong> ${filterText}</section>
      <section class="print-kpis">
        <div><span>Procesado util</span><strong>${fmtInt(r.procesadoUtil)}</strong></div>
        <div><span>Vendido</span><strong>${fmtInt(r.vendido)}</strong></div>
        <div><span>Stock disponible</span><strong>${fmtInt(r.stockDisponible)}</strong></div>
        <div><span>Variedades disponibles</span><strong>${fmtInt(r.variedadesDisponibles)}</strong></div>
        <div><span>Agotadas</span><strong>${fmtInt(r.variedadesAgotadas)}</strong></div>
        <div><span>Bajo stock</span><strong>${fmtInt(r.variedadesBajoStock)}</strong></div>
      </section>
      <section class="print-section">
        <h2>Resumen por variedad</h2>
        <table>
          <thead><tr><th>Variedad</th><th>Procesado util</th><th>Vendido</th><th>Stock disponible</th><th>% vendido</th><th>Estado</th></tr></thead>
          <tbody>${reportRows(data.porVariedad, [row => row.variedad, row => fmtInt(row.procesadoUtil), row => fmtInt(row.vendido), row => fmtInt(row.stockDisponible), row => fmtPct(row.porcentajeVendido), row => text(row.estado)])}</tbody>
        </table>
      </section>
      <section class="print-section">
        <h2>Stock disponible por medida</h2>
        <table>
          <thead><tr><th>Variedad</th><th>Medida</th><th>Procesado util</th><th>Vendido</th><th>Stock disponible</th><th>Estado</th></tr></thead>
          <tbody>${reportRows(stockRows, [row => row.variedad, row => medidaLabel(row.medida), row => fmtInt(row.procesadoUtil), row => fmtInt(row.vendido), row => fmtInt(row.stockDisponible), row => text(row.estado)])}</tbody>
        </table>
      </section>
      <footer class="print-footer">Altitud Flowers · Reporte interno generado desde el sistema</footer>
    </div>`;
}

function printColdReport() {
  const report = $('coldPrintReport');
  if (!report || !coldStockData) {
    setStatus('Espera a que cargue el stock para imprimir');
    return;
  }
  report.innerHTML = buildColdPrintReport(coldStockData, coldFilters());
  window.print();
}

function commercialOnlyStockData(data = coldStockData) {
  if (!data) return null;
  const porVariedadMedida = (data.porVariedadMedida || []).filter(row => normalizarMedida(row.medida) !== 'NACIONAL');
  const varietyMap = new Map();
  porVariedadMedida.forEach(row => {
    if (!varietyMap.has(row.variedad)) {
      varietyMap.set(row.variedad, { variedad: row.variedad, procesadoUtil: 0, vendido: 0, stockDisponible: 0, estado: 'AGOTADO' });
    }
    const item = varietyMap.get(row.variedad);
    item.procesadoUtil += row.procesadoUtil;
    item.vendido += row.vendido;
    item.stockDisponible += row.stockDisponible;
    if (row.estado === 'INCONSISTENCIA') item.estado = 'INCONSISTENCIA';
    else if (item.estado !== 'INCONSISTENCIA' && row.stockDisponible > 0) item.estado = 'DISPONIBLE';
  });
  const porVariedad = Array.from(varietyMap.values()).map(row => ({
    ...row,
    porcentajeVendido: row.procesadoUtil ? row.vendido / row.procesadoUtil : 0,
    estado: row.estado === 'INCONSISTENCIA' ? 'INCONSISTENCIA' : coldRoomState(row.procesadoUtil, row.vendido, 500)
  }));
  const resumen = {
    procesadoUtil: porVariedadMedida.reduce((a, r) => a + r.procesadoUtil, 0),
    vendido: porVariedadMedida.reduce((a, r) => a + r.vendido, 0),
    stockDisponible: porVariedadMedida.reduce((a, r) => a + r.stockDisponible, 0),
    variedadesDisponibles: porVariedad.filter(r => r.stockDisponible > 0).length,
    variedadesAgotadas: porVariedad.filter(r => r.estado === 'AGOTADO').length,
    variedadesBajoStock: porVariedadMedida.filter(r => r.estado === 'BAJO STOCK').length
  };
  return { ...data, resumen, porVariedad, porVariedadMedida };
}

function printCommercialReport() {
  const report = $('coldPrintReport');
  if (!report || !coldStockData) {
    setStatus('Espera a que cargue el stock para imprimir');
    return;
  }
  const data = commercialOnlyStockData(coldStockData);
  report.innerHTML = buildColdPrintReport(data, coldFilters(), {
    title: 'Reporte de disponibilidad comercial',
    subtitle: 'Stock estimado disponible sin contar Nacional',
    filterText: `${coldFilterSummary(coldFilters())} · Excluye Nacional`
  });
  window.print();
}

function setupColdFilters() {
  const month = $('filterMes');
  if (month) {
    month.innerHTML = '<option value="">Todos</option>' +
      Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  }

  $('filterVariedad').innerHTML = '<option value="">Todas</option>' +
    ALTITUD.variedades.map(v => `<option value="${v}">${v}</option>`).join('');
  $('filterMedida').innerHTML = '<option value="">Todas</option>' +
    ['70', '60', '55', '50', 'NACIONAL'].map(m => `<option value="${m}">${medidaLabel(m)}</option>`).join('');
  $('filterEstado').innerHTML = '<option value="">Todos</option>' +
    ['DISPONIBLE', 'BAJO STOCK', 'AGOTADO', 'INCONSISTENCIA'].map(e => `<option value="${e}">${e}</option>`).join('');

  document.querySelectorAll('.filters-panel input,.filters-panel select').forEach(el => {
    el.addEventListener('change', () => renderColdRoom(calculateColdRoomStock(coldProcessedRows, coldSalesRows, coldFilters())));
  });

  $('clearColdFilters')?.addEventListener('click', () => {
    document.querySelectorAll('.filters-panel input,.filters-panel select').forEach(el => {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
    renderColdRoom(calculateColdRoomStock(coldProcessedRows, coldSalesRows, coldFilters()));
  });
}

async function initCuartoFrio() {
  setStatus('Cargando stock real...');
  try {
    coldProcessedRows = await loadSheet(ALTITUD.sheets.poscosecha);
    coldSalesRows = await loadSheet(ALTITUD.sheets.ventas);
  } catch (err) {
    coldProcessedRows = [];
    coldSalesRows = [];
    setStatus('No se pudo leer Sheets; revisa permisos o publicacion');
  }

  setupColdFilters();
  $('printCommercialReportBtn')?.addEventListener('click', printCommercialReport);
  $('printColdReportBtn')?.addEventListener('click', printColdReport);
  renderColdRoom(calculateColdRoomStock(coldProcessedRows, coldSalesRows, coldFilters()));
  setStatus('Stock actualizado por variedad y medida');
}

document.addEventListener('DOMContentLoaded', initCuartoFrio);

let qualityRows = [];
let salesRows = [];
let pendingSalesRows = [];
let stockRows = [];
let stockData = null;

function loginOk() {
  return sessionStorage.getItem('altitudSellerAccess') === '1';
}

function showApp() {
  if ($('loginView')) $('loginView').style.display = 'none';
  if ($('appView')) $('appView').style.display = 'block';
}

function saleId(row) {
  return text(row.id_venta) || [row.fecha, row.vendedor, row.cliente, row.variedad, row.medida_cm, row.tallos, row.total_venta].map(text).join('|');
}

function saleById(rows, id) {
  return rows.find(row => saleId(row) === id);
}

function allSalesForDetail() {
  const confirmedIds = new Set(salesRows.map(saleId));
  return [...salesRows, ...pendingSalesRows.filter(row => !confirmedIds.has(saleId(row)))];
}

function renderSalesDetail() {
  const rows = normalizeSales(allSalesForDetail())
    .filter(row => ALTITUD.variedades.includes(row.variedad))
    .sort((a, b) => text(b.creado_en).localeCompare(text(a.creado_en)) || text(b.fecha).localeCompare(text(a.fecha)));

  renderRows($('salesBody'), rows, [
    row => row.fecha,
    row => row.vendedor,
    row => row.cliente,
    row => row.variedad,
    row => medidaLabel(row.medida_cm),
    row => fmtInt(row.tallos),
    row => fmtMoney(row.total_venta || row.tallos * row.precio_unitario),
    row => `<span class="pill ${row.pending ? 'warn' : 'ok'}">${row.pending ? 'LOCAL' : row.estado}</span>`,
    row => row.pending
      ? `<button class="btn small" type="button" data-retry-sale="${saleId(row)}">Reintentar</button> <button class="btn danger small" type="button" data-delete-pending="${saleId(row)}">Descartar</button>`
      : `<button class="btn danger small" type="button" data-delete-sale="${saleId(row)}">Eliminar</button>`
  ]);
}

function currentStock(variedad, medida) {
  return getStockForSale(stockData, variedad, medida).stockDisponible || 0;
}

function activeMeasureRows() {
  return (stockData?.porVariedadMedida || []).filter(row => ALTITUD.variedades.includes(row.variedad));
}

function fillSaleSelects() {
  const rows = activeMeasureRows().filter(row => row.stockDisponible > 0);
  const varieties = ALTITUD.variedades.filter(variedad => rows.some(row => row.variedad === variedad));
  $('saleVariedad').innerHTML = (varieties.length ? varieties : ALTITUD.variedades)
    .map(variedad => `<option value="${variedad}">${variedad}</option>`)
    .join('');
  updateMeasureOptions();
}

function saleTipoMedidas() {
  return text($('saleTipo')?.value).toUpperCase() === 'NACIONAL' ? ['NACIONAL'] : ['70', '60', '55', '50'];
}

function updateMeasureOptions() {
  const variedad = $('saleVariedad').value;
  const selected = normalizarMedida($('saleMedida')?.value);
  const measures = saleTipoMedidas();
  $('saleMedida').innerHTML = measures.map(medida => {
    const row = getStockForSale(stockData, variedad, medida);
    const disabled = row.stockDisponible <= 0 ? ' disabled' : '';
    return `<option value="${medida}"${disabled}>${medidaLabel(medida)} - ${fmtInt(row.stockDisponible)}</option>`;
  }).join('');
  if (measures.includes(selected)) $('saleMedida').value = selected;
}

function syncTallosFromBunches() {
  const bunches = asNumber($('saleBunches').value);
  if (bunches > 0) $('saleTallos').value = bunches * (ALTITUD.tallosPorBunch || 10);
}

function stockMessage(variedad, medida, tallos) {
  const row = getStockForSale(stockData, variedad, medida);
  const other = otherMeasureSuggestions(stockData, variedad, medida);
  if (row.stockDisponible <= 0) {
    return other.length
      ? `La medida seleccionada esta agotada. Existe stock disponible en otras medidas: ${other.map(item => medidaLabel(item.medida)).join(', ')}.`
      : 'La medida seleccionada esta agotada.';
  }
  if (tallos > row.stockDisponible) {
    return other.length
      ? `No hay stock suficiente para esta variedad y medida. Existe stock disponible en otras medidas: ${other.map(item => medidaLabel(item.medida)).join(', ')}.`
      : 'No hay stock suficiente para esta variedad y medida.';
  }
  return 'Listo para registrar una venta.';
}

function updatePreview() {
  const variedad = $('saleVariedad').value;
  const medida = $('saleMedida').value;
  const tallos = asNumber($('saleTallos').value);
  const precio = asNumber($('salePrecio').value);
  const disponible = currentStock(variedad, medida);
  $('saleDisponible').textContent = fmtInt(disponible);
  $('saleTotal').textContent = fmtMoney(tallos * precio);
  const msg = $('saleMessage');
  msg.textContent = stockMessage(variedad, medida, tallos);
  msg.style.color = tallos > disponible || disponible <= 0 ? '#8d2929' : 'var(--muted)';
}

function renderVendedores() {
  // Solo las ventas confirmadas en Sheets descuentan el inventario compartido.
  stockData = calculateColdRoomStock(qualityRows, salesRows);
  stockRows = stockData.porVariedadMedida;
  const visibleRows = activeMeasureRows();
  const totalStock = stockData.resumen.stockDisponible;
  const vendido = stockData.resumen.vendido;
  const ingresos = normalizeSales(salesRows)
    .filter(row => ALTITUD.variedades.includes(row.variedad))
    .reduce((total, row) => total + (row.total_venta || row.tallos * row.precio_unitario), 0);

  $('kStock').textContent = fmtInt(totalStock);
  $('kVendido').textContent = fmtInt(vendido);
  $('kIngresos').textContent = fmtMoney(ingresos);
  $('kVariedades').textContent = fmtInt(stockData.resumen.variedadesDisponibles);
  renderRows($('availabilityBody'), visibleRows, [
    row => row.variedad,
    row => medidaLabel(row.medida),
    row => fmtInt(row.procesadoUtil),
    row => fmtInt(row.vendido),
    row => fmtInt(row.stockDisponible),
    row => `<span class="pill ${row.estado === 'AGOTADO' || row.estado === 'INCONSISTENCIA' ? 'bad' : row.estado === 'BAJO STOCK' ? 'warn' : 'ok'}">${row.estado}</span>`
  ]);
  fillSaleSelects();
  updatePreview();
  renderSalesDetail();
}

function reconcilePendingSales() {
  const confirmedIds = new Set(salesRows.map(saleId));
  pendingSalesRows = pendingSalesRows.filter(row => !confirmedIds.has(saleId(row)));
  savePendingSales(pendingSalesRows);
}

async function loadVendedores() {
  setStatus('Cargando ventas...');
  const data = await loadProcessedAndSales();
  qualityRows = data.quality;
  salesRows = data.sales;
  pendingSalesRows = data.pendingSales || [];
  reconcilePendingSales();
  renderVendedores();
  const pendingText = pendingSalesRows.length ? ` · ${pendingSalesRows.length} pendiente(s) de confirmar` : '';
  setStatus(`En linea - ${qualityRows.length} controles de calidad${pendingText}`);
}

function buildSaleRecord() {
  syncTallosFromBunches();
  const now = new Date();
  const bunches = asNumber($('saleBunches').value);
  const tallos = asNumber($('saleTallos').value);
  const precio = asNumber($('salePrecio').value);
  const tipo = text($('saleTipo').value).toUpperCase();
  const medida = tipo === 'NACIONAL' ? 'NACIONAL' : normalizarMedida($('saleMedida').value);
  return {
    id_venta: `V-${Date.now()}`,
    fecha: todayISO(),
    hora: now.toTimeString().slice(0, 5),
    vendedor: text($('saleVendedor').value),
    cliente: text($('saleCliente').value),
    variedad: text($('saleVariedad').value).toUpperCase(),
    medida_cm: medida,
    tipo,
    bunches,
    tallos,
    precio_unitario: precio,
    total_venta: tallos * precio,
    estado: 'VENDIDO',
    observaciones: text($('saleObs').value),
    creado_en: now.toISOString(),
    origen: 'WEB',
    pending: true
  };
}

async function confirmSaleInSheets(id, attempts = 7) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 900));
    try {
      const remoteSales = normalizeSales(await loadSheet(ALTITUD.sheets.ventas));
      if (remoteSales.some(row => saleId(row) === id)) return remoteSales;
    } catch (err) {
      // El siguiente intento vuelve a consultar la fuente compartida.
    }
  }
  return null;
}

async function confirmSaleDeletedFromSheets(id, attempts = 7) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 900));
    try {
      const remoteSales = normalizeSales(await loadSheet(ALTITUD.sheets.ventas));
      if (!remoteSales.some(row => saleId(row) === id)) return remoteSales;
    } catch (err) {
      // El siguiente intento vuelve a consultar la fuente compartida.
    }
  }
  return null;
}

async function sendPendingSale(record) {
  const msg = $('saleMessage');
  msg.textContent = 'Guardando y verificando en Google Sheets...';
  msg.style.color = 'var(--muted)';
  try {
    await submitRecord(ALTITUD.sheets.ventas, record);
    const confirmed = await confirmSaleInSheets(saleId(record));
    if (!confirmed) throw new Error('La venta no fue confirmada por Sheets');
    salesRows = confirmed;
    pendingSalesRows = pendingSalesRows.filter(row => saleId(row) !== saleId(record));
    savePendingSales(pendingSalesRows);
    renderVendedores();
    msg.textContent = 'Venta confirmada en Sheets. Vendedores y Cuarto frio ya muestran el mismo stock.';
    msg.style.color = 'var(--green-800)';
    return true;
  } catch (err) {
    record.pending = true;
    if (!saleById(pendingSalesRows, saleId(record))) pendingSalesRows.push(record);
    savePendingSales(pendingSalesRows);
    renderVendedores();
    msg.textContent = 'La venta no fue confirmada en Sheets y no se desconto del stock compartido. Usa Reintentar en el detalle.';
    msg.style.color = '#8d2929';
    return false;
  }
}

async function initVendedores() {
  if ($('loginForm')) $('loginForm').addEventListener('submit', event => {
    event.preventDefault();
    const user = text($('user').value).toUpperCase();
    const pin = text($('pin').value);
    if (ALTITUD.sellerUsers[user] === pin) {
      sessionStorage.setItem('altitudSellerAccess', '1');
      showApp();
      loadVendedores();
    } else {
      $('loginError').style.display = 'block';
    }
  });

  if (loginOk()) {
    showApp();
    loadVendedores();
  }

  $('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('altitudSellerAccess');
    location.reload();
  });
  $('refreshBtn')?.addEventListener('click', loadVendedores);
  $('saleVariedad')?.addEventListener('change', () => {
    updateMeasureOptions();
    updatePreview();
  });
  $('saleMedida')?.addEventListener('change', updatePreview);
  $('saleTipo')?.addEventListener('change', () => {
    updateMeasureOptions();
    updatePreview();
  });
  ['saleTallos', 'salePrecio'].forEach(id => $(id)?.addEventListener('input', updatePreview));
  $('saleBunches')?.addEventListener('input', () => {
    syncTallosFromBunches();
    updatePreview();
  });

  $('salesBody')?.addEventListener('click', async event => {
    const retryButton = event.target.closest('[data-retry-sale]');
    if (retryButton) {
      const record = saleById(pendingSalesRows, retryButton.dataset.retrySale);
      if (record) await sendPendingSale(record);
      return;
    }

    const discardButton = event.target.closest('[data-delete-pending]');
    if (discardButton) {
      pendingSalesRows = pendingSalesRows.filter(row => saleId(row) !== discardButton.dataset.deletePending);
      savePendingSales(pendingSalesRows);
      renderVendedores();
      const msg = $('saleMessage');
      msg.textContent = 'Registro local descartado. El stock compartido no cambio.';
      msg.style.color = 'var(--muted)';
      return;
    }

    const deleteButton = event.target.closest('[data-delete-sale]');
    if (!deleteButton) return;
    const id = deleteButton.dataset.deleteSale;
    if (!confirm('Eliminar esta venta? El stock volvera a estar disponible.')) return;
    const msg = $('saleMessage');
    msg.textContent = 'Eliminando venta...';
    try {
      await deleteSheetRecord(ALTITUD.sheets.ventas, 'id_venta', id);
      const confirmed = await confirmSaleDeletedFromSheets(id);
      if (!confirmed) throw new Error('La eliminacion no fue confirmada por Sheets');
      salesRows = confirmed;
      renderVendedores();
      msg.textContent = 'Venta eliminada y stock actualizado.';
      msg.style.color = 'var(--green-800)';
    } catch (err) {
      msg.textContent = 'La eliminacion no fue confirmada en Sheets. El stock compartido no se modifico.';
      msg.style.color = '#8d2929';
    }
  });

  $('saleForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const record = buildSaleRecord();
    const row = getStockForSale(stockData, record.variedad, record.medida_cm);
    const msg = $('saleMessage');
    if (!record.vendedor || !record.cliente || !record.tallos) {
      msg.textContent = 'Completa vendedor, cliente y tallos.';
      msg.style.color = '#8d2929';
      return;
    }
    if (row.stockDisponible <= 0 || record.tallos > row.stockDisponible) {
      msg.textContent = stockMessage(record.variedad, record.medida_cm, record.tallos);
      msg.style.color = '#8d2929';
      return;
    }

    pendingSalesRows.push(record);
    savePendingSales(pendingSalesRows);
    renderSalesDetail();
    const saved = await sendPendingSale(record);
    if (saved) {
      $('saleForm').reset();
      updateMeasureOptions();
      updatePreview();
    }
  });

  window.setInterval(() => {
    if (loginOk()) loadVendedores();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', initVendedores);

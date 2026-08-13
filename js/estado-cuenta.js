let estadoRows = [];

function estadoFromSaldo(valorTotal, saldo, vencimiento) {
  const today = todayISO();
  if (saldo <= 0) return 'PAGADO';
  if (vencimiento && vencimiento < today) return 'VENCIDO';
  if (saldo >= valorTotal) return 'PENDIENTE';
  return 'ABONADO';
}

function normalizeEstadoCuenta(rows) {
  return (rows || []).map(row => {
    const valor = asNumber(row.valor_factura || row.valor_total || row.valor);
    const saldo = asNumber(row.saldo_pendiente || row.saldo);
    const pagado = asNumber(row.valor_pagado) || Math.max(0, valor - saldo);
    const factura = text(row.numero_factura || row.factura);
    const vencimiento = text(row.fecha_vencimiento);
    const estado = text(row.estado).toUpperCase() || estadoFromSaldo(valor, saldo, vencimiento);
    return {
      id_movimiento: text(row.id_movimiento || row.id_factura),
      fecha: text(row.fecha || row.fecha_emision),
      cliente: text(row.cliente),
      concepto: text(row.concepto || 'Ventas de flor'),
      tipo_movimiento: text(row.tipo_movimiento || 'FACTURA').toUpperCase(),
      numero_factura: factura,
      valor_factura: valor,
      valor_pagado: pagado,
      saldo_pendiente: saldo,
      estado: estado === 'POR COBRAR' ? estadoFromSaldo(valor, saldo, vencimiento) : estado,
      fecha_vencimiento: vencimiento,
      vendedor: text(row.vendedor),
      observacion: text(row.observacion || row.observaciones),
      url_pdf_factura: text(row.url_pdf_factura)
    };
  }).filter(row => row.cliente && (row.numero_factura || row.valor_factura || row.valor_pagado));
}

function latestInvoiceMap(rows) {
  const map = {};
  rows.forEach(row => {
    if (row.numero_factura) map[row.numero_factura] = row;
  });
  return map;
}

function filteredRows() {
  const cliente = text($('clienteFiltro').value).toUpperCase();
  const estado = text($('estadoFiltro').value).toUpperCase();
  return estadoRows.filter(row => {
    const okCliente = !cliente || row.cliente.toUpperCase().includes(cliente);
    const okEstado = !estado || row.estado === estado;
    return okCliente && okEstado;
  });
}

function renderEstadoCuenta() {
  const today = todayISO();
  const invoiceMap = new Map();
  estadoRows.filter(row => row.tipo_movimiento === 'FACTURA' || row.valor_factura).forEach(row => {
    const key = row.numero_factura || `${row.cliente}|${row.fecha}|${row.valor_factura}`;
    if (!invoiceMap.has(key)) invoiceMap.set(key, row);
  });
  const invoiceRows = Array.from(invoiceMap.values());
  const totalFacturado = invoiceRows.reduce((sum, row) => sum + row.valor_factura, 0);
  const totalPendiente = invoiceRows.reduce((sum, row) => sum + row.saldo_pendiente, 0);
  const totalCobrado = Math.max(0, totalFacturado - totalPendiente);
  const vencidas = invoiceRows.filter(row => row.saldo_pendiente > 0 && ((row.fecha_vencimiento && row.fecha_vencimiento < today) || row.estado === 'VENCIDO')).length;
  $('kFacturado').textContent = fmtMoney(totalFacturado);
  $('kCobrado').textContent = fmtMoney(totalCobrado);
  $('kPendiente').textContent = fmtMoney(totalPendiente);
  $('kVencidas').textContent = fmtInt(vencidas);
  renderRows($('estadoBody'), filteredRows(), [
    row => row.cliente || '-',
    row => row.numero_factura || '-',
    row => fmtMoney(row.valor_factura),
    row => fmtMoney(row.valor_pagado),
    row => fmtMoney(row.saldo_pendiente),
    row => `<span class="pill ${row.estado === 'VENCIDO' ? 'bad' : row.estado === 'ABONADO' || row.estado === 'PENDIENTE' ? 'warn' : ''}">${row.estado || '-'}</span>`,
    row => row.url_pdf_factura ? `<a href="${row.url_pdf_factura}" target="_blank" rel="noopener">PDF</a>` : '-'
  ]);
}

async function loadEstadoCuenta() {
  try {
    const rows = await loadSheet(ALTITUD.sheets.estadoCuenta);
    estadoRows = normalizeEstadoCuenta(rows);
  } catch (err) {
    estadoRows = normalizeEstadoCuenta(localDataRows('cuentas'));
  }
  renderEstadoCuenta();
  setStatus(`Estado de cuenta actualizado - ${fmtInt(estadoRows.length)} registros`);
}

function readPdf(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      mimeType: file.type || 'application/pdf',
      data: String(reader.result).split(',')[1] || ''
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function postEstadoCuenta(action, record, pdf) {
  if (!ALTITUD.estadoCuentaUrl) throw new Error('Falta configurar APPS_SCRIPT_ESTADO_CUENTA_URL en js/config.js');
  await fetch(ALTITUD.estadoCuentaUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, record, pdf, driveFolderId: ALTITUD.driveFolderFacturasId })
  });
}

function updateFacturaPreview() {
  const valor = asNumber($('factValor').value);
  const vencimiento = $('factVence').value;
  $('factSaldo').textContent = fmtMoney(valor);
  $('factEstado').textContent = estadoFromSaldo(valor, valor, vencimiento);
}

function updatePagoPreview() {
  const tipo = $('pagoTipo').value;
  const invoice = latestInvoiceMap(estadoRows)[$('pagoFactura').value];
  const valorPago = asNumber($('pagoValor').value);
  const saldoActual = invoice ? invoice.saldo_pendiente : 0;
  const saldoPosterior = tipo === 'OTRO_INGRESO' ? 0 : Math.max(0, saldoActual - valorPago);
  const total = invoice ? invoice.valor_factura : valorPago;
  const estado = tipo === 'OTRO_INGRESO' ? 'PAGADO' : estadoFromSaldo(total, saldoPosterior, invoice?.fecha_vencimiento || '');
  $('pagoSaldo').textContent = fmtMoney(saldoPosterior);
  $('pagoEstado').textContent = estado;
  if (invoice && !$('pagoCliente').value) $('pagoCliente').value = invoice.cliente;
}

function appendLocal(row) {
  estadoRows.push(row);
  renderEstadoCuenta();
}

async function setupForms() {
  $('factFecha').value = todayISO();
  $('pagoFecha').value = todayISO();
  ['factValor', 'factVence'].forEach(id => $(id).addEventListener('input', updateFacturaPreview));
  ['pagoTipo', 'pagoFactura', 'pagoValor'].forEach(id => $(id).addEventListener('input', updatePagoPreview));
  ['clienteFiltro', 'estadoFiltro'].forEach(id => $(id).addEventListener('input', renderEstadoCuenta));
  $('refreshBtn').addEventListener('click', loadEstadoCuenta);
  updateFacturaPreview();
  updatePagoPreview();

  $('facturaForm').addEventListener('submit', async event => {
    event.preventDefault();
    const valor = asNumber($('factValor').value);
    const record = {
      id_movimiento: `EC-${Date.now()}`,
      id_factura: `FAC-${Date.now()}`,
      fecha: $('factFecha').value,
      fecha_emision: $('factFecha').value,
      cliente: text($('factCliente').value),
      concepto: text($('factConcepto').value),
      descripcion: text($('factConcepto').value),
      tipo_movimiento: 'FACTURA',
      numero_factura: text($('factNumero').value),
      valor_factura: valor,
      valor_total: valor,
      valor_pagado: 0,
      saldo_pendiente: valor,
      estado: estadoFromSaldo(valor, valor, $('factVence').value),
      fecha_vencimiento: $('factVence').value,
      vendedor: '',
      observacion: text($('factObs').value),
      fecha_registro: new Date().toISOString()
    };
    const pdf = await readPdf($('factPdf').files[0]);
    try {
      await postEstadoCuenta('registrarFactura', record, pdf);
      $('factMsg').textContent = 'Factura enviada a Google Sheets.';
      $('facturaForm').reset();
      $('factFecha').value = todayISO();
      updateFacturaPreview();
      await loadEstadoCuenta();
    } catch (err) {
      appendLocal(normalizeEstadoCuenta([record])[0]);
      $('factMsg').textContent = `${err.message}. Se mostro localmente hasta configurar Apps Script.`;
    }
  });

  $('pagoForm').addEventListener('submit', async event => {
    event.preventDefault();
    const invoice = latestInvoiceMap(estadoRows)[$('pagoFactura').value];
    const tipo = $('pagoTipo').value;
    const valor = asNumber($('pagoValor').value);
    const saldoPosterior = tipo === 'OTRO_INGRESO' ? 0 : Math.max(0, (invoice?.saldo_pendiente || 0) - valor);
    const record = {
      id_movimiento: `EC-${Date.now()}`,
      id_pago: `PAG-${Date.now()}`,
      id_ingreso: `ING-${Date.now()}`,
      fecha: $('pagoFecha').value,
      fecha_pago: $('pagoFecha').value,
      cliente: text($('pagoCliente').value),
      concepto: tipo === 'OTRO_INGRESO' ? 'Otros ingresos' : 'Abonos de clientes',
      descripcion: text($('pagoObs').value),
      tipo_movimiento: tipo,
      numero_factura: text($('pagoFactura').value),
      valor_factura: invoice?.valor_factura || 0,
      valor_pagado: valor,
      valor_ingresado: valor,
      saldo_pendiente: saldoPosterior,
      estado: tipo === 'OTRO_INGRESO' ? 'PAGADO' : estadoFromSaldo(invoice?.valor_factura || valor, saldoPosterior, invoice?.fecha_vencimiento || ''),
      forma_pago: text($('pagoForma').value),
      vendedor: text($('pagoVendedor').value),
      observacion: text($('pagoObs').value),
      fecha_registro: new Date().toISOString()
    };
    try {
      await postEstadoCuenta(tipo === 'OTRO_INGRESO' ? 'registrarIngreso' : 'registrarPago', record);
      $('pagoMsg').textContent = 'Pago enviado a Google Sheets.';
      $('pagoForm').reset();
      $('pagoFecha').value = todayISO();
      updatePagoPreview();
      await loadEstadoCuenta();
    } catch (err) {
      appendLocal(normalizeEstadoCuenta([record])[0]);
      $('pagoMsg').textContent = `${err.message}. Se mostro localmente hasta configurar Apps Script.`;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadEstadoCuenta();
  setupForms();
});

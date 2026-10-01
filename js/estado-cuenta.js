let estadoRows = [];
let invoiceRows = [];
let invoiceLookup = new Map();
let shipmentRows = [];
let selectedShipmentIds = new Set();
const PDF_JS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

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
    const saldoRaw = row.saldo_pendiente ?? row.saldo;
    const estadoRegistrado = text(row.estado).toUpperCase();
    let saldo = saldoRaw === '' || saldoRaw === null || saldoRaw === undefined
      ? Math.max(0, valor - asNumber(row.valor_pagado))
      : asNumber(saldoRaw);
    if (estadoRegistrado === 'PAGADO') saldo = 0;
    else if (valor > 0) saldo = Math.min(valor, Math.max(0, saldo));
    const pagado = Math.max(asNumber(row.valor_pagado), Math.max(0, valor - saldo));
    const factura = text(row.numero_factura || row.factura);
    const vencimiento = text(row.fecha_vencimiento);
    // Una factura anulada no se deduce del saldo: sin valor ni saldo se veria
    // como PAGADO, que es justo lo contrario de lo que paso. El estado escrito
    // en la hoja manda.
    const estado = estadoRegistrado === 'ANULADA' || estadoRegistrado === 'ANULADO'
      ? 'ANULADA'
      : estadoFromSaldo(valor, saldo, vencimiento);
    return {
      id_movimiento: text(row.id_movimiento || row.id_factura),
      id_factura: text(row.id_factura),
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
      url_pdf_factura: text(row.url_pdf_factura),
      ids_ventas: text(row.ids_ventas),
      tallos_enviados: asNumber(row.tallos_enviados),
      bunches_enviados: asNumber(row.bunches_enviados),
      cajas_enviadas: asNumber(row.cajas_enviadas),
      detalle_envio: text(row.detalle_envio),
      fecha_registro: text(row.fecha_registro),
      ruc_cedula: text(row.ruc_cedula),
      nota_credito: asNumber(row.nota_credito)
    };
    // Un movimiento con plata cuenta aunque le falte el cliente o el numero de
    // factura. Exigir cliente dejaba fuera de la cartera facturas reales.
  }).filter(row => row.numero_factura || row.valor_factura || row.valor_pagado || row.saldo_pendiente);
}

function invoiceKey(value) {
  return text(value).toUpperCase();
}

function canonicalInvoiceRows(rows) {
  const map = new Map();
  // Los movimientos sin numero de factura tambien entran. Antes se descartaban
  // aqui en silencio, y con ellos se iba plata real de la cartera. Cada uno
  // recibe su propia clave para que no se fusionen entre si.
  (rows || []).forEach((row, indice) => {
    const key = row.numero_factura
      ? invoiceKey(row.numero_factura)
      : `SIN-NUMERO::${row.id_movimiento || row.id_factura || indice}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...row, tipo_movimiento: 'FACTURA' });
      return;
    }
    const valor = Math.max(current.valor_factura, row.valor_factura);
    const saldo = Math.min(current.saldo_pendiente, row.saldo_pendiente);
    current.valor_factura = valor;
    current.saldo_pendiente = Math.max(0, saldo);
    current.valor_pagado = Math.max(0, valor - current.saldo_pendiente);
    current.fecha_vencimiento = row.fecha_vencimiento || current.fecha_vencimiento;
    current.vendedor = row.vendedor || current.vendedor;
    current.url_pdf_factura = row.url_pdf_factura || current.url_pdf_factura;
    current.ids_ventas = row.ids_ventas || current.ids_ventas;
    current.tallos_enviados = Math.max(current.tallos_enviados, row.tallos_enviados);
    current.bunches_enviados = Math.max(current.bunches_enviados, row.bunches_enviados);
    current.cajas_enviadas = Math.max(current.cajas_enviadas, row.cajas_enviadas);
    current.detalle_envio = row.detalle_envio || current.detalle_envio;
    current.observacion = row.observacion || current.observacion;
    // Si cualquiera de las dos copias esta anulada, la fusion lo respeta. Al
    // recalcular el estado desde el saldo se perdia la anulacion y la factura
    // volvia a figurar como pendiente de cobro.
    current.estado = current.estado === 'ANULADA' || row.estado === 'ANULADA'
      ? 'ANULADA'
      : estadoFromSaldo(valor, current.saldo_pendiente, current.fecha_vencimiento);
  });
  return Array.from(map.values()).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

function rebuildInvoiceLookup() {
  invoiceLookup = new Map(invoiceRows.map(row => [invoiceKey(row.numero_factura), row]));
  const datalist = $('facturasPendientesList');
  if (!datalist) return;
  datalist.replaceChildren(...invoiceRows.filter(row => row.saldo_pendiente > 0).map(row => {
    const option = document.createElement('option');
    option.value = row.numero_factura;
    option.label = `${row.cliente} · Saldo ${fmtMoney(row.saldo_pendiente)}`;
    return option;
  }));
}

function selectedInvoice() {
  return invoiceLookup.get(invoiceKey($('pagoFactura').value));
}

function filteredRows() {
  const cliente = text($('clienteFiltro').value).toUpperCase();
  const estado = text($('estadoFiltro').value).toUpperCase();
  return invoiceRows.filter(row => {
    const okCliente = !cliente || row.cliente.toUpperCase().includes(cliente);
    const okEstado = !estado || row.estado === estado;
    return okCliente && okEstado;
  });
}

function shipmentBillingState(row) {
  return row.numero_factura || row.estado_facturacion === 'FACTURADO' ? 'FACTURADO' : 'PENDIENTE';
}

function pendingShipments() {
  return shipmentRows.filter(row => row.id_venta && shipmentBillingState(row) === 'PENDIENTE');
}

function normalizedClientKey(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function selectedShipments() {
  return pendingShipments().filter(row => selectedShipmentIds.has(row.id_venta));
}

function shipmentTotals(rows) {
  return (rows || []).reduce((totals, row) => {
    const packing = shipmentPacking(row);
    totals.tallos += asNumber(row.tallos);
    totals.bunches += packing.bunches;
    totals.cajas += packing.cajasEnviadas;
    totals.valor += asNumber(row.total_venta || row.tallos * row.precio_unitario);
    return totals;
  }, { tallos: 0, bunches: 0, cajas: 0, valor: 0 });
}

function renderPendingShipmentSelection() {
  const rows = pendingShipments().sort((a, b) => text(b.fecha).localeCompare(text(a.fecha)) || a.cliente.localeCompare(b.cliente));
  renderRows($('pendingShipmentsBody'), rows, [
    row => `<input class="shipment-checkbox" type="checkbox" data-shipment-id="${row.id_venta}" aria-label="Incluir despacho ${row.id_venta}" ${selectedShipmentIds.has(row.id_venta) ? 'checked' : ''}>`,
    row => row.fecha || '-',
    row => row.cliente || '-',
    row => `${row.variedad} · ${medidaLabel(row.medida_cm)}`,
    row => fmtInt(row.tallos),
    row => shipmentPackingLabel(row),
    row => fmtMoney(row.total_venta || row.tallos * row.precio_unitario)
  ], 'No hay despachos pendientes de facturar.');
  updateShipmentSelectionSummary();
}

function updateShipmentSelectionSummary() {
  const rows = selectedShipments();
  const totals = shipmentTotals(rows);
  $('shipmentSelectionSummary').textContent = rows.length
    ? `${fmtInt(rows.length)} despacho(s) · ${fmtInt(totals.tallos)} tallos · ${fmtInt(totals.cajas)} cajas · ${fmtMoney(totals.valor)} en ventas`
    : 'Ningun despacho seleccionado.';
}

function selectClientShipments() {
  const clientKey = normalizedClientKey($('factCliente').value);
  if (!clientKey) {
    $('factMsg').textContent = 'Escribe o carga primero el cliente de la factura.';
    return;
  }
  const matches = pendingShipments().filter(row => normalizedClientKey(row.cliente) === clientKey);
  selectedShipmentIds = new Set(matches.map(row => row.id_venta));
  renderPendingShipmentSelection();
  $('factMsg').textContent = matches.length
    ? `Se seleccionaron ${fmtInt(matches.length)} despachos pendientes de ${$('factCliente').value}. Revisa la lista antes de guardar.`
    : 'No se encontraron despachos pendientes con ese nombre de cliente. Puedes seleccionarlos manualmente.';
}

function filteredShipmentRows() {
  const cliente = text($('shipmentClientFilter')?.value).toUpperCase();
  const estado = text($('shipmentStatusFilter')?.value).toUpperCase();
  const desde = text($('shipmentFromFilter')?.value);
  const hasta = text($('shipmentToFilter')?.value);
  return shipmentRows.filter(row => {
    const state = shipmentBillingState(row);
    return (!cliente || row.cliente.toUpperCase().includes(cliente))
      && (!estado || state === estado)
      && (!desde || row.fecha >= desde)
      && (!hasta || row.fecha <= hasta);
  }).sort((a, b) => text(b.fecha).localeCompare(text(a.fecha)) || a.cliente.localeCompare(b.cliente));
}

function renderShipmentInventory() {
  const total = shipmentTotals(shipmentRows);
  const pending = shipmentTotals(pendingShipments());
  $('kCajasEnviadas').textContent = fmtInt(total.cajas);
  $('kCajasPendientes').textContent = fmtInt(pending.cajas);
  $('kDespachos').textContent = fmtInt(shipmentRows.length);
  renderRows($('shipmentsBody'), filteredShipmentRows(), [
    row => row.fecha || '-',
    row => row.cliente || '-',
    row => row.variedad,
    row => medidaLabel(row.medida_cm),
    row => fmtInt(row.tallos),
    row => fmtInt(shipmentPacking(row).bunches),
    row => shipmentPacking(row).tipoCaja,
    row => shipmentPackingLabel(row),
    row => row.numero_factura || '-',
    row => `<span class="pill ${shipmentBillingState(row) === 'FACTURADO' ? 'ok' : 'warn'}">${shipmentBillingState(row)}</span>`
  ], 'No hay despachos registrados con estos filtros.');
}

function printShipmentInventory() {
  const rows = filteredShipmentRows();
  const totals = shipmentTotals(rows);
  const generatedAt = new Date().toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
  const report = window.open('', '_blank');
  if (!report) {
    setStatus('El navegador bloqueo la ventana del reporte. Habilita ventanas emergentes e intenta nuevamente.');
    return;
  }
  report.opener = null;
  report.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Inventario de cajas enviadas</title><style>
    body{font-family:Arial,sans-serif;color:#172016;margin:28px}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #536313;padding-bottom:16px;margin-bottom:28px}h1{font-family:Georgia,serif;color:#4f5c1d;margin:0;font-size:36px}h2{margin:0 0 8px}.meta{text-align:right}.summary{display:flex;gap:28px;margin:18px 0;font-weight:700;color:#4f5c1d}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dfe3d6;padding:9px;text-align:left}th{background:#f1f4ea;text-transform:uppercase;font-size:10px}td.num,th.num{text-align:right}tfoot th{font-size:12px}footer{margin-top:36px;padding-top:14px;border-top:1px solid #dfe3d6;text-align:center;color:#6d7168}@page{size:landscape;margin:12mm}@media print{body{margin:0}}
  </style></head><body><header><h1>Altitud Flowers</h1><div class="meta"><strong>Generado</strong><br>${generatedAt}</div></header><h2>Inventario de cajas enviadas</h2><p>Despachos registrados desde ventas y su estado de facturacion.</p><div class="summary"><span>${fmtInt(rows.length)} despachos</span><span>${fmtInt(totals.tallos)} tallos</span><span>${fmtInt(totals.bunches)} bunches</span><span>${fmtInt(totals.cajas)} cajas</span></div><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Variedad</th><th>Medida</th><th class="num">Tallos</th><th class="num">Bunches</th><th>Tipo caja</th><th class="num">Cajas</th><th>Factura</th><th>Estado</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.fecha}</td><td>${row.cliente}</td><td>${row.variedad}</td><td>${medidaLabel(row.medida_cm)}</td><td class="num">${fmtInt(row.tallos)}</td><td class="num">${fmtInt(shipmentPacking(row).bunches)}</td><td>${shipmentPacking(row).tipoCaja}</td><td class="num">${fmtInt(shipmentPacking(row).cajasEnviadas)}</td><td>${row.numero_factura || '-'}</td><td>${shipmentBillingState(row)}</td></tr>`).join('') || '<tr><td colspan="10">Sin despachos.</td></tr>'}</tbody><tfoot><tr><th colspan="4">TOTAL</th><th class="num">${fmtInt(totals.tallos)}</th><th class="num">${fmtInt(totals.bunches)}</th><th></th><th class="num">${fmtInt(totals.cajas)}</th><th colspan="2"></th></tr></tfoot></table><footer>Altitud Flowers · Reporte interno de cajas enviadas</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
  report.document.close();
}

function renderEstadoCuenta() {
  const today = todayISO();
  // Una factura anulada sigue listandose, para que quede rastro, pero no suma
  // en ningun total: no se facturo, no se cobro y nadie la debe.
  const vigentes = invoiceRows.filter(row => row.estado !== 'ANULADA');
  const totalFacturado = vigentes.reduce((sum, row) => sum + row.valor_factura, 0);
  const totalPendiente = vigentes.reduce((sum, row) => sum + row.saldo_pendiente, 0);
  // Una nota de credito rebaja la factura: no es plata que entro. Sin restarla,
  // "cobrado" contaba como ingreso lo que en realidad se le perdono al cliente.
  const totalNotas = vigentes.reduce((sum, row) => sum + (row.nota_credito || 0), 0);
  const totalCobrado = Math.max(0, totalFacturado - totalNotas - totalPendiente);
  if ($('kCobradoNota')) {
    $('kCobradoNota').textContent = totalNotas
      ? `Neto de ${fmtMoney(totalNotas)} en notas de credito`
      : 'Ingresos recibidos';
  }
  const vencidas = vigentes.filter(row => row.saldo_pendiente > 0 && ((row.fecha_vencimiento && row.fecha_vencimiento < today) || row.estado === 'VENCIDO')).length;
  $('kFacturado').textContent = fmtMoney(totalFacturado);
  $('kCobrado').textContent = fmtMoney(totalCobrado);
  $('kPendiente').textContent = fmtMoney(totalPendiente);
  $('kVencidas').textContent = fmtInt(vencidas);
  renderCarteraAviso();
  renderRows($('estadoBody'), filteredRows(), [
    row => row.cliente
      ? `${row.cliente}${row.ruc_cedula ? `<span class="celda-nota">${row.ruc_cedula}</span>` : ''}`
      : '<span class="falta">Sin cliente</span>',
    row => row.numero_factura || '<span class="falta">Sin numero</span>',
    row => row.cajas_enviadas ? `${fmtInt(row.cajas_enviadas)} cajas · ${fmtInt(row.tallos_enviados)} tallos` : '-',
    row => `${fmtMoney(row.valor_factura)}${row.nota_credito ? `<span class="celda-nota">NC ${fmtMoney(row.nota_credito)}</span>` : ''}`,
    row => fmtMoney(row.valor_pagado),
    row => fmtMoney(row.saldo_pendiente),
    row => antiguedadTexto(row),
    row => `<span class="pill ${row.estado === 'VENCIDO' ? 'bad' : row.estado === 'ABONADO' || row.estado === 'PENDIENTE' ? 'warn' : ''}">${row.estado || '-'}</span>`,
    row => row.url_pdf_factura ? `<a href="${row.url_pdf_factura}" target="_blank" rel="noopener">PDF</a>` : '-'
  ]);
}

// Dias transcurridos desde la emision, solo para lo que sigue debiendose.
// Mientras fecha_vencimiento este vacia en la hoja no se puede hablar de
// "vencido", asi que se informa antiguedad, que es un dato que si existe.
function antiguedadTexto(row) {
  if (!row.saldo_pendiente) return '-';
  const emitida = normalizarFecha(row.fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(emitida)) return '<span class="falta">Sin fecha</span>';
  const dias = Math.floor((Date.now() - new Date(`${emitida}T00:00:00`).getTime()) / 86400000);
  if (dias < 0) return `<span class="falta">Fecha futura</span>`;
  const clase = dias > 90 ? 'bad' : dias > 45 ? 'warn' : '';
  return `<span class="pill ${clase}">${fmtInt(dias)} dias</span>`;
}

function renderCarteraAviso() {
  const aviso = $('carteraAviso');
  const revisar = invoiceRows.filter(row => row.estado !== 'ANULADA' && (!row.cliente || !row.numero_factura));
  const monto = revisar.reduce((sum, row) => sum + row.saldo_pendiente, 0);
  const facturado = revisar.reduce((sum, row) => sum + row.valor_factura, 0);
  if ($('kRevisar')) $('kRevisar').textContent = fmtInt(revisar.length);
  if ($('kRevisarNota')) $('kRevisarNota').textContent = revisar.length ? `${fmtMoney(monto)} por cobrar` : 'Todo identificado';
  if ($('kRevisarCard')) $('kRevisarCard').classList.toggle('activa', revisar.length > 0);
  if (!aviso) return;
  aviso.hidden = !revisar.length;
  if (!revisar.length) return;
  const sinCliente = revisar.filter(row => !row.cliente).length;
  const sinNumero = revisar.filter(row => !row.numero_factura).length;
  const ambos = revisar.filter(row => !row.cliente && !row.numero_factura).length;
  let detalle;
  if (ambos === revisar.length) detalle = 'ninguno tiene cliente ni numero de factura';
  else {
    const partes = [];
    if (sinCliente) partes.push(`${fmtInt(sinCliente)} sin cliente`);
    if (sinNumero) partes.push(`${fmtInt(sinNumero)} sin numero de factura`);
    detalle = partes.join(' y ');
  }
  aviso.innerHTML = `<strong>${fmtInt(revisar.length)} movimientos necesitan revision</strong>
    <span>${detalle}. Suman ${fmtMoney(facturado)} facturados, de los cuales
    <strong>${fmtMoney(monto)} siguen por cobrar</strong>. Estan incluidos en los totales de arriba,
    pero sin cliente no se les puede reclamar a nadie.</span>`;
}

async function loadEstadoCuenta() {
  const [estadoResult, facturasResult, ventasResult] = await Promise.allSettled([
    loadSheet(ALTITUD.sheets.estadoCuenta),
    loadSheet(ALTITUD.sheets.facturas),
    loadSheet(ALTITUD.sheets.ventas)
  ]);
  estadoRows = estadoResult.status === 'fulfilled'
    ? normalizeEstadoCuenta(estadoResult.value)
    : normalizeEstadoCuenta(localDataRows('cuentas'));
  const facturas = facturasResult.status === 'fulfilled'
    ? normalizeEstadoCuenta(facturasResult.value)
    : [];
  shipmentRows = ventasResult.status === 'fulfilled'
    ? normalizeSales(ventasResult.value)
    : [];
  invoiceRows = canonicalInvoiceRows([...estadoRows, ...facturas]);
  const invoiceBySaleId = new Map();
  invoiceRows.forEach(invoice => text(invoice.ids_ventas).split('|').map(text).filter(Boolean).forEach(id => invoiceBySaleId.set(id, invoice.numero_factura)));
  shipmentRows = shipmentRows.map(row => invoiceBySaleId.has(row.id_venta)
    ? { ...row, numero_factura: invoiceBySaleId.get(row.id_venta), estado_facturacion: 'FACTURADO' }
    : row);
  const pendingIds = new Set(pendingShipments().map(row => row.id_venta));
  selectedShipmentIds = new Set(Array.from(selectedShipmentIds).filter(id => pendingIds.has(id)));
  rebuildInvoiceLookup();
  renderEstadoCuenta();
  renderShipmentInventory();
  renderPendingShipmentSelection();
  applyInvoiceSelection();
  setStatus(`Estado de cuenta actualizado · ${fmtInt(invoiceRows.length)} facturas · ${fmtInt(pendingShipments().length)} despachos por facturar`);
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

function normalizeInvoiceText(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function parseInvoiceDate(value) {
  const match = text(value).match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b|\b(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/);
  if (!match) return '';
  const year = Number(match[3] || match[4]);
  const month = Number(match[2] || match[5]);
  const day = Number(match[1] || match[6]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseInvoiceAmount(value) {
  const tokens = text(value).replace(/\s/g, '').match(/\d+(?:[.,]\d+)*/g) || [];
  if (!tokens.length) return 0;
  const raw = tokens[tokens.length - 1];
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  let normalized = raw;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
    normalized = raw.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  } else {
    const separator = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : '';
    if (separator) {
      const sections = raw.split(separator);
      const decimals = sections[sections.length - 1].length;
      normalized = decimals === 2
        ? `${sections.slice(0, -1).join('')}.${sections[sections.length - 1]}`
        : sections.join('');
    }
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function valueAfterInvoiceLabel(lines, label, fromEnd = false) {
  const wanted = normalizeInvoiceText(label);
  const indexes = Array.from(lines.keys());
  if (fromEnd) indexes.reverse();
  for (const index of indexes) {
    const line = text(lines[index]);
    const normalized = normalizeInvoiceText(line);
    const position = normalized.indexOf(wanted);
    if (position < 0) continue;
    const colon = line.indexOf(':');
    let candidate = colon >= 0 ? line.slice(colon + 1) : line.slice(position + label.length);
    candidate = candidate.replace(/^[\s#.:\-]+/, '').trim();
    if (candidate) return candidate;
    const next = text(lines[index + 1]);
    if (next) return next;
  }
  return '';
}

function cleanInvoiceClient(value) {
  return text(value)
    .split(/\s+(?:RUC|CI|CEDULA|IDENTIFICACION|DIRECCION|TELEFONO|EMAIL)\s*[:#]?/i)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function findLabeledInvoiceDate(lines, labels) {
  for (const label of labels) {
    const wanted = normalizeInvoiceText(label);
    for (let index = 0; index < lines.length; index += 1) {
      if (!normalizeInvoiceText(lines[index]).includes(wanted)) continue;
      const found = parseInvoiceDate(`${lines[index]} ${lines[index + 1] || ''}`);
      if (found) return found;
    }
  }
  return '';
}

function findInvoiceTotal(lines) {
  const labels = ['VALOR TOTAL', 'TOTAL A PAGAR', 'IMPORTE TOTAL', 'TOTAL FACTURA'];
  for (const label of labels) {
    const wanted = normalizeInvoiceText(label);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (!normalizeInvoiceText(lines[index]).includes(wanted)) continue;
      const amount = parseInvoiceAmount(`${lines[index]} ${lines[index + 1] || ''}`);
      if (amount > 0) return amount;
    }
  }
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!/^TOTAL(?:\s+(?:USD|US\$))?\s*[:$]?/i.test(text(lines[index]).trim())) continue;
    const amount = parseInvoiceAmount(`${lines[index]} ${lines[index + 1] || ''}`);
    if (amount > 0) return amount;
  }
  return 0;
}

function addInvoiceCreditDays(fecha, days) {
  if (!fecha || !days) return '';
  const date = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + Number(days));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseInvoicePdfText(lines) {
  const normalizedFullText = normalizeInvoiceText(lines.join('\n'));
  const numberMatch = normalizedFullText.match(/(?:FACTURA(?:\s+(?:NRO|NO|NUMERO))?|NRO\s+FACTURA)\s*[:#.-]*\s*(\d{3}\s*-\s*\d{3}\s*-\s*\d{3,12})/)
    || normalizedFullText.match(/\b(\d{3}\s*-\s*\d{3}\s*-\s*\d{6,12})\b/)
    || lines.map(normalizeInvoiceText)
      .filter(line => line.includes('FACTURA'))
      .map(line => line.match(/FACTURA(?:\s+(?:NRO|NO|NUMERO))?\s*[:#.-]*\s*(\d{1,20})\b/))
      .find(Boolean);
  const numeroFactura = numberMatch ? numberMatch[1].replace(/\s/g, '') : '';
  const fecha = findLabeledInvoiceDate(lines, ['FECHA DE EMISION', 'FECHA EMISION', 'EMISION']);
  let vencimiento = findLabeledInvoiceDate(lines, ['FECHA DE VENCIMIENTO', 'FECHA VENCIMIENTO', 'VENCIMIENTO', 'VENCE']);
  if (!vencimiento && fecha) {
    const creditMatch = normalizedFullText.match(/(?:PLAZO|CREDITO(?:\s+A)?)\D{0,16}(\d{1,3})\s*DIAS/);
    if (creditMatch) vencimiento = addInvoiceCreditDays(fecha, creditMatch[1]);
  }
  const clienteDirecto = valueAfterInvoiceLabel(lines, 'CLIENTE');
  const clienteRazon = valueAfterInvoiceLabel(lines, 'RAZON SOCIAL / NOMBRES Y APELLIDOS', true)
    || valueAfterInvoiceLabel(lines, 'RAZON SOCIAL/NOMBRES Y APELLIDOS', true)
    || valueAfterInvoiceLabel(lines, 'COMPRADOR', true)
    || valueAfterInvoiceLabel(lines, 'ADQUIRENTE', true);
  const cliente = cleanInvoiceClient(clienteDirecto || clienteRazon);
  return {
    cliente,
    fecha,
    numeroFactura,
    concepto: /FLOR|ROSA|GYPSOPHILA|NEW RED|SPRING PEACH|GREEN XL/.test(normalizedFullText) ? 'Ventas de flor' : 'Facturas emitidas',
    valor: findInvoiceTotal(lines),
    vencimiento
  };
}

async function extractInvoicePdfLines(file) {
  if (!window.pdfjsLib) throw new Error('No se pudo cargar el lector de PDF');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;
  const task = window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const lines = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = new Map();
      content.items.filter(item => text(item.str)).forEach(item => {
        const x = Number(item.transform?.[4] || 0);
        const y = Math.round(Number(item.transform?.[5] || 0) / 2) * 2;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x, value: text(item.str) });
      });
      Array.from(rows.entries())
        .sort((a, b) => b[0] - a[0])
        .forEach(([, parts]) => {
          const line = parts.sort((a, b) => a.x - b.x).map(part => part.value).join(' ').replace(/\s+/g, ' ').trim();
          if (line) lines.push(line);
        });
    }
  } finally {
    await pdf.destroy();
  }
  return lines;
}

function applyInvoicePdfData(data) {
  const values = [
    ['factCliente', data.cliente],
    ['factFecha', data.fecha],
    ['factNumero', data.numeroFactura],
    ['factConcepto', data.concepto],
    ['factValor', data.valor ? data.valor.toFixed(2) : ''],
    ['factVence', data.vencimiento]
  ];
  const completed = [];
  values.forEach(([id, value]) => {
    if (!value) return;
    $(id).value = value;
    completed.push($(id).previousElementSibling?.textContent || id);
  });
  updateFacturaPreview();
  if (data.cliente) selectClientShipments();
  return completed;
}

async function autofillInvoiceFromPdf(file) {
  const status = $('factPdfStatus');
  if (!file) {
    status.textContent = 'Selecciona una factura PDF para completar automaticamente los datos.';
    return;
  }
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    status.textContent = 'El archivo debe estar en formato PDF.';
    return;
  }
  $('factSubmit').disabled = true;
  status.textContent = 'Leyendo la factura y buscando sus datos...';
  try {
    const lines = await extractInvoicePdfLines(file);
    if (lines.join('').length < 30) {
      status.textContent = 'Este PDF parece escaneado como imagen. Completa los datos manualmente y revisalos antes de guardar.';
      return;
    }
    const completed = applyInvoicePdfData(parseInvoicePdfText(lines));
    status.textContent = completed.length
      ? `Datos detectados: ${completed.join(', ')}. Revisalos antes de guardar; el PDF aun no se ha enviado.`
      : 'No se identificaron campos con seguridad. Completa los datos manualmente antes de guardar.';
  } catch (err) {
    status.textContent = `${text(err.message) || 'No se pudo leer el PDF'}. Puedes completar la factura manualmente.`;
  } finally {
    $('factSubmit').disabled = false;
  }
}

async function postEstadoCuenta(action, record, pdf) {
  const endpoint = ALTITUD.estadoCuentaUrl || ALTITUD.appsScriptUrl;
  if (!endpoint) throw new Error('Falta configurar la URL de Apps Script en js/config.js');
  const user = window.ALTITUD_PERMISOS ? ALTITUD_PERMISOS.getCurrentUser() : {};
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, record, pdf, driveFolderId: ALTITUD.driveFolderFacturasId, user })
  });
  if (!response.ok) throw new Error(`Apps Script respondio ${response.status}`);
  const result = await response.json();
  if (result?.ok === false) throw new Error(text(result.error).replace(/^Error:\s*/i, ''));
  return result;
}

async function findRemoteInvoice(numeroFactura) {
  const endpoint = ALTITUD.estadoCuentaUrl || ALTITUD.appsScriptUrl;
  if (!endpoint || !numeroFactura) return null;
  const separator = endpoint.includes('?') ? '&' : '?';
  try {
    const response = await fetch(`${endpoint}${separator}action=facturaNumero&numero_factura=${encodeURIComponent(numeroFactura)}&cacheBust=${Date.now()}`);
    if (!response.ok) return null;
    const result = await response.json();
    return result.ok && result.factura ? result.factura : null;
  } catch (err) {
    return null;
  }
}

async function waitForRemoteInvoice(numeroFactura, attempts = 12) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const factura = await findRemoteInvoice(numeroFactura);
    if (factura) return factura;
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  return null;
}

function updateFacturaPreview() {
  const valor = asNumber($('factValor').value);
  const vencimiento = $('factVence').value;
  $('factSaldo').textContent = fmtMoney(valor);
  $('factEstado').textContent = estadoFromSaldo(valor, valor, vencimiento);
}

function updatePagoPreview() {
  const tipo = $('pagoTipo').value;
  const invoice = selectedInvoice();
  const valorPago = asNumber($('pagoValor').value);
  const requiresInvoice = tipo !== 'OTRO_INGRESO';
  if (requiresInvoice && !invoice) {
    $('pagoSaldo').textContent = '-';
    $('pagoEstado').textContent = 'SELECCIONA FACTURA';
    $('pagoValor').setCustomValidity('Selecciona una factura registrada.');
    return;
  }
  const saldoActual = invoice ? invoice.saldo_pendiente : 0;
  const saldoPosterior = tipo === 'OTRO_INGRESO' ? 0 : Math.max(0, saldoActual - valorPago);
  const total = invoice ? invoice.valor_factura : valorPago;
  const estado = tipo === 'OTRO_INGRESO' ? 'PAGADO' : estadoFromSaldo(total, saldoPosterior, invoice?.fecha_vencimiento || '');
  $('pagoSaldo').textContent = fmtMoney(saldoPosterior);
  $('pagoEstado').textContent = estado;
  $('pagoValor').setCustomValidity(invoice && valorPago > saldoActual ? `El pago no puede superar el saldo de ${fmtMoney(saldoActual)}.` : '');
}

function applyInvoiceSelection() {
  const tipo = $('pagoTipo').value;
  const requiresInvoice = tipo !== 'OTRO_INGRESO';
  const invoice = selectedInvoice();
  const clientInput = $('pagoCliente');
  const sellerInput = $('pagoVendedor');
  const valueInput = $('pagoValor');
  const invoiceInput = $('pagoFactura');

  invoiceInput.required = requiresInvoice;
  clientInput.readOnly = requiresInvoice;
  valueInput.readOnly = tipo === 'PAGO_TOTAL' && !!invoice;

  if (!requiresInvoice) {
    clientInput.readOnly = false;
    sellerInput.readOnly = false;
    valueInput.readOnly = false;
    valueInput.removeAttribute('max');
    $('pagoMsg').textContent = 'Registra un ingreso que no corresponde a una factura.';
    updatePagoPreview();
    return;
  }

  if (!invoice) {
    clientInput.value = '';
    sellerInput.value = '';
    sellerInput.readOnly = false;
    valueInput.value = '';
    valueInput.removeAttribute('max');
    $('pagoMsg').textContent = 'Escribe o selecciona un numero de factura registrado.';
    updatePagoPreview();
    return;
  }

  clientInput.value = invoice.cliente;
  sellerInput.value = invoice.vendedor || '';
  sellerInput.readOnly = !!invoice.vendedor;
  valueInput.max = String(invoice.saldo_pendiente);
  if (tipo === 'PAGO_TOTAL') valueInput.value = invoice.saldo_pendiente.toFixed(2);
  else if (asNumber(valueInput.value) > invoice.saldo_pendiente) valueInput.value = '';
  $('pagoMsg').textContent = `Factura ${invoice.numero_factura} encontrada · Saldo actual ${fmtMoney(invoice.saldo_pendiente)} · Estado ${invoice.estado}.`;
  updatePagoPreview();
}

function appendLocal(row) {
  estadoRows.push(row);
  invoiceRows = canonicalInvoiceRows([...invoiceRows, row]);
  rebuildInvoiceLookup();
  renderEstadoCuenta();
}

async function setupForms() {
  $('factFecha').value = todayISO();
  $('pagoFecha').value = todayISO();
  ['factValor', 'factVence'].forEach(id => $(id).addEventListener('input', updateFacturaPreview));
  $('pagoTipo').addEventListener('change', applyInvoiceSelection);
  $('pagoFactura').addEventListener('input', applyInvoiceSelection);
  $('pagoFactura').addEventListener('change', applyInvoiceSelection);
  $('pagoValor').addEventListener('input', updatePagoPreview);
  $('factPdf').addEventListener('change', event => autofillInvoiceFromPdf(event.target.files[0]));
  ['clienteFiltro', 'estadoFiltro'].forEach(id => $(id).addEventListener('input', renderEstadoCuenta));
  ['shipmentClientFilter', 'shipmentStatusFilter', 'shipmentFromFilter', 'shipmentToFilter'].forEach(id => $(id).addEventListener('input', renderShipmentInventory));
  $('selectClientShipmentsBtn').addEventListener('click', selectClientShipments);
  $('factCliente').addEventListener('change', selectClientShipments);
  $('pendingShipmentsBody').addEventListener('change', event => {
    const checkbox = event.target.closest('[data-shipment-id]');
    if (!checkbox) return;
    if (checkbox.checked) selectedShipmentIds.add(checkbox.dataset.shipmentId);
    else selectedShipmentIds.delete(checkbox.dataset.shipmentId);
    const rows = selectedShipments();
    if (!$('factCliente').value && rows.length) $('factCliente').value = rows[0].cliente;
    updateShipmentSelectionSummary();
  });
  $('printShipmentsBtn').addEventListener('click', printShipmentInventory);
  $('refreshBtn').addEventListener('click', loadEstadoCuenta);
  updateFacturaPreview();
  applyInvoiceSelection();

  $('facturaForm').addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = $('factSubmit');
    const valor = asNumber($('factValor').value);
    const shipments = selectedShipments();
    const shipmentSummary = shipmentTotals(shipments);
    if (text($('factConcepto').value) === 'Ventas de flor' && !shipments.length) {
      $('factMsg').textContent = 'Selecciona al menos un despacho para registrar una factura de venta de flor.';
      $('pendingShipmentsBody').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
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
      ids_ventas: shipments.map(row => row.id_venta).join('|'),
      tallos_enviados: shipmentSummary.tallos,
      bunches_enviados: shipmentSummary.bunches,
      cajas_enviadas: shipmentSummary.cajas,
      detalle_envio: shipments.map(row => `${row.fecha} ${row.variedad} ${medidaLabel(row.medida_cm)} ${fmtInt(row.tallos)} tallos ${fmtInt(shipmentPacking(row).cajasEnviadas)} cajas`).join(' | '),
      fecha_registro: new Date().toISOString()
    };
    if (invoiceLookup.has(invoiceKey(record.numero_factura))) {
      $('factMsg').textContent = `La factura ${record.numero_factura} ya existe en el estado de cuenta.`;
      $('factNumero').focus();
      return;
    }
    const pdf = await readPdf($('factPdf').files[0]);
    submitButton.disabled = true;
    $('factMsg').textContent = 'Guardando factura y PDF. Espera la confirmacion de Google Sheets...';
    try {
      const saveResult = await postEstadoCuenta('registrarFactura', record, pdf);
      const savedInvoice = saveResult?.factura || await waitForRemoteInvoice(record.numero_factura);
      if (!savedInvoice) throw new Error('Google Sheets no confirmo el registro');
      const normalizedSaved = normalizeEstadoCuenta([savedInvoice])[0];
      if (normalizedSaved) appendLocal(normalizedSaved);
      $('factMsg').textContent = `Factura ${record.numero_factura} guardada y confirmada en Google Sheets.`;
      $('facturaForm').reset();
      selectedShipmentIds.clear();
      $('factFecha').value = todayISO();
      $('factPdfStatus').textContent = 'Selecciona una factura PDF para completar automaticamente los datos.';
      updateFacturaPreview();
      await loadEstadoCuenta();
      if (!invoiceLookup.has(invoiceKey(record.numero_factura))) appendLocal(normalizedSaved);
      const linkedIds = new Set(record.ids_ventas.split('|').filter(Boolean));
      shipmentRows = shipmentRows.map(row => linkedIds.has(row.id_venta)
        ? { ...row, numero_factura: record.numero_factura, estado_facturacion: 'FACTURADO', facturado_en: record.fecha_registro }
        : row);
      renderShipmentInventory();
      renderPendingShipmentSelection();
    } catch (err) {
      $('factMsg').textContent = `${text(err.message) || 'No se pudo guardar la factura'}. Los campos se conservaron para volver a intentar.`;
    } finally {
      submitButton.disabled = false;
    }
  });

  $('pagoForm').addEventListener('submit', async event => {
    event.preventDefault();
    const invoice = selectedInvoice();
    const tipo = $('pagoTipo').value;
    const requiresInvoice = tipo !== 'OTRO_INGRESO';
    if (requiresInvoice && !invoice) {
      $('pagoMsg').textContent = 'No se encontro esa factura. Selecciona una factura de la lista.';
      $('pagoFactura').focus();
      return;
    }
    const valor = tipo === 'PAGO_TOTAL' && invoice ? invoice.saldo_pendiente : asNumber($('pagoValor').value);
    if (valor <= 0 || (invoice && valor > invoice.saldo_pendiente)) {
      $('pagoMsg').textContent = invoice
        ? `Ingresa un valor mayor a cero y no superior a ${fmtMoney(invoice.saldo_pendiente)}.`
        : 'Ingresa un valor mayor a cero.';
      $('pagoValor').focus();
      return;
    }
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
      await loadEstadoCuenta();
      applyInvoiceSelection();
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

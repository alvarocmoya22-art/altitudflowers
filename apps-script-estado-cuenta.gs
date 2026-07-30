// Publicar este archivo como Web App independiente del script de vendedores.
// Tiene su propio doGet/doPost para no reemplazar el endpoint actual de ventas.
const ESTADO_CUENTA_SPREADSHEET_ID = '1Dru-SjYwkxw8J8Z6OqqC5nGsPOJCiLPvY3rJcNFALgQ';
const ESTADO_CUENTA_DRIVE_FOLDER_FACTURAS_ID = '';

const ESTADO_HEADERS = ['id_movimiento','fecha','cliente','concepto','descripcion','tipo_movimiento','numero_factura','valor_factura','valor_pagado','saldo_pendiente','estado','fecha_vencimiento','vendedor','observacion','url_pdf_factura','fecha_registro'];
const FACTURAS_HEADERS = ['id_factura','fecha_emision','cliente','numero_factura','concepto','valor_total','valor_pagado','saldo_pendiente','estado','fecha_vencimiento','url_pdf_factura','observacion'];
const INGRESOS_HEADERS = ['id_ingreso','fecha','cliente','concepto','numero_factura','valor_ingresado','forma_pago','vendedor','observacion','fecha_registro'];
const PAGOS_HEADERS = ['id_pago','fecha_pago','cliente','numero_factura','valor_pagado','forma_pago','observacion','fecha_registro'];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'status');
  setupEstadoCuenta();
  if (action === 'estadoCliente') return json_(consultarEstadoCuentaPorCliente(e.parameter.cliente));
  if (action === 'pendientes') return json_(consultarFacturasPendientes());
  if (action === 'pagadas') return json_(consultarFacturasPagadas());
  if (action === 'ingresosRango') return json_(consultarIngresosPorRango(e.parameter.desde, e.parameter.hasta));
  return json_({ ok: true, service: 'altitud_estado_cuenta', sheets: ['ESTADO_CUENTA','INGRESOS','FACTURAS','PAGOS_CLIENTES'] });
}

function doPost(e) {
  try {
    setupEstadoCuenta();
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = payload.action || '';
    const record = payload.record || {};
    if (action === 'setup') return json_(setupEstadoCuenta());
    if (action === 'subirPDF') return json_(subirPdfFactura_(payload.pdf, payload.driveFolderId));
    if (action === 'registrarFactura') return json_(registrarFactura(record, payload.pdf, payload.driveFolderId));
    if (action === 'registrarPago') return json_(registrarPagoOAbono(record));
    if (action === 'registrarIngreso') return json_(registrarIngreso(record));
    throw new Error('Accion no permitida: ' + action);
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function setupEstadoCuenta() {
  ensureSheet_('ESTADO_CUENTA', ESTADO_HEADERS);
  ensureSheet_('INGRESOS', INGRESOS_HEADERS);
  ensureSheet_('FACTURAS', FACTURAS_HEADERS);
  ensureSheet_('PAGOS_CLIENTES', PAGOS_HEADERS);
  migrateEstadoCuentaIfNeeded_();
  return { ok: true };
}

function registrarFactura(record, pdf, driveFolderId) {
  const urlPdf = pdf ? subirPdfFactura_(pdf, driveFolderId).url : (record.url_pdf_factura || '');
  const valor = num_(record.valor_factura || record.valor_total);
  const pagado = num_(record.valor_pagado);
  const saldo = Math.max(0, valor - pagado);
  const estado = calcularEstado_(valor, saldo, record.fecha_vencimiento);
  const now = new Date().toISOString();
  const factura = {
    id_factura: record.id_factura || id_('FAC'),
    fecha_emision: record.fecha_emision || record.fecha,
    cliente: record.cliente,
    numero_factura: record.numero_factura,
    concepto: record.concepto || 'Ventas de flor',
    valor_total: valor,
    valor_pagado: pagado,
    saldo_pendiente: saldo,
    estado,
    fecha_vencimiento: record.fecha_vencimiento,
    url_pdf_factura: urlPdf,
    observacion: record.observacion || ''
  };
  const movimiento = {
    id_movimiento: record.id_movimiento || id_('EC'),
    fecha: factura.fecha_emision,
    cliente: factura.cliente,
    concepto: factura.concepto,
    descripcion: record.descripcion || factura.concepto,
    tipo_movimiento: 'FACTURA',
    numero_factura: factura.numero_factura,
    valor_factura: valor,
    valor_pagado: pagado,
    saldo_pendiente: saldo,
    estado,
    fecha_vencimiento: factura.fecha_vencimiento,
    vendedor: record.vendedor || '',
    observacion: factura.observacion,
    url_pdf_factura: urlPdf,
    fecha_registro: now
  };
  append_('FACTURAS', FACTURAS_HEADERS, factura);
  append_('ESTADO_CUENTA', ESTADO_HEADERS, movimiento);
  return { ok: true, factura, movimiento };
}

function registrarPagoOAbono(record) {
  const factura = findFactura_(record.numero_factura);
  const valorPago = num_(record.valor_pagado || record.valor_ingresado);
  const valorTotal = factura ? num_(factura.valor_total) : num_(record.valor_factura);
  const pagadoAnterior = factura ? num_(factura.valor_pagado) : 0;
  const nuevoPagado = pagadoAnterior + valorPago;
  const saldo = Math.max(0, valorTotal - nuevoPagado);
  const estado = calcularEstado_(valorTotal, saldo, factura ? factura.fecha_vencimiento : record.fecha_vencimiento);
  if (factura) updateFactura_(record.numero_factura, nuevoPagado, saldo, estado);
  const pago = {
    id_pago: record.id_pago || id_('PAG'),
    fecha_pago: record.fecha_pago || record.fecha,
    cliente: record.cliente || (factura ? factura.cliente : ''),
    numero_factura: record.numero_factura,
    valor_pagado: valorPago,
    forma_pago: record.forma_pago || '',
    observacion: record.observacion || '',
    fecha_registro: record.fecha_registro || new Date().toISOString()
  };
  const ingreso = {
    id_ingreso: record.id_ingreso || id_('ING'),
    fecha: pago.fecha_pago,
    cliente: pago.cliente,
    concepto: record.tipo_movimiento === 'PAGO_TOTAL' ? 'Pagos completos' : 'Abonos de clientes',
    numero_factura: pago.numero_factura,
    valor_ingresado: valorPago,
    forma_pago: pago.forma_pago,
    vendedor: record.vendedor || '',
    observacion: pago.observacion,
    fecha_registro: pago.fecha_registro
  };
  const movimiento = {
    id_movimiento: record.id_movimiento || id_('EC'),
    fecha: pago.fecha_pago,
    cliente: pago.cliente,
    concepto: ingreso.concepto,
    descripcion: pago.observacion,
    tipo_movimiento: record.tipo_movimiento || 'ABONO',
    numero_factura: pago.numero_factura,
    valor_factura: valorTotal,
    valor_pagado: valorPago,
    saldo_pendiente: saldo,
    estado,
    fecha_vencimiento: factura ? factura.fecha_vencimiento : '',
    vendedor: record.vendedor || '',
    observacion: pago.observacion,
    url_pdf_factura: factura ? factura.url_pdf_factura : '',
    fecha_registro: pago.fecha_registro
  };
  append_('PAGOS_CLIENTES', PAGOS_HEADERS, pago);
  append_('INGRESOS', INGRESOS_HEADERS, ingreso);
  append_('ESTADO_CUENTA', ESTADO_HEADERS, movimiento);
  return { ok: true, pago, ingreso, movimiento };
}

function registrarIngreso(record) {
  const now = record.fecha_registro || new Date().toISOString();
  const valor = num_(record.valor_ingresado || record.valor_pagado);
  const ingreso = {
    id_ingreso: record.id_ingreso || id_('ING'),
    fecha: record.fecha || record.fecha_pago,
    cliente: record.cliente || '',
    concepto: record.concepto || 'Otros ingresos',
    numero_factura: record.numero_factura || '',
    valor_ingresado: valor,
    forma_pago: record.forma_pago || '',
    vendedor: record.vendedor || '',
    observacion: record.observacion || '',
    fecha_registro: now
  };
  const movimiento = {
    id_movimiento: record.id_movimiento || id_('EC'),
    fecha: ingreso.fecha,
    cliente: ingreso.cliente,
    concepto: ingreso.concepto,
    descripcion: ingreso.observacion,
    tipo_movimiento: 'OTRO_INGRESO',
    numero_factura: ingreso.numero_factura,
    valor_factura: 0,
    valor_pagado: valor,
    saldo_pendiente: 0,
    estado: 'PAGADO',
    fecha_vencimiento: '',
    vendedor: ingreso.vendedor,
    observacion: ingreso.observacion,
    url_pdf_factura: '',
    fecha_registro: now
  };
  append_('INGRESOS', INGRESOS_HEADERS, ingreso);
  append_('ESTADO_CUENTA', ESTADO_HEADERS, movimiento);
  return { ok: true, ingreso, movimiento };
}

function subirPdfFactura_(pdf, driveFolderId) {
  if (!pdf || !pdf.data) throw new Error('No se recibio PDF.');
  const folderId = driveFolderId || ESTADO_CUENTA_DRIVE_FOLDER_FACTURAS_ID;
  if (!folderId) throw new Error('Falta configurar ESTADO_CUENTA_DRIVE_FOLDER_FACTURAS_ID.');
  const bytes = Utilities.base64Decode(pdf.data);
  const blob = Utilities.newBlob(bytes, pdf.mimeType || 'application/pdf', pdf.name || ('factura_' + Date.now() + '.pdf'));
  const file = DriveApp.getFolderById(folderId).createFile(blob);
  return { ok: true, id: file.getId(), url: file.getUrl(), name: file.getName() };
}

function consultarEstadoCuentaPorCliente(cliente) {
  const rows = readObjects_('ESTADO_CUENTA', ESTADO_HEADERS);
  const needle = String(cliente || '').toUpperCase();
  return rows.filter(row => !needle || String(row.cliente || '').toUpperCase().indexOf(needle) >= 0);
}

function consultarFacturasPendientes() {
  return readObjects_('FACTURAS', FACTURAS_HEADERS).filter(row => num_(row.saldo_pendiente) > 0);
}

function consultarFacturasPagadas() {
  return readObjects_('FACTURAS', FACTURAS_HEADERS).filter(row => String(row.estado || '').toUpperCase() === 'PAGADO');
}

function consultarIngresosPorRango(desde, hasta) {
  return readObjects_('INGRESOS', INGRESOS_HEADERS).filter(row => (!desde || row.fecha >= desde) && (!hasta || row.fecha <= hasta));
}

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(ESTADO_CUENTA_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (!current.some(Boolean)) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function migrateEstadoCuentaIfNeeded_() {
  const sheet = SpreadsheetApp.openById(ESTADO_CUENTA_SPREADSHEET_ID).getSheetByName('ESTADO_CUENTA');
  const first = String(sheet.getRange(1, 1).getValue() || '');
  if (first !== 'factura') return;
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter(row => /^\d+$/.test(String(row[0] || ''))).map(row => {
    const valor = num_(row[5]), saldo = num_(row[8]), pagado = Math.max(0, valor - saldo);
    return [id_('EC'), row[3], row[1], 'Ventas de flor', '', 'FACTURA', row[0], valor, pagado, saldo, normalEstado_(row[6], valor, saldo, row[4]), row[4], '', row[10] || '', '', new Date().toISOString()];
  });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, ESTADO_HEADERS.length).setValues([ESTADO_HEADERS]);
  if (rows.length) sheet.getRange(2, 1, rows.length, ESTADO_HEADERS.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function append_(sheetName, headers, record) {
  const sheet = ensureSheet_(sheetName, headers);
  sheet.appendRow(headers.map(header => record[header] === undefined ? '' : record[header]));
}

function readObjects_(sheetName, headers) {
  const sheet = ensureSheet_(sheetName, headers);
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => obj[header] = row[index]);
    return obj;
  }).filter(row => Object.values(row).some(Boolean));
}

function findFactura_(numeroFactura) {
  return readObjects_('FACTURAS', FACTURAS_HEADERS).find(row => String(row.numero_factura) === String(numeroFactura));
}

function updateFactura_(numeroFactura, valorPagado, saldo, estado) {
  const sheet = ensureSheet_('FACTURAS', FACTURAS_HEADERS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][3]) === String(numeroFactura)) {
      sheet.getRange(i + 1, 7, 1, 3).setValues([[valorPagado, saldo, estado]]);
      return;
    }
  }
}

function calcularEstado_(valor, saldo, vencimiento) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (saldo <= 0) return 'PAGADO';
  if (vencimiento && String(vencimiento) < today) return 'VENCIDO';
  if (saldo >= valor) return 'PENDIENTE';
  return 'ABONADO';
}

function normalEstado_(estado, valor, saldo, vencimiento) {
  const value = String(estado || '').toUpperCase();
  if (value === 'POR COBRAR') return calcularEstado_(valor, saldo, vencimiento);
  if (['PENDIENTE','ABONADO','PAGADO','VENCIDO'].indexOf(value) >= 0) return value;
  return calcularEstado_(valor, saldo, vencimiento);
}

function num_(value) {
  if (typeof value === 'number') return value;
  let text = String(value || '').replace(/[^\d,.-]/g, '');
  if (!text) return 0;
  if (text.indexOf(',') >= 0) text = text.replace(/\./g, '').replace(',', '.');
  return Number(text) || 0;
}

function id_(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

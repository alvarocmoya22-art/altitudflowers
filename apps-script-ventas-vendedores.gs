const SPREADSHEET_ID = '1QogpATp_-37gz23PAapTVsNHYNzo3XnnbFxflb0xKYo';
const QUALITY_CUTOVER_DATE = '2026-08-20';
const FACTURAS_DRIVE_FOLDER_ID = '';
const FACTURAS_DRIVE_FOLDER_NAME = 'Altitud Flowers - Facturas';
const HEADERS_BY_SHEET = {
  USUARIOS: ['id_usuario','nombre','correo','rol','estado','fecha_registro'],
  PRODUCCION_CAMPO: ['id_produccion','fecha','semana','siembra','cama','variedad','tallos_cortados','responsable','estado','observaciones','creado_en','origen','lote','turno'],
  POSCOSECHA: ['id_poscosecha','fecha','semana','variedad','tallos_procesados','tallos_70','tallos_60','tallos_55','tallos_50','nacional','basura','aprovechamiento_pct','descarte_pct','responsable','observaciones','creado_en','origen','estado','minutos_trabajados'],
  CONTROL_CALIDAD: ['id_control_calidad','clave_control','id_poscosecha','ids_poscosecha','fecha_proceso','fecha_control','semana','variedad','procesadora','procesadoras','registros_procesados','tallos_declarados','tallos_70_aprobados','tallos_60_aprobados','tallos_55_aprobados','tallos_50_aprobados','nacional_aprobado','tallos_aprobados','tallos_rechazados','estado_calidad','controlador','motivo_rechazo','observaciones','creado_en','actualizado_en','origen'],
  RENDIMIENTO_PROCESADORAS: ['id_rendimiento','fecha','semana','procesadora','variedad','medida_cm','bunches','tallos_procesados','horas_trabajadas','tallos_por_hora','bunches_por_hora','observaciones','creado_en','origen','estado','minutos_trabajados'],
  CUARTO_FRIO: ['fecha_corte','variedad','medida_cm','tallos_procesados','tallos_vendidos','stock_disponible','bunches_disponibles','estado_stock','ubicacion','observaciones','actualizado_en','origen'],
  VENTAS_VENDEDORES: ['id_venta','fecha','hora','vendedor','cliente','variedad','medida_cm','tipo','bunches','tallos','precio_unitario','total_venta','tipo_caja','bunches_por_caja','cajas_enviadas','numero_factura','estado_facturacion','facturado_en','estado','observaciones','creado_en','origen'],
  CLIENTES: ['id_cliente','cliente','contacto','telefono','email','pais','ciudad','estado','condicion_pago','observaciones','creado_en','origen'],
  VENDEDORES: ['id_vendedor','vendedor','usuario','rol','estado','telefono','email','creado_en','origen'],
  VARIEDADES: ['id_variedad','variedad','color','estado','categoria','observaciones','creado_en','origen'],
  PRECIOS: ['id_precio','variedad','medida_cm','tipo','precio_unitario','moneda','vigente_desde','estado','observaciones','origen'],
  ESTADO_CUENTA: ['id_movimiento','fecha','cliente','concepto','descripcion','tipo_movimiento','numero_factura','valor_factura','valor_pagado','saldo_pendiente','estado','fecha_vencimiento','vendedor','observacion','url_pdf_factura','ids_ventas','tallos_enviados','bunches_enviados','cajas_enviadas','detalle_envio','fecha_registro'],
  INGRESOS: ['id_ingreso','fecha','cliente','concepto','numero_factura','valor_ingresado','forma_pago','vendedor','observacion','fecha_registro'],
  FACTURAS: ['id_factura','fecha_emision','cliente','numero_factura','concepto','valor_total','valor_pagado','saldo_pendiente','estado','fecha_vencimiento','url_pdf_factura','ids_ventas','tallos_enviados','bunches_enviados','cajas_enviadas','detalle_envio','observacion'],
  PAGOS_CLIENTES: ['id_pago','fecha_pago','cliente','numero_factura','valor_pagado','forma_pago','observacion','fecha_registro'],
  REPORTES: ['fecha','indicador','categoria','valor','unidad','periodo','fuente','observaciones','actualizado_en','origen'],
  CONFIGURACION: ['clave','valor','grupo','descripcion','estado','actualizado_en','origen','usuario','tipo','orden']
};
const ROLE_PERMISSIONS = {
  GERENCIA: Object.keys(HEADERS_BY_SHEET),
  OPERADORA_PRODUCCION: ['PRODUCCION_CAMPO','POSCOSECHA','CONTROL_CALIDAD','RENDIMIENTO_PROCESADORAS','CUARTO_FRIO'],
  VENDEDOR: ['VENTAS_VENDEDORES','CLIENTES','CUARTO_FRIO'],
  ADMINISTRACION: ['ESTADO_CUENTA','INGRESOS','FACTURAS','PAGOS_CLIENTES','CLIENTES','REPORTES'],
  CLIENTE_STOCK: ['CUARTO_FRIO']
};

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'obtenerKPIsPanelGerencial') {
    return json_(obtenerKPIsPanelGerencial({ correo: e.parameter.correo || '', rol: e.parameter.rol || '' }));
  }
  if (action === 'obtenerStockCuartoFrio') {
    return json_(obtenerStockCuartoFrio(e.parameter || {}));
  }
  if (action === 'diagnosticarStockCuartoFrio') {
    return json_(diagnosticarStockCuartoFrio(e.parameter || {}));
  }
  if (action === 'facturasPendientes') {
    return json_(listarFacturasFinanzas_().filter(function(row) {
      const saldo = row.saldo_pendiente !== '' && row.saldo_pendiente !== null && row.saldo_pendiente !== undefined
        ? row.saldo_pendiente
        : row.saldo;
      return String(row.estado || '').toUpperCase() !== 'PAGADO' && normalizarNumero_(saldo) > 0;
    }));
  }
  if (action === 'facturaNumero') {
    const found = findFacturaFinanzas_(e.parameter.numero_factura || '');
    return json_({ ok: !!found, factura: found ? found.record : null });
  }
  return json_({ ok: true, service: 'altitud_flowers_api', sheets: Object.keys(HEADERS_BY_SHEET) });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const sheetName = String(payload.sheet || 'VENTAS_VENDEDORES').toUpperCase();
    if (payload.action === 'registrarFactura') {
      return json_(registrarFacturaFinanzas_(payload.record || {}, payload.pdf, payload.driveFolderId, payload.user || {}));
    }
    if (payload.action === 'registrarPago') {
      return json_(registrarPagoFinanzas_(payload.record || {}, payload.user || {}));
    }
    if (payload.action === 'registrarIngreso') {
      return json_(registrarIngresoFinanzas_(payload.record || {}, payload.user || {}));
    }
    if (payload.action === 'deleteRecord') {
      return json_(deleteRecord_(sheetName, payload.idField, payload.idValue, payload.user || {}));
    }
    const record = payload.record || payload;
    const headers = HEADERS_BY_SHEET[sheetName];
    if (!headers) throw new Error('Hoja no permitida: ' + sheetName);
    const role = getRole_(payload.user || {});
    if (!canWrite_(role, sheetName)) throw new Error('Rol sin permiso para escribir en ' + sheetName);
    if (sheetName === 'CONTROL_CALIDAD') validarControlCalidad_(record);
    const sheet = getSheet_(sheetName, headers);
    const writeHeaders = getWritableHeaders_(sheet, headers);
    const existingRow = findRowById_(sheet, writeHeaders, record);
    if (sheetName === 'POSCOSECHA' && existingRow > 1) {
      eliminarControlCalidadDePoscosecha_(record.id_poscosecha);
    }
    if (existingRow > 1) {
      sheet.getRange(existingRow, 1, 1, writeHeaders.length).setValues([writeHeaders.map(header => normalizeValue_(record[header]))]);
    } else {
      sheet.appendRow(writeHeaders.map(header => normalizeValue_(record[header])));
    }
    if (sheetName === 'POSCOSECHA') {
      sincronizarRendimientoDesdePoscosecha_(record);
    }
    return json_({ ok: true, sheet: sheetName, id: record.id_control_calidad || record.id_venta || record.id_produccion || record.id_poscosecha || record.id_rendimiento || record.id_cliente || '' });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function registrarFacturaFinanzas_(record, pdf, driveFolderId, user) {
  validarPermisoFinanzas_(user, ['FACTURAS','ESTADO_CUENTA']);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const numeroFactura = String(record.numero_factura || '').trim();
    const cliente = String(record.cliente || '').trim();
    const valor = normalizarNumero_(record.valor_factura || record.valor_total);
    if (!numeroFactura) throw new Error('El numero de factura es obligatorio.');
    if (!cliente) throw new Error('El cliente es obligatorio.');
    if (valor <= 0) throw new Error('El valor de la factura debe ser mayor a cero.');
    if (findFacturaFinanzas_(numeroFactura)) throw new Error('Ya existe la factura ' + numeroFactura + '.');

    const idsSolicitados = String(record.ids_ventas || '').split('|').map(function(id) { return String(id || '').trim(); }).filter(Boolean);
    const ventasSeleccionadas = buscarVentasParaFactura_(idsSolicitados);
    const envio = resumirVentasParaFactura_(ventasSeleccionadas);
    const idsVentas = ventasSeleccionadas.map(function(item) { return String(item.record.id_venta); }).join('|');
    const detalleEnvio = ventasSeleccionadas.map(function(item) {
      const sale = item.record;
      const packing = empaqueVenta_(sale);
      return [sale.fecha, sale.variedad, sale.medida_cm, normalizarNumero_(sale.tallos) + ' tallos', packing.cajas + ' cajas'].join(' ');
    }).join(' | ');
    const urlPdf = pdf && pdf.data
      ? subirPdfFacturaFinanzas_(pdf, driveFolderId).url
      : String(record.url_pdf_factura || '');
    const pagado = Math.max(0, normalizarNumero_(record.valor_pagado));
    const saldo = Math.max(0, valor - pagado);
    const estado = calcularEstadoFactura_(valor, saldo, record.fecha_vencimiento);
    const now = record.fecha_registro || new Date().toISOString();
    const factura = {
      id_factura: record.id_factura || financeId_('FAC'),
      fecha_emision: record.fecha_emision || record.fecha,
      cliente: cliente,
      numero_factura: numeroFactura,
      concepto: record.concepto || 'Ventas de flor',
      valor_total: valor,
      valor_pagado: pagado,
      saldo_pendiente: saldo,
      estado: estado,
      fecha_vencimiento: record.fecha_vencimiento || '',
      url_pdf_factura: urlPdf,
      ids_ventas: idsVentas,
      tallos_enviados: envio.tallos,
      bunches_enviados: envio.bunches,
      cajas_enviadas: envio.cajas,
      detalle_envio: detalleEnvio || String(record.detalle_envio || ''),
      observacion: record.observacion || ''
    };
    const movimiento = {
      id_movimiento: record.id_movimiento || financeId_('EC'),
      fecha: factura.fecha_emision,
      cliente: cliente,
      concepto: factura.concepto,
      descripcion: record.descripcion || factura.concepto,
      tipo_movimiento: 'FACTURA',
      numero_factura: numeroFactura,
      valor_factura: valor,
      valor_pagado: pagado,
      saldo_pendiente: saldo,
      estado: estado,
      fecha_vencimiento: factura.fecha_vencimiento,
      vendedor: record.vendedor || '',
      observacion: factura.observacion,
      url_pdf_factura: urlPdf,
      ids_ventas: idsVentas,
      tallos_enviados: envio.tallos,
      bunches_enviados: envio.bunches,
      cajas_enviadas: envio.cajas,
      detalle_envio: factura.detalle_envio,
      fecha_registro: now
    };
    appendFinanceRecord_('FACTURAS', factura);
    appendFinanceRecord_('ESTADO_CUENTA', movimiento);
    vincularVentasConFactura_(ventasSeleccionadas, numeroFactura, now);
    return { ok: true, factura: factura, movimiento: movimiento, ventasVinculadas: ventasSeleccionadas.length };
  } finally {
    lock.releaseLock();
  }
}

function buscarVentasParaFactura_(ids) {
  if (!ids.length) return [];
  const sheet = getSheet_('VENTAS_VENDEDORES', HEADERS_BY_SHEET.VENTAS_VENDEDORES);
  const headers = getWritableHeaders_(sheet, HEADERS_BY_SHEET.VENTAS_VENDEDORES);
  const values = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues() : [];
  const idIndex = headers.indexOf('id_venta');
  const wanted = {};
  ids.forEach(function(id) { wanted[String(id)] = true; });
  const found = [];
  values.forEach(function(row, index) {
    const id = String(row[idIndex] || '');
    if (!wanted[id]) return;
    const sale = {};
    headers.forEach(function(header, column) { sale[header] = row[column]; });
    const linkedInvoice = String(sale.numero_factura || '').trim();
    if (linkedInvoice) throw new Error('La venta ' + id + ' ya esta vinculada con la factura ' + linkedInvoice + '.');
    found.push({ sheet: sheet, headers: headers, row: index + 2, record: sale });
    delete wanted[id];
  });
  const missing = Object.keys(wanted);
  if (missing.length) throw new Error('No se encontraron las ventas seleccionadas: ' + missing.join(', ') + '.');
  return found;
}

function empaqueVenta_(sale) {
  const medida = String(sale.medida_cm || sale.medida || '').replace(/\D/g, '') || 'NACIONAL';
  const tallos = Math.max(0, normalizarNumero_(sale.tallos));
  const bunches = Math.max(0, normalizarNumero_(sale.bunches) || Math.ceil(tallos / 10));
  const defaultCapacity = medida === '70' ? 25 : 30;
  const capacidad = Math.max(1, normalizarNumero_(sale.bunches_por_caja) || defaultCapacity);
  const cajas = Math.max(0, normalizarNumero_(sale.cajas_enviadas) || Math.ceil(bunches / capacidad));
  return { tallos: tallos, bunches: bunches, capacidad: capacidad, cajas: cajas };
}

function resumirVentasParaFactura_(ventas) {
  return ventas.reduce(function(total, item) {
    const packing = empaqueVenta_(item.record);
    total.tallos += packing.tallos;
    total.bunches += packing.bunches;
    total.cajas += packing.cajas;
    return total;
  }, { tallos: 0, bunches: 0, cajas: 0 });
}

function vincularVentasConFactura_(ventas, numeroFactura, now) {
  ventas.forEach(function(item) {
    const sale = Object.assign({}, item.record, {
      numero_factura: numeroFactura,
      estado_facturacion: 'FACTURADO',
      facturado_en: now
    });
    item.sheet.getRange(item.row, 1, 1, item.headers.length).setValues([
      item.headers.map(function(header) { return normalizeValue_(sale[header]); })
    ]);
  });
}

function registrarPagoFinanzas_(record, user) {
  validarPermisoFinanzas_(user, ['FACTURAS','PAGOS_CLIENTES','INGRESOS','ESTADO_CUENTA']);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const numeroFactura = String(record.numero_factura || '').trim();
    const found = findFacturaFinanzas_(numeroFactura);
    if (!found) throw new Error('No se encontro la factura ' + numeroFactura + '.');

    const factura = found.record;
    const valorTotal = normalizarNumero_(factura.valor_total || factura.valor_factura);
    const saldoGuardado = factura.saldo_pendiente !== '' && factura.saldo_pendiente !== null && factura.saldo_pendiente !== undefined
      ? factura.saldo_pendiente
      : factura.saldo;
    const pagadoRegistrado = normalizarNumero_(factura.valor_pagado);
    const saldoActual = String(factura.estado || '').toUpperCase() === 'PAGADO'
      ? 0
      : saldoGuardado === '' || saldoGuardado === null || saldoGuardado === undefined
        ? Math.max(0, valorTotal - pagadoRegistrado)
        : Math.max(0, Math.min(valorTotal, normalizarNumero_(saldoGuardado)));
    const pagadoAnterior = Math.max(pagadoRegistrado, Math.max(0, valorTotal - saldoActual));
    if (saldoActual <= 0) throw new Error('La factura ' + numeroFactura + ' ya esta pagada.');

    const tipo = String(record.tipo_movimiento || 'ABONO').toUpperCase();
    const solicitado = normalizarNumero_(record.valor_pagado || record.valor_ingresado);
    const valorPago = tipo === 'PAGO_TOTAL' ? saldoActual : solicitado;
    if (valorPago <= 0) throw new Error('El valor pagado debe ser mayor a cero.');
    if (valorPago > saldoActual) throw new Error('El pago supera el saldo pendiente de ' + saldoActual + '.');

    const nuevoPagado = Math.min(valorTotal, pagadoAnterior + valorPago);
    const nuevoSaldo = Math.max(0, valorTotal - nuevoPagado);
    const nuevoEstado = calcularEstadoFactura_(valorTotal, nuevoSaldo, factura.fecha_vencimiento);
    updateFacturaFinanzas_(found, nuevoPagado, nuevoSaldo, nuevoEstado);

    const now = record.fecha_registro || new Date().toISOString();
    const fechaPago = record.fecha_pago || record.fecha;
    const cliente = factura.cliente;
    const pago = {
      id_pago: record.id_pago || financeId_('PAG'),
      fecha_pago: fechaPago,
      cliente: cliente,
      numero_factura: numeroFactura,
      valor_pagado: valorPago,
      forma_pago: record.forma_pago || '',
      observacion: record.observacion || '',
      fecha_registro: now
    };
    const ingreso = {
      id_ingreso: record.id_ingreso || financeId_('ING'),
      fecha: fechaPago,
      cliente: cliente,
      concepto: tipo === 'PAGO_TOTAL' ? 'Pagos completos' : 'Abonos de clientes',
      numero_factura: numeroFactura,
      valor_ingresado: valorPago,
      forma_pago: pago.forma_pago,
      vendedor: record.vendedor || '',
      observacion: pago.observacion,
      fecha_registro: now
    };
    const movimiento = {
      id_movimiento: record.id_movimiento || financeId_('EC'),
      fecha: fechaPago,
      cliente: cliente,
      concepto: ingreso.concepto,
      descripcion: pago.observacion,
      tipo_movimiento: tipo,
      numero_factura: numeroFactura,
      valor_factura: valorTotal,
      valor_pagado: valorPago,
      saldo_pendiente: nuevoSaldo,
      estado: nuevoEstado,
      fecha_vencimiento: factura.fecha_vencimiento || '',
      vendedor: record.vendedor || '',
      observacion: pago.observacion,
      url_pdf_factura: factura.url_pdf_factura || '',
      fecha_registro: now
    };
    appendFinanceRecord_('PAGOS_CLIENTES', pago);
    appendFinanceRecord_('INGRESOS', ingreso);
    appendFinanceRecord_('ESTADO_CUENTA', movimiento);
    return { ok: true, pago: pago, ingreso: ingreso, movimiento: movimiento };
  } finally {
    lock.releaseLock();
  }
}

function registrarIngresoFinanzas_(record, user) {
  validarPermisoFinanzas_(user, ['INGRESOS','ESTADO_CUENTA']);
  const valor = normalizarNumero_(record.valor_ingresado || record.valor_pagado);
  if (valor <= 0) throw new Error('El valor ingresado debe ser mayor a cero.');
  const now = record.fecha_registro || new Date().toISOString();
  const ingreso = {
    id_ingreso: record.id_ingreso || financeId_('ING'),
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
    id_movimiento: record.id_movimiento || financeId_('EC'),
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
  appendFinanceRecord_('INGRESOS', ingreso);
  appendFinanceRecord_('ESTADO_CUENTA', movimiento);
  return { ok: true, ingreso: ingreso, movimiento: movimiento };
}

function validarPermisoFinanzas_(user, sheets) {
  const role = getRole_(user || {});
  sheets.forEach(function(sheetName) {
    if (!canWrite_(role, sheetName)) throw new Error('Rol sin permiso para escribir en ' + sheetName);
  });
}

function findFacturaFinanzas_(numeroFactura) {
  return findFacturaEnHojaFinanzas_('FACTURAS', numeroFactura)
    || findFacturaEnHojaFinanzas_('ESTADO_CUENTA', numeroFactura);
}

function findFacturaEnHojaFinanzas_(sheetName, numeroFactura) {
  const sheet = getSheet_(sheetName, HEADERS_BY_SHEET[sheetName]);
  if (sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(function(value) { return String(value || '').trim(); });
  const numeroIndexes = ['numero_factura','factura']
    .map(function(header) { return headers.indexOf(header); })
    .filter(function(index) { return index >= 0; });
  if (!numeroIndexes.length) return null;
  const wanted = String(numeroFactura || '').trim().toUpperCase();
  let candidate = null;
  for (let index = 0; index < values.length; index++) {
    const matches = numeroIndexes.some(function(column) {
      return String(values[index][column] || '').trim().toUpperCase() === wanted;
    });
    if (!matches) continue;
    const record = {};
    headers.forEach(function(header, column) { record[header] = values[index][column]; });
    const tipo = String(record.tipo_movimiento || '').toUpperCase();
    const result = { sheet: sheet, row: index + 2, headers: headers, record: record };
    if (tipo === 'FACTURA' || (!tipo && normalizarNumero_(record.valor_total || record.valor_factura) > 0)) {
      candidate = result;
    }
  }
  return candidate;
}

function listarFacturasFinanzas_() {
  const facturas = readObjects_('FACTURAS');
  const historicas = readObjects_('ESTADO_CUENTA').filter(function(row) {
    const tipo = String(row.tipo_movimiento || '').toUpperCase();
    return (tipo === 'FACTURA' || !tipo) && (row.numero_factura || row.factura);
  });
  return historicas.concat(facturas);
}

function updateFacturaFinanzas_(found, valorPagado, saldo, estado) {
  const updates = {
    valor_pagado: valorPagado,
    saldo_pendiente: saldo,
    saldo: saldo,
    estado: estado
  };
  Object.keys(updates).forEach(function(header) {
    const column = found.headers.indexOf(header) + 1;
    if (column > 0) found.sheet.getRange(found.row, column).setValue(updates[header]);
  });
}

function appendFinanceRecord_(sheetName, record) {
  const desiredHeaders = HEADERS_BY_SHEET[sheetName];
  const sheet = getSheet_(sheetName, desiredHeaders);
  const headers = getWritableHeaders_(sheet, desiredHeaders);
  const writableRecord = Object.assign({}, record);
  if (sheetName === 'ESTADO_CUENTA') {
    writableRecord.factura = writableRecord.factura || writableRecord.numero_factura;
    writableRecord.saldo = writableRecord.saldo === undefined ? writableRecord.saldo_pendiente : writableRecord.saldo;
    writableRecord.fecha_emision = writableRecord.fecha_emision || writableRecord.fecha;
    writableRecord.observaciones = writableRecord.observaciones || writableRecord.observacion;
  }
  sheet.appendRow(headers.map(function(header) { return normalizeValue_(writableRecord[header]); }));
}

function calcularEstadoFactura_(valorTotal, saldo, fechaVencimiento) {
  if (saldo <= 0) return 'PAGADO';
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  let vencimiento = fechaVencimiento;
  if (fechaVencimiento instanceof Date) {
    vencimiento = Utilities.formatDate(fechaVencimiento, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (vencimiento && String(vencimiento).slice(0, 10) < today) return 'VENCIDO';
  if (saldo >= valorTotal) return 'PENDIENTE';
  return 'ABONADO';
}

function subirPdfFacturaFinanzas_(pdf, driveFolderId) {
  const folder = obtenerCarpetaFacturas_(driveFolderId);
  const bytes = Utilities.base64Decode(pdf.data);
  const blob = Utilities.newBlob(bytes, pdf.mimeType || 'application/pdf', pdf.name || ('factura_' + Date.now() + '.pdf'));
  const file = folder.createFile(blob);
  return { id: file.getId(), url: file.getUrl(), name: file.getName(), folderId: folder.getId() };
}

function obtenerCarpetaFacturas_(driveFolderId) {
  const properties = PropertiesService.getScriptProperties();
  const candidates = [
    String(driveFolderId || '').trim(),
    String(FACTURAS_DRIVE_FOLDER_ID || '').trim(),
    String(properties.getProperty('FACTURAS_DRIVE_FOLDER_ID') || '').trim()
  ].filter(Boolean);
  for (let index = 0; index < candidates.length; index++) {
    try {
      const folder = DriveApp.getFolderById(candidates[index]);
      properties.setProperty('FACTURAS_DRIVE_FOLDER_ID', folder.getId());
      return folder;
    } catch (err) {
      // Continue with the next configured folder before creating a new one.
    }
  }
  const folders = DriveApp.getFoldersByName(FACTURAS_DRIVE_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FACTURAS_DRIVE_FOLDER_NAME);
  properties.setProperty('FACTURAS_DRIVE_FOLDER_ID', folder.getId());
  return folder;
}

function financeId_(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

function getRole_(user) {
  const email = String(user.correo || Session.getActiveUser().getEmail() || '').toLowerCase();
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('USUARIOS');
  if (!sheet) {
    sheet = getSheet_('USUARIOS', HEADERS_BY_SHEET.USUARIOS);
    sheet.appendRow(['U-1','Gerencia Altitud','','GERENCIA','ACTIVO',new Date()]);
  }
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  const idxCorreo = headers.indexOf('correo');
  const idxRol = headers.indexOf('rol');
  const idxEstado = headers.indexOf('estado');
  if (email && idxCorreo >= 0) {
    const found = values.find(row => String(row[idxCorreo] || '').toLowerCase() === email && String(row[idxEstado] || 'ACTIVO').toUpperCase() !== 'INACTIVO');
    if (found) return String(found[idxRol] || 'GERENCIA').toUpperCase();
  }
  return String(user.rol || 'GERENCIA').toUpperCase();
}

function canWrite_(role, sheetName) {
  return (ROLE_PERMISSIONS[role] || []).indexOf(sheetName) >= 0;
}


function findRowById_(sheet, headers, record) {
  const idFields = ['id_control_calidad','id_produccion','id_poscosecha','id_rendimiento','id_venta','id_cliente','id_movimiento','id_factura','id_pago','id_ingreso'];
  const idField = idFields.find(function(field) { return headers.indexOf(field) >= 0 && record[field]; });
  if (!idField) return -1;
  const idColumn = headers.indexOf(idField) + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  const wanted = String(record[idField]);
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === wanted) return i + 2;
  }
  return -1;
}

function deleteRecord_(sheetName, idField, idValue, user) {
  const headers = HEADERS_BY_SHEET[sheetName];
  if (!headers) throw new Error('Hoja no permitida: ' + sheetName);
  const role = getRole_(user || {});
  if (!canWrite_(role, sheetName)) throw new Error('Rol sin permiso para eliminar en ' + sheetName);
  const sheet = getSheet_(sheetName, headers);
  const writeHeaders = getWritableHeaders_(sheet, headers);
  const idColumn = writeHeaders.indexOf(String(idField || '')) + 1;
  if (idColumn <= 0) throw new Error('Campo ID no encontrado: ' + idField);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, deleted: false };
  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  const wanted = String(idValue || '');
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === wanted) {
      if (sheetName === 'VENTAS_VENDEDORES') {
        const invoiceColumn = writeHeaders.indexOf('numero_factura') + 1;
        const linkedInvoice = invoiceColumn > 0 ? String(sheet.getRange(i + 2, invoiceColumn).getValue() || '').trim() : '';
        if (linkedInvoice) throw new Error('No se puede eliminar una venta vinculada con la factura ' + linkedInvoice + '.');
      }
      sheet.deleteRow(i + 2);
      if (sheetName === 'POSCOSECHA') {
        eliminarRendimientoDePoscosecha_(wanted);
        eliminarControlCalidadDePoscosecha_(wanted);
      }
      return { ok: true, deleted: true, id: wanted };
    }
  }
  return { ok: true, deleted: false, id: wanted };
}

function sincronizarRendimientoDesdePoscosecha_(record) {
  const idPoscosecha = String(record.id_poscosecha || '').trim();
  const procesadora = String(record.responsable || '').trim().toUpperCase();
  const tallos = normalizarNumero_(record.tallos_procesados);
  if (!idPoscosecha || !procesadora || tallos <= 0) return;

  const minutos = normalizarNumero_(record.minutos_trabajados);
  const horas = minutos > 0 ? minutos / 60 : 0;
  const bunches = tallos / 10;
  const rendimiento = {
    id_rendimiento: 'RP-' + idPoscosecha,
    fecha: record.fecha || '',
    semana: normalizarNumero_(record.semana) || semanaISO_(record.fecha),
    procesadora: procesadora,
    variedad: normalizarVariedad_(record.variedad),
    medida_cm: 'MIXTO',
    bunches: bunches,
    tallos_procesados: tallos,
    horas_trabajadas: horas,
    tallos_por_hora: horas > 0 ? tallos / horas : 0,
    bunches_por_hora: horas > 0 ? bunches / horas : 0,
    observaciones: 'Generado desde poscosecha ' + idPoscosecha,
    creado_en: record.creado_en || new Date(),
    origen: 'POSCOSECHA_WEB',
    estado: record.estado || 'REGISTRADO',
    minutos_trabajados: minutos
  };
  const headers = HEADERS_BY_SHEET.RENDIMIENTO_PROCESADORAS;
  const sheet = getSheet_('RENDIMIENTO_PROCESADORAS', headers);
  const writeHeaders = getWritableHeaders_(sheet, headers);
  const existingRow = findRowById_(sheet, writeHeaders, rendimiento);
  const values = writeHeaders.map(function(header) { return normalizeValue_(rendimiento[header]); });
  if (existingRow > 1) {
    sheet.getRange(existingRow, 1, 1, writeHeaders.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function eliminarRendimientoDePoscosecha_(idPoscosecha) {
  const headers = HEADERS_BY_SHEET.RENDIMIENTO_PROCESADORAS;
  const sheet = getSheet_('RENDIMIENTO_PROCESADORAS', headers);
  const writeHeaders = getWritableHeaders_(sheet, headers);
  const idColumn = writeHeaders.indexOf('id_rendimiento') + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const wanted = 'RP-' + String(idPoscosecha || '').trim();
  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === wanted) sheet.deleteRow(i + 2);
  }
}

function eliminarControlCalidadDePoscosecha_(idPoscosecha) {
  const headers = HEADERS_BY_SHEET.CONTROL_CALIDAD;
  const sheet = getSheet_('CONTROL_CALIDAD', headers);
  const writeHeaders = getWritableHeaders_(sheet, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const wanted = String(idPoscosecha || '').trim();
  const idIndex = writeHeaders.indexOf('id_poscosecha');
  const idsIndex = writeHeaders.indexOf('ids_poscosecha');
  const values = sheet.getRange(2, 1, lastRow - 1, writeHeaders.length).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    const joinedIds = String((idsIndex >= 0 && values[i][idsIndex]) || (idIndex >= 0 && values[i][idIndex]) || '');
    const ids = joinedIds.split('|').map(function(id) { return String(id || '').trim(); });
    if (ids.indexOf(wanted) >= 0) sheet.deleteRow(i + 2);
  }
}

function validarControlCalidad_(record) {
  const ids = String(record.ids_poscosecha || record.id_poscosecha || '')
    .split('|')
    .map(function(id) { return String(id || '').trim(); })
    .filter(function(id, index, all) { return id && all.indexOf(id) === index; });
  if (!ids.length) throw new Error('Control de calidad sin registros de poscosecha');

  const idMap = {};
  ids.forEach(function(id) { idMap[id] = true; });
  const posRows = readObjects_('POSCOSECHA').filter(function(row) {
    return idMap[String(row.id_poscosecha || '').trim()];
  });
  if (posRows.length !== ids.length) throw new Error('Uno o mas registros de poscosecha no existen');

  const fecha = normalizarFecha_(posRows[0].fecha);
  const variedad = normalizarVariedad_(posRows[0].variedad);
  const mismoTotalDiario = posRows.every(function(row) {
    return normalizarFecha_(row.fecha) === fecha && normalizarVariedad_(row.variedad) === variedad;
  });
  if (!mismoTotalDiario) throw new Error('El control solo puede agrupar una misma fecha y variedad');

  const pairs = [
    ['tallos_70','tallos_70_aprobados'],
    ['tallos_60','tallos_60_aprobados'],
    ['tallos_55','tallos_55_aprobados'],
    ['tallos_50','tallos_50_aprobados'],
    ['nacional','nacional_aprobado']
  ];
  let declarados = 0;
  let aprobados = 0;
  pairs.forEach(function(pair) {
    const declarado = posRows.reduce(function(total, row) {
      return total + Math.max(0, normalizarNumero_(row[pair[0]]));
    }, 0);
    const aprobado = normalizarNumero_(record[pair[1]]);
    if (aprobado < 0 || aprobado > declarado) {
      throw new Error(pair[1] + ' debe estar entre 0 y ' + declarado);
    }
    declarados += declarado;
    aprobados += aprobado;
  });

  const rechazados = Math.max(0, declarados - aprobados);
  if (rechazados > 0 && !String(record.motivo_rechazo || '').trim()) {
    throw new Error('Debe registrar el motivo del ajuste o rechazo');
  }
  const procesadoras = [];
  posRows.forEach(function(row) {
    const nombre = String(row.responsable || '').trim().toUpperCase();
    if (nombre && procesadoras.indexOf(nombre) < 0) procesadoras.push(nombre);
  });
  record.clave_control = fecha + '|' + variedad;
  record.id_poscosecha = ids.join('|');
  record.ids_poscosecha = ids.join('|');
  record.fecha_proceso = fecha;
  record.fecha_control = normalizarFecha_(record.fecha_control || new Date());
  record.semana = normalizarNumero_(posRows[0].semana) || semanaISO_(fecha);
  record.variedad = variedad;
  record.procesadora = 'TOTAL DIA';
  record.procesadoras = procesadoras.sort().join(', ');
  record.registros_procesados = posRows.length;
  record.tallos_declarados = declarados;
  record.tallos_aprobados = aprobados;
  record.tallos_rechazados = rechazados;
  record.estado_calidad = aprobados <= 0 ? 'RECHAZADO' : aprobados < declarados ? 'AJUSTADO' : 'APROBADO';
  record.actualizado_en = new Date();
  if (!record.creado_en) record.creado_en = new Date();
  if (!record.origen) record.origen = 'CONTROL_CALIDAD_WEB';
}

function sincronizarRendimientoHistorico() {
  const registros = readObjects_('POSCOSECHA');
  let sincronizados = 0;
  registros.forEach(function(record) {
    const estado = String(record.estado || 'REGISTRADO').toUpperCase();
    if (estado === 'ELIMINADO' || estado === 'ANULADO') return;
    if (!record.id_poscosecha || !record.responsable || normalizarNumero_(record.tallos_procesados) <= 0) return;
    sincronizarRendimientoDesdePoscosecha_(record);
    sincronizados++;
  });
  return { ok: true, sincronizados: sincronizados };
}

function obtenerKPIsPanelGerencial(user) {
  const role = getRole_(user || {});
  const allowedSheets = ROLE_PERMISSIONS[role] || [];
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const readCount = function(sheetName) {
    if (allowedSheets.indexOf(sheetName) < 0 && role !== 'GERENCIA') return null;
    const sheet = spreadsheet.getSheetByName(sheetName);
    return sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  };
  return {
    ok: true,
    rol: role,
    permisos: allowedSheets,
    resumen: {
      produccion_registros: readCount('PRODUCCION_CAMPO'),
      poscosecha_registros: readCount('POSCOSECHA'),
      control_calidad_registros: readCount('CONTROL_CALIDAD'),
      rendimiento_registros: readCount('RENDIMIENTO_PROCESADORAS'),
      ventas_registros: readCount('VENTAS_VENDEDORES'),
      estado_cuenta_registros: readCount('ESTADO_CUENTA'),
      clientes_registros: readCount('CLIENTES'),
      comparativo_registros: readCount('COMPARATIVO_PROYECCION')
    }
  };
}

function getSheet_(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function(header) { return String(header || '').trim(); });
  const hasHeaders = currentHeaders.some(value => value);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    headers.forEach(function(header) {
      if (currentHeaders.indexOf(header) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      }
    });
  }
  return sheet;
}

function getWritableHeaders_(sheet, desiredHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), desiredHeaders.length);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function(header) { return String(header || '').trim(); });
  const hasHeaders = headers.some(function(header) { return header; });
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
    sheet.setFrozenRows(1);
    return desiredHeaders.slice();
  }
  desiredHeaders.forEach(function(header) {
    if (headers.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
  });
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(header) { return String(header || '').trim(); })
    .filter(function(header) { return header; });
  return headers;
}

function normalizeValue_(value) {
  if (value === null || value === undefined) return '';
  return value;
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


function readObjects_(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(function(h) { return String(h || '').trim(); });
  return values.map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) { obj[header] = row[index]; });
    return obj;
  });
}

function normalizarNumero_(value) {
  if (typeof value === 'number') return value;
  let cleaned = String(value || '').trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  if (cleaned.indexOf(',') >= 0) cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  return Number(cleaned) || 0;
}

function normalizarVariedad_(value) {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'RED' || v === 'NEW RED') return 'NEW RED';
  if (v === 'PEACH' || v === 'SPRING' || v === 'SPRING PEACH') return 'SPRING PEACH';
  if (v === 'GREEN' || v === 'GREEN XL') return 'GREEN XL';
  return v;
}

function normalizarMedida_(value) {
  const v = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!v) return '';
  if (['NACIONAL','NAC','NAC.','N'].indexOf(v) >= 0) return 'NACIONAL';
  const n = v.replace(/CM|CMS|CENTIMETROS|CENTIMETRO/g, '').replace(/[^0-9]/g, '');
  if (['70','60','55','50'].indexOf(n) >= 0) return n;
  return v;
}

function normalizarFecha_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const text = String(value).trim();
  const date = new Date(text);
  if (!isNaN(date.getTime())) return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return text;
}

function semanaISO_(fecha) {
  const d = new Date(normalizarFecha_(fecha) + 'T00:00:00');
  if (isNaN(d.getTime())) return 0;
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function estadoStock_(procesado, vendido, minimo) {
  if (vendido > procesado) return 'INCONSISTENCIA';
  const stock = Math.max(0, procesado - vendido);
  if (stock === 0) return 'AGOTADO';
  if (stock <= minimo) return 'BAJO STOCK';
  return 'DISPONIBLE';
}

function pasaFiltroStock_(row, filtros) {
  const fecha = row.fecha || '';
  if (filtros.desde && fecha && fecha < filtros.desde) return false;
  if (filtros.hasta && fecha && fecha > filtros.hasta) return false;
  if (filtros.semana && Number(row.semana) !== Number(filtros.semana)) return false;
  if (filtros.variedad && row.variedad !== normalizarVariedad_(filtros.variedad)) return false;
  if (filtros.medida && row.medida !== normalizarMedida_(filtros.medida)) return false;
  if (filtros.mes && fecha) {
    const d = new Date(fecha + 'T00:00:00');
    if ((d.getMonth() + 1) !== Number(filtros.mes)) return false;
  }
  return true;
}

function calcularStockCuartoFrio_(filtros) {
  const minimo = Number(filtros.minimo || 500);
  const controles = readObjects_('CONTROL_CALIDAD');
  const ventas = readObjects_('VENTAS_VENDEDORES');
  const medidas = [['70','tallos_70_aprobados'],['60','tallos_60_aprobados'],['55','tallos_55_aprobados'],['50','tallos_50_aprobados'],['NACIONAL','nacional_aprobado']];
  const map = {};
  const ensure = function(variedad, medida) {
    const key = variedad + '|' + medida;
    if (!map[key]) map[key] = { variedad: variedad, medida: medida, procesadoUtil: 0, vendido: 0 };
    return map[key];
  };
  controles.forEach(function(row) {
    const estado = String(row.estado_calidad || '').toUpperCase();
    if (estado !== 'APROBADO' && estado !== 'AJUSTADO') return;
    const variedad = normalizarVariedad_(row.variedad);
    const fecha = normalizarFecha_(row.fecha_control);
    if (!fecha || fecha < QUALITY_CUTOVER_DATE) return;
    const semana = normalizarNumero_(row.semana) || semanaISO_(row.fecha_proceso || fecha);
    medidas.forEach(function(pair) {
      const medida = pair[0];
      const cantidad = normalizarNumero_(row[pair[1]]);
      const item = { fecha: fecha, semana: semana, variedad: variedad, medida: medida };
      if (cantidad > 0 && pasaFiltroStock_(item, filtros)) ensure(variedad, medida).procesadoUtil += cantidad;
    });
  });
  ventas.forEach(function(row) {
    const estado = String(row.estado || 'VENDIDO').toUpperCase();
    if (estado === 'ELIMINADO' || estado === 'ANULADO') return;
    const variedad = normalizarVariedad_(row.variedad);
    const medida = normalizarMedida_(row.medida_cm || row.medida);
    const fecha = normalizarFecha_(row.fecha);
    if (!fecha || fecha < QUALITY_CUTOVER_DATE) return;
    const semana = normalizarNumero_(row.semana) || semanaISO_(fecha);
    const cantidad = normalizarNumero_(row.tallos);
    const item = { fecha: fecha, semana: semana, variedad: variedad, medida: medida };
    if (variedad && medida && cantidad > 0 && pasaFiltroStock_(item, filtros)) ensure(variedad, medida).vendido += cantidad;
  });
  let porVariedadMedida = Object.keys(map).map(function(key) {
    const row = map[key];
    const rawStock = row.procesadoUtil - row.vendido;
    row.stockDisponible = Math.max(0, rawStock);
    row.porcentajeVendido = row.procesadoUtil ? row.vendido / row.procesadoUtil : 0;
    row.estado = estadoStock_(row.procesadoUtil, row.vendido, minimo);
    return row;
  });
  if (filtros.estado) porVariedadMedida = porVariedadMedida.filter(function(row) { return row.estado === String(filtros.estado).toUpperCase(); });
  const varietyMap = {};
  porVariedadMedida.forEach(function(row) {
    if (!varietyMap[row.variedad]) varietyMap[row.variedad] = { variedad: row.variedad, procesadoUtil: 0, vendido: 0, stockDisponible: 0 };
    varietyMap[row.variedad].procesadoUtil += row.procesadoUtil;
    varietyMap[row.variedad].vendido += row.vendido;
    varietyMap[row.variedad].stockDisponible += row.stockDisponible;
  });
  const porVariedad = Object.keys(varietyMap).map(function(key) {
    const row = varietyMap[key];
    row.porcentajeVendido = row.procesadoUtil ? row.vendido / row.procesadoUtil : 0;
    row.estado = estadoStock_(row.procesadoUtil, row.vendido, minimo);
    return row;
  });
  const resumen = {
    procesadoUtil: porVariedadMedida.reduce(function(a, r) { return a + r.procesadoUtil; }, 0),
    vendido: porVariedadMedida.reduce(function(a, r) { return a + r.vendido; }, 0),
    stockDisponible: porVariedadMedida.reduce(function(a, r) { return a + r.stockDisponible; }, 0),
    variedadesDisponibles: porVariedad.filter(function(r) { return r.stockDisponible > 0; }).length,
    variedadesAgotadas: porVariedad.filter(function(r) { return r.estado === 'AGOTADO'; }).length,
    variedadesBajoStock: porVariedadMedida.filter(function(r) { return r.estado === 'BAJO STOCK'; }).length
  };
  const alertas = [];
  porVariedadMedida.forEach(function(row) {
    if (row.estado === 'INCONSISTENCIA') alertas.push({ tipo: 'bad', mensaje: 'Venta supera inventario aprobado para ' + row.variedad + ' ' + row.medida });
    if (row.estado === 'AGOTADO') alertas.push({ tipo: 'bad', mensaje: row.variedad + ' ' + row.medida + ' agotado' });
    if (row.estado === 'BAJO STOCK') alertas.push({ tipo: 'warn', mensaje: 'Bajo stock en ' + row.variedad + ' ' + row.medida + ': ' + row.stockDisponible });
  });
  return { resumen: resumen, porVariedad: porVariedad, porVariedadMedida: porVariedadMedida, detalle: [], alertas: alertas };
}

function obtenerStockCuartoFrio(filtros) {
  const role = getRole_(filtros || {});
  if (['GERENCIA','OPERADORA_PRODUCCION','VENDEDOR','CLIENTE_STOCK'].indexOf(role) < 0) throw new Error('Rol sin permiso para consultar cuarto frio');
  const data = calcularStockCuartoFrio_(filtros || {});
  data.ok = true;
  data.rol = role;
  return data;
}

function diagnosticarStockCuartoFrio(filtros) {
  const pos = readObjects_('POSCOSECHA');
  const controles = readObjects_('CONTROL_CALIDAD');
  const ventas = readObjects_('VENTAS_VENDEDORES');
  const variedadesPos = {};
  const variedadesVentas = {};
  const medidasPos = {};
  const medidasVentas = {};
  pos.forEach(function(row) {
    if (row.variedad) variedadesPos[normalizarVariedad_(row.variedad)] = true;
    ['tallos_70','tallos_60','tallos_55','tallos_50','nacional'].forEach(function(k) { if (normalizarNumero_(row[k]) > 0) medidasPos[k] = true; });
  });
  ventas.forEach(function(row) {
    if (row.variedad) variedadesVentas[normalizarVariedad_(row.variedad)] = true;
    if (row.medida_cm || row.medida) medidasVentas[normalizarMedida_(row.medida_cm || row.medida)] = true;
  });
  return {
    ok: true,
    fechaCorteControlCalidad: QUALITY_CUTOVER_DATE,
    totalPoscosecha: pos.length,
    totalControlesCalidad: controles.length,
    controlesAprobados: controles.filter(function(r) { return ['APROBADO','AJUSTADO'].indexOf(String(r.estado_calidad || '').toUpperCase()) >= 0; }).length,
    controlesRechazados: controles.filter(function(r) { return String(r.estado_calidad || '').toUpperCase() === 'RECHAZADO'; }).length,
    totalVentas: ventas.length,
    variedadesPoscosecha: Object.keys(variedadesPos),
    variedadesVentas: Object.keys(variedadesVentas),
    medidasPoscosecha: Object.keys(medidasPos),
    medidasVentas: Object.keys(medidasVentas),
    registrosVentaMedidaVacia: ventas.filter(function(r) { return !normalizarMedida_(r.medida_cm || r.medida); }).length,
    registrosVentaVariedadVacia: ventas.filter(function(r) { return !normalizarVariedad_(r.variedad); }).length,
    registrosPoscosechaVariedadVacia: pos.filter(function(r) { return !normalizarVariedad_(r.variedad); }).length
  };
}

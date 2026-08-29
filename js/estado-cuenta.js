let estadoRows = [];
let invoiceRows = [];
let invoiceLookup = new Map();
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
    const estado = estadoFromSaldo(valor, saldo, vencimiento);
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
      fecha_registro: text(row.fecha_registro)
    };
  }).filter(row => row.cliente && (row.numero_factura || row.valor_factura || row.valor_pagado));
}

function invoiceKey(value) {
  return text(value).toUpperCase();
}

function canonicalInvoiceRows(rows) {
  const map = new Map();
  (rows || []).filter(row => row.numero_factura).forEach(row => {
    const key = invoiceKey(row.numero_factura);
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
    current.observacion = row.observacion || current.observacion;
    current.estado = estadoFromSaldo(valor, current.saldo_pendiente, current.fecha_vencimiento);
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

function renderEstadoCuenta() {
  const today = todayISO();
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
  const [estadoResult, facturasResult] = await Promise.allSettled([
    loadSheet(ALTITUD.sheets.estadoCuenta),
    loadSheet(ALTITUD.sheets.facturas)
  ]);
  estadoRows = estadoResult.status === 'fulfilled'
    ? normalizeEstadoCuenta(estadoResult.value)
    : normalizeEstadoCuenta(localDataRows('cuentas'));
  const facturas = facturasResult.status === 'fulfilled'
    ? normalizeEstadoCuenta(facturasResult.value)
    : [];
  invoiceRows = canonicalInvoiceRows([...estadoRows, ...facturas]);
  rebuildInvoiceLookup();
  renderEstadoCuenta();
  applyInvoiceSelection();
  setStatus(`Estado de cuenta actualizado - ${fmtInt(invoiceRows.length)} facturas`);
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
  await fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, record, pdf, driveFolderId: ALTITUD.driveFolderFacturasId, user })
  });
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
  $('refreshBtn').addEventListener('click', loadEstadoCuenta);
  updateFacturaPreview();
  applyInvoiceSelection();

  $('facturaForm').addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = $('factSubmit');
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
    if (invoiceLookup.has(invoiceKey(record.numero_factura))) {
      $('factMsg').textContent = `La factura ${record.numero_factura} ya existe en el estado de cuenta.`;
      $('factNumero').focus();
      return;
    }
    const pdf = await readPdf($('factPdf').files[0]);
    submitButton.disabled = true;
    $('factMsg').textContent = 'Guardando factura y PDF. Espera la confirmacion de Google Sheets...';
    try {
      await postEstadoCuenta('registrarFactura', record, pdf);
      const savedInvoice = await waitForRemoteInvoice(record.numero_factura);
      if (!savedInvoice) throw new Error('Google Sheets no confirmo el registro');
      const normalizedSaved = normalizeEstadoCuenta([savedInvoice])[0];
      if (normalizedSaved) appendLocal(normalizedSaved);
      $('factMsg').textContent = `Factura ${record.numero_factura} guardada y confirmada en Google Sheets.`;
      $('facturaForm').reset();
      $('factFecha').value = todayISO();
      $('factPdfStatus').textContent = 'Selecciona una factura PDF para completar automaticamente los datos.';
      updateFacturaPreview();
      await loadEstadoCuenta();
      if (!invoiceLookup.has(invoiceKey(record.numero_factura))) appendLocal(normalizedSaved);
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

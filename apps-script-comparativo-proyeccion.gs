// Publicar como Web App independiente o fusionar manualmente con el endpoint que corresponda.
// Lee PROYECCION si existe; si no, usa PROYECCION_COSECHA. No modifica la proyección original.
const COMPARATIVO_SPREADSHEET_ID = '1Dru-SjYwkxw8J8Z6OqqC5nGsPOJCiLPvY3rJcNFALgQ';
const COMPARATIVO_HEADERS = ['id_comparativo','fecha_registro','siembra','variedad','semana','tallos_proyectados','tallos_reales','diferencia_tallos','porcentaje_cumplimiento','estado_resultado','observacion'];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'comparar');
  setupComparativoProyeccion();
  if (action === 'proyeccion') return jsonComparativo_(leerProyeccion());
  if (action === 'reales') return jsonComparativo_({ produccion: leerProduccionCampo(), poscosecha: leerPoscosecha() });
  if (action === 'comparar') return jsonComparativo_({ ok: true, rows: compararProyeccionVsReal() });
  return jsonComparativo_({ ok: true, service: 'altitud_comparativo_proyeccion' });
}

function doPost(e) {
  try {
    setupComparativoProyeccion();
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'guardarComparativo') return jsonComparativo_(guardarComparativo(payload.rows || compararProyeccionVsReal()));
    if (payload.action === 'compararYGuardar') return jsonComparativo_(guardarComparativo(compararProyeccionVsReal()));
    throw new Error('Accion no permitida: ' + payload.action);
  } catch (error) {
    return jsonComparativo_({ ok: false, error: String(error) });
  }
}

function setupComparativoProyeccion() {
  ensureComparativoSheet_('COMPARATIVO_PROYECCION', COMPARATIVO_HEADERS);
  return { ok: true };
}

function leerProyeccion() {
  const ss = SpreadsheetApp.openById(COMPARATIVO_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('PROYECCION') || ss.getSheetByName('PROYECCION_COSECHA');
  if (!sheet) return [];
  return readObjectsFromSheet_(sheet);
}

function leerProduccionCampo() {
  const ss = SpreadsheetApp.openById(COMPARATIVO_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('PRODUCCION_CAMPO');
  return sheet ? readObjectsFromSheet_(sheet) : [];
}

function leerPoscosecha() {
  const ss = SpreadsheetApp.openById(COMPARATIVO_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('POSCOSECHA');
  return sheet ? readObjectsFromSheet_(sheet) : [];
}

function compararProyeccionVsReal() {
  const projections = normalizeProjectionComparativo_(leerProyeccion());
  const production = normalizeProductionComparativo_(leerProduccionCampo());
  const postharvest = normalizePostharvestComparativo_(leerPoscosecha());
  return projections.map(function(projection, index) {
    const key = keyComparativo_(projection.siembra, projection.variedad, projection.semana);
    const prod = production[key] || {};
    const post = postharvest[key] || {};
    const cosechado = numComparativo_(prod.tallos_cosechados_reales);
    const procesado = numComparativo_(post.tallos_procesados_reales);
    const reales = cosechado || procesado;
    const diferencia = reales - projection.tallos_proyectados;
    const cumplimiento = projection.tallos_proyectados ? (reales / projection.tallos_proyectados) * 100 : 0;
    return {
      id_comparativo: 'CMP-' + Date.now() + '-' + index,
      fecha_registro: new Date().toISOString(),
      siembra: projection.siembra,
      variedad: projection.variedad,
      semana: projection.semana,
      semana_proyectada: projection.semana,
      fecha_cosecha: prod.fecha_cosecha || post.fecha_cosecha || projection.fecha_cosecha || '',
      tallos_proyectados: projection.tallos_proyectados,
      tallos_cosechados_reales: cosechado,
      tallos_procesados_reales: procesado,
      descarte_real: numComparativo_(post.descarte_real),
      tallos_reales: reales,
      diferencia_tallos: diferencia,
      porcentaje_cumplimiento: cumplimiento,
      estado_resultado: estadoComparativo_(cumplimiento, diferencia),
      observacion: projection.observacion || ''
    };
  });
}

function guardarComparativo(rows) {
  const sheet = ensureComparativoSheet_('COMPARATIVO_PROYECCION', COMPARATIVO_HEADERS);
  const cleanRows = (rows || []).map(function(row) {
    return COMPARATIVO_HEADERS.map(function(header) {
      if (header === 'tallos_reales') return numComparativo_(row.tallos_reales || row.tallos_cosechados_reales || row.tallos_procesados_reales);
      return row[header] === undefined ? '' : row[header];
    });
  });
  if (cleanRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, cleanRows.length, COMPARATIVO_HEADERS.length).setValues(cleanRows);
  return { ok: true, saved: cleanRows.length };
}

function normalizeProjectionComparativo_(rows) {
  const out = [];
  rows.forEach(function(row) {
    const semana = numComparativo_(row.semana || row.semana_proyectada);
    const siembra = String(row.siembra || row.bloque || row.lote || 'SIN SIEMBRA').trim().toUpperCase();
    const varieties = splitVarietiesComparativo_(row.variedad || row.variedades);
    const projected = numComparativo_(row.tallos_proyectados || row.tallos_vendibles || row.tallos_brutos || row.tallos);
    if (!semana || !projected || !varieties.length) return;
    const perVariety = projected / varieties.length;
    varieties.forEach(function(variedad) {
      out.push({
        siembra: siembra,
        variedad: variedad,
        semana: semana,
        fecha_cosecha: row.fecha_cosecha || row.fecha || row.fecha_inicio || '',
        tallos_proyectados: perVariety,
        observacion: row.observaciones || row.observacion || ''
      });
    });
  });
  return out;
}

function normalizeProductionComparativo_(rows) {
  const grouped = {};
  rows.forEach(function(row) {
    const siembra = String(row.siembra || row.bloque || row.lote || 'SIN SIEMBRA').trim().toUpperCase();
    const variedad = normalizeVarietyComparativo_(row.variedad);
    const semana = numComparativo_(row.semana);
    const tallos = numComparativo_(row.tallos_cortados || row.tallos_cosechados || row.tallos);
    if (!variedad || !semana || !tallos) return;
    const key = keyComparativo_(siembra, variedad, semana);
    if (!grouped[key]) grouped[key] = { siembra: siembra, variedad: variedad, semana: semana, fecha_cosecha: row.fecha || '', tallos_cosechados_reales: 0 };
    grouped[key].tallos_cosechados_reales += tallos;
    if (row.fecha) grouped[key].fecha_cosecha = row.fecha;
  });
  return grouped;
}

function normalizePostharvestComparativo_(rows) {
  const grouped = {};
  rows.forEach(function(row) {
    const siembra = String(row.siembra || row.bloque || row.lote || 'SIN SIEMBRA').trim().toUpperCase();
    const variedad = normalizeVarietyComparativo_(row.variedad);
    const semana = numComparativo_(row.semana);
    const t70 = numComparativo_(row.tallos_70), t60 = numComparativo_(row.tallos_60), t55 = numComparativo_(row.tallos_55), t50 = numComparativo_(row.tallos_50);
    const nacional = numComparativo_(row.nacional), descarte = numComparativo_(row.basura);
    const procesado = numComparativo_(row.tallos_procesados) || t70 + t60 + t55 + t50 + nacional;
    if (!variedad || !semana || !procesado) return;
    const key = keyComparativo_(siembra, variedad, semana);
    if (!grouped[key]) grouped[key] = { siembra: siembra, variedad: variedad, semana: semana, fecha_cosecha: row.fecha || '', tallos_procesados_reales: 0, descarte_real: 0 };
    grouped[key].tallos_procesados_reales += procesado;
    grouped[key].descarte_real += descarte;
    if (row.fecha) grouped[key].fecha_cosecha = row.fecha;
  });
  return grouped;
}

function ensureComparativoSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(COMPARATIVO_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (!current.some(Boolean)) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readObjectsFromSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(function(value) { return String(value || '').trim(); });
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) { if (header) obj[header] = row[index]; });
    return obj;
  }).filter(function(row) { return Object.keys(row).some(function(key) { return row[key] !== '' && row[key] !== null; }); });
}

function splitVarietiesComparativo_(value) {
  return String(value || '').split(/\s*\+\s*|\s*,\s*|\s+y\s+/i).map(normalizeVarietyComparativo_).filter(Boolean);
}

function normalizeVarietyComparativo_(value) {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'RED' || v === 'NEW RED') return 'NEW RED';
  if (v === 'PEACH' || v === 'SPRING' || v === 'SPRING PEACH') return 'SPRING PEACH';
  if (v === 'GREEN' || v === 'GREEN XL') return 'GREEN XL';
  return v;
}

function keyComparativo_(siembra, variedad, semana) {
  return String(siembra || '').trim().toUpperCase() + '|' + normalizeVarietyComparativo_(variedad) + '|' + numComparativo_(semana);
}

function estadoComparativo_(percent, diff) {
  if (diff > 0) return 'SUPERA PROYECCION';
  if (percent >= 95) return 'CUMPLE';
  if (percent >= 80) return 'BAJO LO ESPERADO';
  return 'DEFICIENTE';
}

function numComparativo_(value) {
  if (typeof value === 'number') return value;
  let text = String(value || '').trim().replace(/[^\d,.-]/g, '');
  if (!text) return 0;
  if (text.indexOf(',') >= 0) text = text.replace(/\./g, '').replace(',', '.');
  return Number(text) || 0;
}

function jsonComparativo_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

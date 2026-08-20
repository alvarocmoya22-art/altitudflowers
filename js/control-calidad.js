const QUALITY_MEASURES = [
  { key: '70', source: 'tallos_70', approved: 'tallos_70_aprobados', input: 'qa70', label: 'qd70' },
  { key: '60', source: 'tallos_60', approved: 'tallos_60_aprobados', input: 'qa60', label: 'qd60' },
  { key: '55', source: 'tallos_55', approved: 'tallos_55_aprobados', input: 'qa55', label: 'qd55' },
  { key: '50', source: 'tallos_50', approved: 'tallos_50_aprobados', input: 'qa50', label: 'qd50' },
  { key: 'NACIONAL', source: 'nacional', approved: 'nacional_aprobado', input: 'qaNacional', label: 'qdNacional' }
];

let qualityPosRows = [];
let qualityRows = [];
let qualitySalesRows = [];
let selectedQualityGroupKey = '';
let editingQualityId = '';

function qualityPosId(row) {
  return text(row.id_poscosecha);
}

function qualityRowId(row) {
  return text(row.id_control_calidad) || `CC-${text(row.clave_control || row.id_poscosecha)}`;
}

function qualityDeclared(row) {
  return QUALITY_MEASURES.reduce((sum, measure) => sum + asNumber(row?.[measure.source]), 0);
}

function qualityEligible(row) {
  const processDate = normalizarFecha(row.fecha);
  const createdDate = normalizarFecha(text(row.creado_en).slice(0, 10));
  return !!qualityPosId(row) && (processDate >= ALTITUD.qualityCutoverDate || createdDate >= ALTITUD.qualityCutoverDate);
}

function uniqueQualityPos(rows) {
  const map = new Map();
  normalizeProcessed(rows).forEach(row => {
    const id = qualityPosId(row);
    if (!id || !qualityEligible(row)) return;
    const existing = map.get(id);
    if (!existing || text(row.creado_en) > text(existing.creado_en)) map.set(id, row);
  });
  return Array.from(map.values());
}

function qualityDailyGroups(rows) {
  const map = new Map();
  uniqueQualityPos(rows).forEach(row => {
    const key = qualityGroupKey(row.fecha, row.variedad);
    if (!row.fecha || !row.variedad) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        fecha: row.fecha,
        semana: row.semana || isoWeekAltitud(row.fecha),
        variedad: row.variedad,
        ids_poscosecha: [],
        procesadoras: [],
        registros: 0,
        tallos_70: 0,
        tallos_60: 0,
        tallos_55: 0,
        tallos_50: 0,
        nacional: 0
      });
    }

    const group = map.get(key);
    const id = qualityPosId(row);
    const processor = text(row.responsable).toUpperCase();
    if (!group.ids_poscosecha.includes(id)) group.ids_poscosecha.push(id);
    if (processor && !group.procesadoras.includes(processor)) group.procesadoras.push(processor);
    group.registros += 1;
    QUALITY_MEASURES.forEach(measure => {
      group[measure.source] += asNumber(row[measure.source]);
    });
  });

  return Array.from(map.values())
    .map(group => ({
      ...group,
      ids_poscosecha: group.ids_poscosecha.sort(),
      procesadoras: group.procesadoras.sort()
    }))
    .sort((a, b) => text(b.fecha).localeCompare(text(a.fecha)) || text(a.variedad).localeCompare(text(b.variedad)));
}

function qualityControlMap() {
  const map = new Map();
  normalizeQuality(qualityRows).forEach(row => {
    const key = row.clave_control || qualityGroupKey(row.fecha_proceso, row.variedad);
    const existing = map.get(key);
    if (!existing || text(row.actualizado_en || row.fecha_control) > text(existing.actualizado_en || existing.fecha_control)) {
      map.set(key, row);
    }
  });
  return map;
}

function qualityControlCoversGroup(control, group) {
  if (!control || !group) return false;
  const controlledIds = qualityPosIds(control).sort().join('|');
  return controlledIds === group.ids_poscosecha.slice().sort().join('|');
}

function qualityStatusPill(status) {
  const value = text(status).toUpperCase();
  const cls = value === 'RECHAZADO' ? 'bad' : value === 'AJUSTADO' ? 'warn' : 'ok';
  return `<span class="pill ${cls}">${value}</span>`;
}

function renderQuality() {
  const groups = qualityDailyGroups(qualityPosRows);
  const controls = normalizeQuality(qualityRows).sort((a, b) =>
    text(b.fecha_control).localeCompare(text(a.fecha_control)) || text(b.actualizado_en).localeCompare(text(a.actualizado_en))
  );
  const controlMap = qualityControlMap();
  const pending = groups.filter(group => !qualityControlCoversGroup(controlMap.get(group.key), group));

  $('kCalidadPendientes').textContent = fmtInt(pending.length);
  $('kCalidadRevisados').textContent = fmtInt(controls.length);
  $('kCalidadLiberados').textContent = fmtInt(controls.reduce((sum, row) => sum + row.tallos_aprobados, 0));
  $('kCalidadRechazados').textContent = fmtInt(controls.reduce((sum, row) => sum + row.tallos_rechazados, 0));

  renderRows($('qualityPendingBody'), pending, [
    row => row.fecha,
    row => row.variedad,
    row => fmtInt(row.registros),
    row => fmtInt(qualityDeclared(row)),
    row => `<button class="btn primary small" type="button" data-review-quality="${encodeURIComponent(row.key)}">Revisar</button>`
  ], 'No hay totales diarios pendientes de control.');

  renderRows($('qualityHistoryBody'), controls, [
    row => row.fecha_control,
    row => row.fecha_proceso,
    row => row.variedad,
    row => fmtInt(row.registros_procesados || qualityPosIds(row).length),
    row => fmtInt(row.tallos_declarados),
    row => fmtInt(row.tallos_aprobados),
    row => fmtInt(row.tallos_rechazados),
    row => qualityStatusPill(row.estado_calidad),
    row => row.controlador || '-',
    row => `<div class="row-actions"><button class="btn small" type="button" data-edit-quality="${qualityRowId(row)}">Editar</button><button class="btn danger small" type="button" data-delete-quality="${qualityRowId(row)}">Eliminar</button></div>`
  ]);

  setStatus(`Calidad - ${pending.length} totales diarios pendientes · ${controls.length} revisados`);
}

function selectedQualityGroup() {
  return qualityDailyGroups(qualityPosRows).find(group => group.key === selectedQualityGroupKey);
}

function qualityInputTotals() {
  const approved = QUALITY_MEASURES.reduce((sum, measure) => sum + asNumber($(measure.input).value), 0);
  const declared = qualityDeclared(selectedQualityGroup());
  const rejected = Math.max(0, declared - approved);
  const status = approved <= 0 ? 'RECHAZADO' : approved < declared ? 'AJUSTADO' : 'APROBADO';
  return { approved, declared, rejected, status };
}

function updateQualityTotals() {
  const totals = qualityInputTotals();
  $('qTotalDeclarado').textContent = fmtInt(totals.declared);
  $('qTotalAprobado').textContent = fmtInt(totals.approved);
  $('qTotalRechazado').textContent = fmtInt(totals.rejected);
  $('qEstado').textContent = totals.status;
  $('qEstado').className = totals.status === 'RECHAZADO' ? 'quality-result bad' : totals.status === 'AJUSTADO' ? 'quality-result warn' : 'quality-result ok';
  $('qSave').textContent = totals.status === 'RECHAZADO' ? 'Registrar rechazo' : editingQualityId ? 'Actualizar control' : 'Liberar inventario';
}

function clearQualityForm() {
  selectedQualityGroupKey = '';
  editingQualityId = '';
  $('qualityForm').reset();
  $('qualityFields').disabled = true;
  $('qualityFormTitle').textContent = 'Revision del total diario';
  $('qualityFormHint').textContent = 'Selecciona una fecha y variedad pendiente para comenzar.';
  ['qFechaProceso', 'qVariedad', 'qRegistros'].forEach(id => { $(id).textContent = '-'; });
  $('qDeclarado').textContent = '0';
  QUALITY_MEASURES.forEach(measure => {
    $(measure.input).value = '';
    $(measure.label).textContent = 'de 0';
  });
  updateQualityTotals();
}

function openQualityForm(group, controlRow = null, resetAmounts = false) {
  if (!group) return;
  selectedQualityGroupKey = group.key;
  editingQualityId = controlRow ? qualityRowId(controlRow) : '';
  $('qualityFields').disabled = false;
  $('qualityFormTitle').textContent = controlRow ? 'Actualizar control diario' : 'Revisar total diario';
  $('qualityFormHint').textContent = `${group.fecha} · ${group.variedad}`;
  $('qFechaProceso').textContent = group.fecha;
  $('qVariedad').textContent = group.variedad;
  $('qRegistros').textContent = fmtInt(group.registros);
  $('qDeclarado').textContent = fmtInt(qualityDeclared(group));

  QUALITY_MEASURES.forEach(measure => {
    const declared = asNumber(group[measure.source]);
    const approved = controlRow && !resetAmounts ? asNumber(controlRow[measure.approved]) : declared;
    $(measure.input).max = declared;
    $(measure.input).value = approved || '';
    $(measure.label).textContent = `de ${fmtInt(declared)}`;
  });

  $('qControlador').value = text(controlRow?.controlador);
  $('qMotivo').value = resetAmounts ? '' : text(controlRow?.motivo_rechazo);
  $('qObservaciones').value = text(controlRow?.observaciones);
  updateQualityTotals();
  $('qualityForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function validateQualityAmounts() {
  const group = selectedQualityGroup();
  for (const measure of QUALITY_MEASURES) {
    const declared = asNumber(group?.[measure.source]);
    const approved = asNumber($(measure.input).value);
    if (approved < 0 || approved > declared) {
      setStatus(`${measure.key === 'NACIONAL' ? 'Nacional' : `${measure.key} cm`}: aprobado no puede superar ${fmtInt(declared)}`);
      $(measure.input).focus();
      return false;
    }
  }
  const totals = qualityInputTotals();
  if (totals.rejected > 0 && !text($('qMotivo').value)) {
    setStatus('Selecciona el motivo del ajuste o rechazo');
    $('qMotivo').focus();
    return false;
  }
  return true;
}

function qualityControlIdForGroup(group) {
  const slug = group.key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `CC-${slug}`;
}

function buildQualityRecord() {
  const group = selectedQualityGroup();
  const previous = normalizeQuality(qualityRows).find(row => qualityRowId(row) === editingQualityId);
  const totals = qualityInputTotals();
  const ids = group.ids_poscosecha.join('|');
  return {
    id_control_calidad: editingQualityId || qualityControlIdForGroup(group),
    clave_control: group.key,
    id_poscosecha: ids,
    ids_poscosecha: ids,
    fecha_proceso: group.fecha,
    fecha_control: todayISO(),
    semana: group.semana,
    variedad: group.variedad,
    procesadora: 'TOTAL DIA',
    procesadoras: group.procesadoras.join(', '),
    registros_procesados: group.registros,
    tallos_declarados: totals.declared,
    tallos_70_aprobados: asNumber($('qa70').value),
    tallos_60_aprobados: asNumber($('qa60').value),
    tallos_55_aprobados: asNumber($('qa55').value),
    tallos_50_aprobados: asNumber($('qa50').value),
    nacional_aprobado: asNumber($('qaNacional').value),
    tallos_aprobados: totals.approved,
    tallos_rechazados: totals.rejected,
    estado_calidad: totals.status,
    controlador: text($('qControlador').value).toUpperCase(),
    motivo_rechazo: text($('qMotivo').value).toUpperCase(),
    observaciones: text($('qObservaciones').value),
    creado_en: previous?.creado_en || new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
    origen: 'CONTROL_CALIDAD_WEB'
  };
}

function qualityWouldBreakStock(nextRows) {
  return calculateColdRoomStock(nextRows, qualitySalesRows).porVariedadMedida.some(row => asNumber(row.stockReal) < 0);
}

async function reloadQualityData() {
  const [pos, controls, sales] = await Promise.all([
    loadSheet(ALTITUD.sheets.poscosecha),
    loadSheet(ALTITUD.sheets.controlCalidad),
    loadSheet(ALTITUD.sheets.ventas)
  ]);
  qualityPosRows = pos;
  qualityRows = controls;
  qualitySalesRows = sales;
  renderQuality();
}

async function verifyQualitySaved(id) {
  for (let attempt = 0; attempt < 7; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 900));
    try {
      const rows = await loadSheet(ALTITUD.sheets.controlCalidad);
      if (normalizeQuality(rows).some(row => qualityRowId(row) === id)) return rows;
    } catch (err) {}
  }
  return null;
}

async function initControlCalidad() {
  const allowed = await ALTITUD_PERMISOS.enforcePagePermission();
  if (!allowed) return;

  try {
    await reloadQualityData();
  } catch (err) {
    try {
      qualityPosRows = await loadSheet(ALTITUD.sheets.poscosecha);
    } catch (loadError) {
      qualityPosRows = [];
    }
    qualityRows = [];
    qualitySalesRows = [];
    renderQuality();
    setStatus('Falta crear o publicar la hoja CONTROL_CALIDAD en Apps Script');
  }

  QUALITY_MEASURES.forEach(measure => $(measure.input).addEventListener('input', updateQualityTotals));
  $('qCancel').addEventListener('click', clearQualityForm);

  $('qualityPendingBody').addEventListener('click', event => {
    const button = event.target.closest('[data-review-quality]');
    if (!button) return;
    const key = decodeURIComponent(button.dataset.reviewQuality);
    const group = qualityDailyGroups(qualityPosRows).find(row => row.key === key);
    const existing = qualityControlMap().get(key);
    openQualityForm(group, existing || null, !!existing && !qualityControlCoversGroup(existing, group));
  });

  $('qualityHistoryBody').addEventListener('click', async event => {
    const editButton = event.target.closest('[data-edit-quality]');
    if (editButton) {
      const control = normalizeQuality(qualityRows).find(row => qualityRowId(row) === editButton.dataset.editQuality);
      const group = qualityDailyGroups(qualityPosRows).find(row => row.key === control?.clave_control);
      if (control && group) openQualityForm(group, control, !qualityControlCoversGroup(control, group));
      else setStatus('No se encontro el total diario de poscosecha asociado a este control');
      return;
    }

    const deleteButton = event.target.closest('[data-delete-quality]');
    if (!deleteButton) return;
    const id = deleteButton.dataset.deleteQuality;
    const nextRows = normalizeQuality(qualityRows).filter(row => qualityRowId(row) !== id);
    if (qualityWouldBreakStock(nextRows)) {
      setStatus('No se puede eliminar: dejaria ventas registradas sin stock aprobado');
      return;
    }
    if (!confirm('Eliminar este control? El total del dia volvera a quedar pendiente y saldra del stock.')) return;
    setStatus('Eliminando control...');
    try {
      await deleteSheetRecord(ALTITUD.sheets.controlCalidad, 'id_control_calidad', id);
      await new Promise(resolve => setTimeout(resolve, 900));
      await reloadQualityData();
      clearQualityForm();
      setStatus('Control eliminado; el total diario vuelve a estar pendiente');
    } catch (err) {
      setStatus('No se pudo eliminar el control en Sheets');
    }
  });

  $('qualityForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedQualityGroup() || !validateQualityAmounts()) return;
    const record = buildQualityRecord();
    const nextRows = editingQualityId
      ? normalizeQuality(qualityRows).map(row => qualityRowId(row) === editingQualityId ? record : row)
      : [record, ...normalizeQuality(qualityRows)];
    if (qualityWouldBreakStock(nextRows)) {
      setStatus('No se puede guardar: la cantidad aprobada quedaria por debajo de las ventas existentes');
      return;
    }

    $('qSave').disabled = true;
    setStatus('Guardando control diario y verificando Sheets...');
    try {
      await submitRecord(ALTITUD.sheets.controlCalidad, record);
      const verifiedRows = await verifyQualitySaved(record.id_control_calidad);
      if (!verifiedRows) throw new Error('No se verifico el registro');
      qualityRows = verifiedRows;
      renderQuality();
      clearQualityForm();
      setStatus(`${record.estado_calidad}: ${fmtInt(record.tallos_aprobados)} tallos liberados a cuarto frio`);
    } catch (err) {
      setStatus('No se confirmo el guardado. Revisa la implementacion de Apps Script');
    } finally {
      $('qSave').disabled = false;
    }
  });

  window.setInterval(async () => {
    if (selectedQualityGroupKey) return;
    try {
      await reloadQualityData();
    } catch (err) {}
  }, 60000);
}

document.addEventListener('DOMContentLoaded', initControlCalidad);

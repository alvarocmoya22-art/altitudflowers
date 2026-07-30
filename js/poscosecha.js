const PROCESADORAS_POSCOSECHA = ['MARGARITA', 'ANGELICA', 'CRISTINA'];

let poscosechaRows = [];
let editingPoscosechaId = '';

function poscosechaId(row) {
  return text(row.id_poscosecha) || [
    row.fecha,
    row.semana,
    row.variedad,
    row.tallos_procesados,
    row.tallos_70,
    row.tallos_60,
    row.tallos_55,
    row.tallos_50,
    row.nacional,
    row.basura
  ].map(text).join('|');
}

function isoWeekPoscosecha(dateText) {
  const d = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function normalizePosRows(rows) {
  return normalizeProcessed(rows).map((row, index) => {
    const source = (rows || [])[index] || {};
    return {
      ...row,
      id_poscosecha: text(source.id_poscosecha),
      responsable: text(source.responsable).toUpperCase(),
      minutos_trabajados: asNumber(source.minutos_trabajados),
      observaciones: text(source.observaciones || source.observacion),
      estado: text(source.estado || 'REGISTRADO').toUpperCase(),
      creado_en: text(source.creado_en)
    };
  }).filter(row => row.estado !== 'ELIMINADO' && row.estado !== 'ANULADO');
}

function dedupePoscosecha(rows) {
  const map = new Map();
  normalizePosRows(rows).forEach(row => {
    const id = poscosechaId(row);
    const existing = map.get(id);
    if (!existing || text(row.creado_en) > text(existing.creado_en)) map.set(id, row);
  });
  return Array.from(map.values()).sort((a, b) =>
    text(b.creado_en).localeCompare(text(a.creado_en)) || text(b.fecha).localeCompare(text(a.fecha))
  );
}

function renderPoscosecha(rows) {
  const normalized = dedupePoscosecha(rows);
  $('kProcesados').textContent = fmtInt(normalized.reduce((a, r) => a + r.tallos_procesados, 0));
  $('kUtil').textContent = fmtInt(normalized.reduce((a, r) => a + r.util, 0));
  $('kBasura').textContent = fmtInt(normalized.reduce((a, r) => a + r.basura, 0));
  $('kRegistros').textContent = fmtInt(normalized.length);

  renderRows($('poscosechaBody'), normalized, [
    r => r.fecha,
    r => r.semana,
    r => r.variedad,
    r => fmtInt(r.tallos_procesados),
    r => fmtInt(r.tallos_70),
    r => fmtInt(r.tallos_60),
    r => fmtInt(r.tallos_55),
    r => fmtInt(r.tallos_50),
    r => fmtInt(r.nacional),
    r => fmtInt(r.basura),
    r => `<div class="row-actions"><button class="btn small" type="button" data-edit-poscosecha="${poscosechaId(r)}">Editar</button><button class="btn danger small" type="button" data-delete-poscosecha="${poscosechaId(r)}">Eliminar</button></div>`
  ]);
}

function updatePoscosechaWeek() {
  $('semana').value = isoWeekPoscosecha($('fecha').value);
}

function updateTotalPoscosecha() {
  const total = ['t70', 't60', 't55', 't50', 'nacional', 'basura']
    .reduce((a, id) => a + asNumber($(id).value), 0);
  $('totalProcesado').textContent = fmtInt(total);
}

function setupPoscosechaForm() {
  if ($('variedad')) {
    $('variedad').innerHTML = '<option value="">Selecciona variedad</option>' +
      ALTITUD.variedades.map(v => `<option value="${v}">${v}</option>`).join('');
  }
  if ($('responsable')) {
    $('responsable').innerHTML = '<option value="">Selecciona procesadora</option>' +
      PROCESADORAS_POSCOSECHA.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  $('fecha').value = $('fecha').value || todayISO();
  $('fecha').addEventListener('change', updatePoscosechaWeek);
  updatePoscosechaWeek();

  ['t70', 't60', 't55', 't50', 'nacional', 'basura'].forEach(id => {
    $(id).addEventListener('input', updateTotalPoscosecha);
  });
}

function buildPoscosechaRecord() {
  const t70 = asNumber($('t70').value);
  const t60 = asNumber($('t60').value);
  const t55 = asNumber($('t55').value);
  const t50 = asNumber($('t50').value);
  const nacional = asNumber($('nacional').value);
  const basura = asNumber($('basura').value);
  const procesados = t70 + t60 + t55 + t50 + nacional + basura;
  const previous = editingPoscosechaId
    ? poscosechaRows.find(row => poscosechaId(row) === editingPoscosechaId)
    : null;

  return {
    id_poscosecha: editingPoscosechaId || `PC-${Date.now()}`,
    fecha: $('fecha').value,
    semana: asNumber($('semana').value) || isoWeekPoscosecha($('fecha').value),
    variedad: text($('variedad').value).toUpperCase(),
    tallos_procesados: procesados,
    tallos_70: t70,
    tallos_60: t60,
    tallos_55: t55,
    tallos_50: t50,
    nacional,
    basura,
    aprovechamiento_pct: procesados ? (procesados - basura) / procesados : 0,
    descarte_pct: procesados ? basura / procesados : 0,
    responsable: text($('responsable').value).toUpperCase(),
    minutos_trabajados: asNumber($('minutos').value),
    horas_trabajadas: asNumber($('minutos').value) / 60,
    observaciones: text($('observaciones').value),
    creado_en: previous?.creado_en || new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
    origen: 'WEB',
    estado: 'REGISTRADO'
  };
}

function setPoscosechaEditMode(active) {
  const submitBtn = $('posForm')?.querySelector('button[type="submit"]');
  const heading = $('posForm')?.querySelector('.section-heading h3');
  const cancelBtn = $('cancelEditPoscosecha');

  if (submitBtn) submitBtn.textContent = active ? 'Actualizar poscosecha' : 'Guardar poscosecha';
  if (heading) heading.textContent = active ? 'Editar procesamiento' : 'Nuevo procesamiento';
  if (cancelBtn) cancelBtn.hidden = !active;
}

function clearPoscosechaForm() {
  editingPoscosechaId = '';
  $('posForm').reset();
  $('fecha').value = todayISO();
  updatePoscosechaWeek();
  updateTotalPoscosecha();
  setPoscosechaEditMode(false);
}

function loadPoscosechaEditForm(row) {
  editingPoscosechaId = poscosechaId(row);
  $('fecha').value = text(row.fecha);
  $('semana').value = asNumber(row.semana) || isoWeekPoscosecha(row.fecha);
  $('variedad').value = normalizeVariety(row.variedad);
  $('responsable').value = text(row.responsable).toUpperCase();
  $('t70').value = row.tallos_70 || '';
  $('t60').value = row.tallos_60 || '';
  $('t55').value = row.tallos_55 || '';
  $('t50').value = row.tallos_50 || '';
  $('nacional').value = row.nacional || '';
  $('basura').value = row.basura || '';
  $('minutos').value = row.minutos_trabajados || '';
  $('observaciones').value = text(row.observaciones);
  updateTotalPoscosecha();
  setPoscosechaEditMode(true);
  $('posForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setStatus('Editando registro de poscosecha');
}

function setupEditCancelButton() {
  const submitBtn = $('posForm')?.querySelector('button[type="submit"]');
  if (!submitBtn || $('cancelEditPoscosecha')) return;
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.type = 'button';
  cancelBtn.id = 'cancelEditPoscosecha';
  cancelBtn.textContent = 'Cancelar edicion';
  cancelBtn.hidden = true;
  submitBtn.parentElement.insertBefore(cancelBtn, submitBtn);
  cancelBtn.addEventListener('click', () => {
    clearPoscosechaForm();
    setStatus(`Poscosecha - ${dedupePoscosecha(poscosechaRows).length} registros`);
  });
}

async function initPoscosecha() {
  try {
    poscosechaRows = await loadSheet(ALTITUD.sheets.poscosecha);
    if (!normalizeProcessed(poscosechaRows).length) poscosechaRows = await loadSheet(ALTITUD.sheets.datosWeb);
  } catch (err) {
    poscosechaRows = localDataRows('datos_web');
  }

  renderPoscosecha(poscosechaRows);
  setStatus(`Poscosecha - ${dedupePoscosecha(poscosechaRows).length} registros`);
  setupPoscosechaForm();
  setupEditCancelButton();

  $('poscosechaBody')?.addEventListener('click', async e => {
    const editButton = e.target.closest('[data-edit-poscosecha]');
    if (editButton) {
      const id = editButton.dataset.editPoscosecha;
      const row = dedupePoscosecha(poscosechaRows).find(item => poscosechaId(item) === id);
      if (row) loadPoscosechaEditForm(row);
      return;
    }

    const deleteButton = e.target.closest('[data-delete-poscosecha]');
    if (!deleteButton) return;
    const id = deleteButton.dataset.deletePoscosecha;
    if (!confirm('Eliminar este registro de poscosecha?')) return;

    poscosechaRows = poscosechaRows.filter(row => poscosechaId(row) !== id);
    if (editingPoscosechaId === id) clearPoscosechaForm();
    renderPoscosecha(poscosechaRows);
    setStatus('Eliminando registro...');

    try {
      await deleteSheetRecord(ALTITUD.sheets.poscosecha, 'id_poscosecha', id);
      setStatus('Registro eliminado de poscosecha y rendimiento');
    } catch (err) {
      setStatus('Registro eliminado en pantalla; no se pudo conectar con Sheets');
    }
  });

  $('posForm').addEventListener('submit', async e => {
    e.preventDefault();
    const wasEditing = !!editingPoscosechaId;
    const record = buildPoscosechaRecord();

    poscosechaRows = wasEditing
      ? poscosechaRows.map(row => poscosechaId(row) === editingPoscosechaId ? record : row)
      : [record, ...poscosechaRows];

    renderPoscosecha(poscosechaRows);

    try {
      await submitRecord(ALTITUD.sheets.poscosecha, record);
      setStatus(wasEditing
        ? 'Poscosecha actualizada y rendimiento recalculado'
        : 'Poscosecha guardada y rendimiento actualizado automaticamente');
    } catch (err) {
      setStatus(wasEditing
        ? 'Poscosecha actualizada en pantalla; no se pudo sincronizar con Sheets'
        : 'Poscosecha registrada en pantalla; no se pudo sincronizar con Sheets');
    }

    clearPoscosechaForm();
  });
}

document.addEventListener('DOMContentLoaded', initPoscosecha);

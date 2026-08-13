function clientKey() {
  return 'altitudClientes';
}

function loadClients() {
  try {
    return JSON.parse(localStorage.getItem(clientKey()) || '[]');
  } catch (err) {
    return [];
  }
}

function saveClients(rows) {
  localStorage.setItem(clientKey(), JSON.stringify(rows));
}

function normalizeCliente(row) {
  return {
    id_cliente: text(row.id_cliente || row.A),
    cliente: text(row.cliente || row.Cliente || row.A),
    contacto: text(row.contacto || row.Contacto || row.B),
    telefono: text(row.telefono || row.Telefono || row.C),
    email: text(row.email || row.Email || row.D),
    pais: text(row.pais || row.Pais || row.E),
    ciudad: text(row.ciudad || row.Ciudad || row.F),
    estado: text(row.estado || row.Estado || row.H || 'ACTIVO').toUpperCase(),
    condicion_pago: text(row.condicion_pago || row.condicion || row.Pago || row.I),
    observaciones: text(row.observaciones || row.Observaciones || row.J),
    creado_en: text(row.creado_en || row.K),
    origen: text(row.origen || 'CLIENTES')
  };
}

function validClientes(rows) {
  return (rows || [])
    .map(normalizeCliente)
    .filter(row => row.cliente && row.cliente.toLowerCase() !== 'cliente');
}

function clientesDesdeVentas(rows) {
  const map = new Map();
  normalizeSales(rows || []).forEach(row => {
    if (!row.cliente) return;
    const key = row.cliente.toUpperCase();
    if (!map.has(key)) {
      map.set(key, {
        id_cliente: `AUTO-${key}`,
        cliente: row.cliente,
        estado: 'ACTIVO',
        observaciones: 'Cliente detectado desde ventas',
        creado_en: text(row.creado_en || row.fecha),
        origen: 'VENTAS'
      });
    }
  });
  return Array.from(map.values());
}

function clientesDesdeEstadoCuenta(rows) {
  const map = new Map();
  (rows || []).forEach(row => {
    const cliente = text(row.cliente);
    if (!cliente) return;
    const key = cliente.toUpperCase();
    if (!map.has(key)) {
      map.set(key, {
        id_cliente: `EC-${key}`,
        cliente,
        estado: 'ACTIVO',
        observaciones: 'Cliente detectado desde estado de cuenta',
        creado_en: text(row.fecha_registro || row.fecha),
        origen: 'ESTADO_CUENTA'
      });
    }
  });
  return Array.from(map.values());
}

function mergeClientes(...groups) {
  const map = new Map();
  groups.flat().forEach(item => {
    const row = normalizeCliente(item);
    if (!row.cliente) return;
    const key = row.cliente.toUpperCase();
    const previous = map.get(key) || {};
    map.set(key, {
      ...row,
      ...previous,
      cliente: previous.cliente || row.cliente,
      contacto: previous.contacto || row.contacto,
      telefono: previous.telefono || row.telefono,
      email: previous.email || row.email,
      pais: previous.pais || row.pais,
      ciudad: previous.ciudad || row.ciudad,
      estado: previous.estado || row.estado || 'ACTIVO',
      condicion_pago: previous.condicion_pago || row.condicion_pago,
      observaciones: previous.observaciones || row.observaciones,
      origen: [previous.origen, row.origen].filter(Boolean).join(' + ')
    });
  });
  return Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
}

function renderClientes(rows) {
  rows = validClientes(rows);
  $('kClientes').textContent = fmtInt(rows.length);
  $('kActivos').textContent = fmtInt(rows.filter(row => row.estado !== 'INACTIVO').length);
  renderRows($('clientesBody'), rows, [
    row => row.cliente,
    row => row.contacto || '-',
    row => row.telefono || '-',
    row => row.email || '-',
    row => row.pais || '-',
    row => row.estado || 'ACTIVO',
    row => row.condicion_pago || '-'
  ]);
}

async function initClientes() {
  let rows = loadClients();
  try {
    const [clientesSheet, ventasSheet, estadoCuentaSheet] = await Promise.all([
      loadSheet(ALTITUD.sheets.clientes).catch(() => []),
      loadSheet(ALTITUD.sheets.ventas).catch(() => []),
      loadSheet(ALTITUD.sheets.estadoCuenta).catch(() => [])
    ]);
    rows = mergeClientes(
      clientesDesdeVentas(ventasSheet),
      clientesDesdeEstadoCuenta(estadoCuentaSheet),
      validClientes(clientesSheet),
      rows
    );
  } catch (err) {
    rows = mergeClientes(rows);
  }

  renderClientes(rows);
  setStatus(`Clientes - ${validClientes(rows).length} registros sincronizados`);

  $('clienteForm').addEventListener('submit', async event => {
    event.preventDefault();
    const record = {
      id_cliente: `C-${Date.now()}`,
      cliente: text($('cliente').value),
      contacto: text($('contacto').value),
      telefono: text($('telefono').value),
      email: text($('email').value),
      pais: text($('pais').value),
      ciudad: text($('ciudad').value),
      estado: 'ACTIVO',
      condicion_pago: text($('condicion').value),
      observaciones: text($('observaciones').value),
      creado_en: new Date().toISOString(),
      origen: 'WEB'
    };

    rows = mergeClientes(rows, [record]);
    saveClients([...loadClients(), record]);
    renderClientes(rows);

    try {
      await submitRecord(ALTITUD.sheets.clientes, record);
      setStatus('Cliente guardado en Sheets');
    } catch (err) {
      setStatus('Cliente guardado localmente; falta Apps Script');
    }
  });
}

document.addEventListener('DOMContentLoaded', initClientes);

/**
 * Depura el selector "Despachos incluidos en la factura".
 *
 * Los despachos anteriores al traspaso ya estaban facturados en el Excel
 * (facturas 2 a 92), pero en la hoja de ventas nunca quedo constancia: sin
 * numero de factura ni estado_facturacion, el selector los sigue ofreciendo
 * como pendientes. Son 65 lineas por $13.151,20 que estorban cada vez que se
 * emite una factura nueva.
 *
 * Solo escribe la columna estado_facturacion. No toca importes, ni cantidades,
 * ni el vinculo con cuarto frio. Y es reversible: revertirDespachosHistoricos()
 * los devuelve a PENDIENTE.
 *
 * El corte es la fecha de la ultima factura del Excel. Los despachos
 * posteriores siguen apareciendo, porque esos si estan sin facturar.
 *
 *   1. revisarDespachosHistoricos()                - informa, no escribe
 *   2. marcarDespachosHistoricosComoFacturados()   - aplica
 *   3. revertirDespachosHistoricos()               - deshace, si hiciera falta
 */

const CORTE_FACTURACION_HISTORICA = '2026-09-23';

function revisarDespachosHistoricos() {
  depurarDespachos_(false);
}

function marcarDespachosHistoricosComoFacturados() {
  depurarDespachos_(true);
}

function depurarDespachos_(aplicar) {
  const plan = planDespachos_();
  Logger.log('Corte: %s (ultima factura del Excel)', CORTE_FACTURACION_HISTORICA);
  Logger.log('Despachos sin facturar en la hoja: %s', plan.pendientes.length);
  Logger.log('  hasta el corte, ya facturados en el Excel: %s  ($%s)',
    plan.aMarcar.length, plan.montoAMarcar.toFixed(2));
  Logger.log('  posteriores al corte, se dejan pendientes: %s  ($%s)',
    plan.posteriores.length, plan.montoPosterior.toFixed(2));
  plan.posteriores.forEach(function(d) {
    Logger.log('    se conserva: %s  %s  %s %s  $%s', d.fecha, d.cliente, d.variedad, d.medida, d.valor.toFixed(2));
  });

  if (!aplicar) { Logger.log('Simulacion: no se escribio nada.'); return; }
  if (!plan.aMarcar.length) { Logger.log('No hay nada que marcar.'); return; }

  escribirEstadoFacturacion_(plan.hoja, plan.columna, plan.aMarcar, 'FACTURADO');
  Logger.log('Listo. %s despachos marcados como FACTURADO. El selector queda con %s.',
    plan.aMarcar.length, plan.posteriores.length);
}

function revertirDespachosHistoricos() {
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('VENTAS_VENDEDORES');
  const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });
  const colEstado = encabezados.indexOf('estado_facturacion') + 1;
  const colFactura = encabezados.indexOf('numero_factura') + 1;
  const colFecha = encabezados.indexOf('fecha') + 1;
  if (!colEstado) throw new Error('La hoja no tiene la columna estado_facturacion');

  const n = hoja.getLastRow() - 1;
  const estados = hoja.getRange(2, colEstado, n, 1).getValues();
  const facturas = colFactura ? hoja.getRange(2, colFactura, n, 1).getValues() : null;
  const fechas = hoja.getRange(2, colFecha, n, 1).getValues();

  const filas = [];
  for (let i = 0; i < n; i++) {
    const tieneFactura = facturas && String(facturas[i][0] || '').trim();
    const esHistorico = fechaISO_(fechas[i][0]) <= CORTE_FACTURACION_HISTORICA;
    if (!tieneFactura && esHistorico && String(estados[i][0] || '').toUpperCase() === 'FACTURADO') {
      filas.push(i + 2);
    }
  }
  escribirEstadoFacturacion_(hoja, colEstado, filas.map(function(f) { return { fila: f }; }), 'PENDIENTE');
  Logger.log('Revertidos %s despachos a PENDIENTE.', filas.length);
}

function planDespachos_() {
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('VENTAS_VENDEDORES');
  if (!hoja) throw new Error('No existe la hoja VENTAS_VENDEDORES');
  const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });
  const columna = encabezados.indexOf('estado_facturacion') + 1;
  if (!columna) throw new Error('La hoja no tiene la columna estado_facturacion');

  const idx = function(nombre) { return encabezados.indexOf(nombre); };
  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn()).getValues();

  const pendientes = [];
  datos.forEach(function(fila, i) {
    const estadoVenta = String(fila[idx('estado')] || '').toUpperCase();
    if (estadoVenta === 'ANULADO' || estadoVenta === 'ELIMINADO') return;
    if (String(fila[idx('numero_factura')] || '').trim()) return;
    if (String(fila[idx('estado_facturacion')] || '').toUpperCase() === 'FACTURADO') return;
    pendientes.push({
      fila: i + 2,
      fecha: fechaISO_(fila[idx('fecha')]),
      cliente: String(fila[idx('cliente')] || ''),
      variedad: String(fila[idx('variedad')] || ''),
      medida: String(fila[idx('medida_cm')] || ''),
      valor: Number(fila[idx('total_venta')]) || 0
    });
  });

  const aMarcar = pendientes.filter(function(d) { return d.fecha && d.fecha <= CORTE_FACTURACION_HISTORICA; });
  const posteriores = pendientes.filter(function(d) { return !d.fecha || d.fecha > CORTE_FACTURACION_HISTORICA; });
  const suma = function(lista) { return lista.reduce(function(t, d) { return t + d.valor; }, 0); };

  return {
    hoja: hoja, columna: columna, pendientes: pendientes,
    aMarcar: aMarcar, posteriores: posteriores,
    montoAMarcar: suma(aMarcar), montoPosterior: suma(posteriores)
  };
}

function escribirEstadoFacturacion_(hoja, columna, despachos, valor) {
  despachos.forEach(function(d) { hoja.getRange(d.fila, columna).setValue(valor); });
  SpreadsheetApp.flush();
}

function fechaISO_(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, 'GMT-5', 'yyyy-MM-dd');
  return String(valor || '').trim().slice(0, 10);
}

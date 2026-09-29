/**
 * Limpieza de encabezados repetidos. Se corre a mano desde el editor de Apps
 * Script, una sola vez por hoja afectada. No lo llama nadie automaticamente.
 *
 * Por que existe: getSheet_ leia solo las primeras columnas del encabezado, asi
 * que no veia las que quedaban mas a la derecha y las volvia a agregar en cada
 * llamada. ESTADO_CUENTA acumulo asi 28 columnas repetidas. El defecto ya esta
 * corregido en apps-script-ventas-vendedores.gs; esto limpia lo que dejo.
 *
 * Solo borra una columna cuando se cumplen LAS DOS condiciones:
 *   1. su nombre ya aparecia antes en la fila 1, y
 *   2. no tiene ni un dato en ninguna fila.
 * Una columna repetida que tenga datos se deja y se reporta, para revisarla a
 * mano. Correrlo dos veces no hace dano: la segunda vez no encuentra nada.
 */

function revisarEncabezadosEstadoCuenta() {
  reportarEncabezados_('ESTADO_CUENTA');
}

function limpiarEncabezadosEstadoCuenta() {
  limpiarEncabezados_('ESTADO_CUENTA');
}

function reportarEncabezados_(sheetName) {
  const plan = planDeLimpieza_(sheetName);
  Logger.log('Hoja %s: %s columnas, %s filas de datos', sheetName, plan.total, plan.filas);
  if (plan.borrar.length) {
    Logger.log('Se borrarian %s columnas repetidas y vacias:', plan.borrar.length);
    plan.borrar.forEach(function(col) {
      Logger.log('  columna %s  "%s"  (repite la columna %s)', col.indice, col.nombre, col.original);
    });
  } else {
    Logger.log('No hay columnas repetidas y vacias. Nada que borrar.');
  }
  if (plan.conservar.length) {
    Logger.log('OJO - repetidas pero CON datos, no se tocan, revisalas a mano:');
    plan.conservar.forEach(function(col) {
      Logger.log('  columna %s  "%s"  (%s celdas con dato)', col.indice, col.nombre, col.llenas);
    });
  }
  return plan;
}

function limpiarEncabezados_(sheetName) {
  const plan = reportarEncabezados_(sheetName);
  if (!plan.borrar.length) return;

  // De derecha a izquierda: borrar una columna corre las de su derecha.
  plan.borrar
    .slice()
    .sort(function(a, b) { return b.indice - a.indice; })
    .forEach(function(col) { plan.hoja.deleteColumn(col.indice); });

  SpreadsheetApp.flush();
  Logger.log('Listo. %s columnas borradas. La hoja queda con %s.',
    plan.borrar.length, plan.hoja.getLastColumn());
}

function planDeLimpieza_(sheetName) {
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!hoja) throw new Error('No existe la hoja ' + sheetName);

  const totalColumnas = hoja.getLastColumn();
  const totalFilas = hoja.getLastRow();
  const encabezados = hoja.getRange(1, 1, 1, totalColumnas).getValues()[0]
    .map(function(valor) { return String(valor || '').trim(); });
  const datos = totalFilas > 1
    ? hoja.getRange(2, 1, totalFilas - 1, totalColumnas).getValues()
    : [];

  const vistos = {};
  const borrar = [];
  const conservar = [];

  encabezados.forEach(function(nombre, i) {
    if (!nombre) return;
    if (!(nombre in vistos)) {
      vistos[nombre] = i + 1;
      return;
    }
    const llenas = datos.reduce(function(cuenta, fila) {
      return cuenta + (String(fila[i] === null || fila[i] === undefined ? '' : fila[i]).trim() ? 1 : 0);
    }, 0);
    const col = { indice: i + 1, nombre: nombre, original: vistos[nombre], llenas: llenas };
    if (llenas === 0) borrar.push(col);
    else conservar.push(col);
  });

  return {
    hoja: hoja,
    total: totalColumnas,
    filas: Math.max(0, totalFilas - 1),
    borrar: borrar,
    conservar: conservar
  };
}

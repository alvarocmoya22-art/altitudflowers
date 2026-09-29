/**
 * Migracion de un solo uso: pasa los 67 registros viejos de ESTADO_CUENTA al
 * esquema que lee el dashboard. Se corre a mano desde el editor. No lo llama
 * nadie automaticamente.
 *
 * La hoja arrastraba el esquema anterior (factura, fecha_emision, saldo,
 * observaciones) mientras el dashboard lee numero_factura, fecha,
 * saldo_pendiente y observacion, que estaban vacias. Por eso el estado de
 * cuenta mostraba importes pero ni el numero de factura ni el saldo.
 *
 * ruc_cedula, nota_credito y dias_vencido se conservan: ya forman parte del
 * esquema en HEADERS_BY_SHEET.
 *
 * Orden de uso:
 *   1. revisarMigracionEstadoCuenta()   - informa, no toca nada
 *   2. migrarEstadoCuenta()             - copia los valores (saca respaldo antes)
 *   3. revisar la hoja a ojo
 *   4. eliminarColumnasViejasEstadoCuenta() - borra las 4 columnas de origen,
 *      y solo si su contenido coincide celda por celda con el destino
 *
 * Es idempotente: correrlo dos veces no duplica ni pisa nada distinto.
 */

const MAPEO_ESTADO_CUENTA = [
  ['factura', 'numero_factura'],
  ['fecha_emision', 'fecha'],
  ['saldo', 'saldo_pendiente'],
  ['observaciones', 'observacion']
];

function revisarMigracionEstadoCuenta() {
  migracionEstadoCuenta_(false);
}

function migrarEstadoCuenta() {
  migracionEstadoCuenta_(true);
}

function migracionEstadoCuenta_(ejecutar) {
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ESTADO_CUENTA');
  if (!hoja) throw new Error('No existe la hoja ESTADO_CUENTA');

  const totalFilas = hoja.getLastRow();
  const totalColumnas = hoja.getLastColumn();
  if (totalFilas < 2) { Logger.log('No hay filas que migrar.'); return; }

  const encabezados = hoja.getRange(1, 1, 1, totalColumnas).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });
  const col = function(nombre) { return encabezados.indexOf(nombre); };

  const faltantes = MAPEO_ESTADO_CUENTA
    .map(function(par) { return par[1]; })
    .concat(['id_movimiento', 'valor_pagado', 'estado', 'tipo_movimiento', 'valor_factura', 'nota_credito'])
    .filter(function(nombre) { return col(nombre) === -1; });
  if (faltantes.length) throw new Error('Faltan columnas en la hoja: ' + faltantes.join(', '));

  const datos = hoja.getRange(2, 1, totalFilas - 1, totalColumnas).getValues();
  const vacio = function(v) { return v === null || v === undefined || String(v).trim() === ''; };

  let copiados = 0, ids = 0, estados = 0, pagados = 0;
  const avisos = [];

  datos.forEach(function(fila, i) {
    const numeroFila = i + 2;

    MAPEO_ESTADO_CUENTA.forEach(function(par) {
      const origen = col(par[0]), destino = col(par[1]);
      if (origen === -1) return;
      if (!vacio(fila[origen]) && vacio(fila[destino])) { fila[destino] = fila[origen]; copiados++; }
    });

    if (vacio(fila[col('id_movimiento')])) {
      fila[col('id_movimiento')] = 'MOV-' + ('0000' + numeroFila).slice(-4);
      ids++;
    }

    if (vacio(fila[col('tipo_movimiento')])) fila[col('tipo_movimiento')] = 'FACTURA';

    const estado = String(fila[col('estado')] || '').trim().toUpperCase();
    if (estado === 'POR COBRAR') { fila[col('estado')] = 'PENDIENTE'; estados++; }

    if (vacio(fila[col('valor_pagado')])) {
      const valor = Number(fila[col('valor_factura')]) || 0;
      const nota = Number(fila[col('nota_credito')]) || 0;
      const saldo = Number(fila[col('saldo_pendiente')]) || 0;
      const cobrado = Math.round((valor - nota - saldo) * 100) / 100;
      if (cobrado < 0) {
        avisos.push('fila ' + numeroFila + ': valor_pagado daria ' + cobrado +
          ' (valor ' + valor + ' - nota ' + nota + ' - saldo ' + saldo + '). Se deja vacia.');
      } else {
        fila[col('valor_pagado')] = cobrado;
        pagados++;
      }
    }

    if (vacio(fila[col('cliente')])) {
      avisos.push('fila ' + numeroFila + ': sin cliente, saldo ' + (fila[col('saldo_pendiente')] || 0));
    }
    const fecha = fila[col('fecha')];
    if (fecha instanceof Date && fecha > new Date()) {
      avisos.push('fila ' + numeroFila + ': fecha ' + Utilities.formatDate(fecha, 'GMT-5', 'yyyy-MM-dd') + ' es futura');
    } else if (!vacio(fecha) && !(fecha instanceof Date)) {
      avisos.push('fila ' + numeroFila + ': fecha "' + fecha + '" no es una fecha');
    }
  });

  Logger.log('Valores a copiar: %s | ids a generar: %s | estados a normalizar: %s | valor_pagado a calcular: %s',
    copiados, ids, estados, pagados);
  if (avisos.length) {
    Logger.log('Revisar a mano (%s):', avisos.length);
    avisos.forEach(function(a) { Logger.log('  ' + a); });
  }

  if (!ejecutar) { Logger.log('Simulacion: no se escribio nada. Corre migrarEstadoCuenta() para aplicarlo.'); return; }

  const respaldo = 'ESTADO_CUENTA_RESPALDO_' +
    Utilities.formatDate(new Date(), 'GMT-5', 'yyyyMMdd_HHmmss');
  hoja.copyTo(SpreadsheetApp.openById(SPREADSHEET_ID)).setName(respaldo);
  Logger.log('Respaldo creado: %s', respaldo);

  hoja.getRange(2, 1, datos.length, totalColumnas).setValues(datos);
  SpreadsheetApp.flush();
  Logger.log('Migracion aplicada sobre %s filas.', datos.length);
}

function eliminarColumnasViejasEstadoCuenta() {
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ESTADO_CUENTA');
  const totalFilas = hoja.getLastRow(), totalColumnas = hoja.getLastColumn();
  const encabezados = hoja.getRange(1, 1, 1, totalColumnas).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });
  const datos = hoja.getRange(2, 1, totalFilas - 1, totalColumnas).getValues();

  const borrables = [];
  MAPEO_ESTADO_CUENTA.forEach(function(par) {
    const origen = encabezados.indexOf(par[0]), destino = encabezados.indexOf(par[1]);
    if (origen === -1) return;
    if (destino === -1) { Logger.log('No existe el destino %s, no se toca %s.', par[1], par[0]); return; }
    const distintas = datos.filter(function(fila) {
      return String(fila[origen] === null || fila[origen] === undefined ? '' : fila[origen]).trim() !== '' &&
        String(fila[origen]).trim() !== String(fila[destino] === null || fila[destino] === undefined ? '' : fila[destino]).trim();
    }).length;
    if (distintas) Logger.log('NO borro "%s": %s filas no coinciden con "%s". Migra primero.', par[0], distintas, par[1]);
    else borrables.push({ indice: origen + 1, nombre: par[0] });
  });

  if (!borrables.length) { Logger.log('No hay columnas viejas que borrar.'); return; }
  borrables.forEach(function(c) { Logger.log('Se borra "%s" (columna %s), ya copiada.', c.nombre, c.indice); });
  borrables.sort(function(a, b) { return b.indice - a.indice; })
    .forEach(function(c) { hoja.deleteColumn(c.indice); });
  SpreadsheetApp.flush();
  Logger.log('Listo. La hoja queda con %s columnas.', hoja.getLastColumn());
}

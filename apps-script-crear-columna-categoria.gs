/**
 * Un solo uso. Crea la columna "categoria" en POSCOSECHA y CONTROL_CALIDAD
 * sin agregar ninguna fila de datos, y deja escrito en el registro de
 * ejecucion que encabezados quedaron en cada hoja.
 *
 * Como usarlo:
 *   1. En el proyecto de Apps Script: Archivos -> + -> Script
 *   2. Nombre del archivo: categoria
 *   3. Pegar este contenido y guardar
 *   4. En el selector de funciones elegir crearColumnaCategoria y Ejecutar
 *
 * Usa SPREADSHEET_ID y getSheet_ que ya viven en Codigo.gs, por eso este
 * archivo no declara ninguna constante propia (no hay riesgo de duplicados).
 */
function crearColumnaCategoria() {
  ['POSCOSECHA', 'CONTROL_CALIDAD'].forEach(function (nombre) {
    const headers = HEADERS_BY_SHEET[nombre];
    const loPideElCodigo = headers.indexOf('categoria') >= 0;
    const sheet = getSheet_(nombre, headers);
    const actuales = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h || '').trim(); })
      .filter(function (h) { return h; });
    Logger.log(nombre
      + ' | el codigo pide categoria: ' + (loPideElCodigo ? 'SI' : 'NO')
      + ' | columnas en la hoja: ' + actuales.length
      + ' | categoria en la hoja: ' + (actuales.indexOf('categoria') >= 0 ? 'SI' : 'NO'));
    Logger.log(nombre + ' encabezados: ' + actuales.join(', '));
  });
}

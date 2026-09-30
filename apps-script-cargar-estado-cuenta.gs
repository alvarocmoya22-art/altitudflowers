/**
 * Carga de un solo uso: reemplaza ESTADO_CUENTA con las facturas del archivo
 * "ESTADO DE CUENTA.xlsx" que entrego Alvaro el 30/09/2026. Se corre a mano.
 *
 * El Excel intercala subtotales por mes (filas NOVIEMBRE, DICIEMBRE...). Esos
 * NO son movimientos y no se cargan: cuando llegaron a la hoja se contaron
 * como facturas sin cliente e inflaron la cartera al doble.
 *
 * Las anuladas se conservan con estado ANULADA en vez de borrarse.
 * "LA CASTELLANA" y "FLORES LA CASTELLANA" quedan con un solo nombre.
 * Saldo y cobrado salen de valor - nota de credito segun el estado.
 *
 *   1. revisarCargaEstadoCuenta()  - informa totales, no escribe
 *   2. cargarEstadoCuenta()        - respalda, limpia y escribe
 */

const CARGA_ESTADO_CUENTA = [
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2025-11-30", "id_movimiento": "MOV-0001", "nota_credito": 0.0, "numero_factura": "2", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1328.4, "valor_pagado": 1328.4},
  {"cliente": "FLORES LA CASTELLANA", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0002", "nota_credito": 0.0, "numero_factura": "3", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-17", "id_movimiento": "MOV-0003", "nota_credito": 0.0, "numero_factura": "4", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 95.0, "valor_pagado": 95.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-17", "id_movimiento": "MOV-0004", "nota_credito": 0.0, "numero_factura": "5", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 562.4, "valor_pagado": 562.4},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-17", "id_movimiento": "MOV-0005", "nota_credito": 0.0, "numero_factura": "6", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 240.0, "valor_pagado": 240.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-17", "id_movimiento": "MOV-0006", "nota_credito": 0.0, "numero_factura": "7", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 522.5, "valor_pagado": 522.5},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-17", "id_movimiento": "MOV-0007", "nota_credito": 0.0, "numero_factura": "8", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 562.5, "valor_pagado": 562.5},
  {"cliente": "FLORES LA CASTELLANA", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0008", "nota_credito": 0.0, "numero_factura": "9", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0009", "nota_credito": 0.0, "numero_factura": "10", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0010", "nota_credito": 0.0, "numero_factura": "11", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0011", "nota_credito": 0.0, "numero_factura": "12", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-19", "id_movimiento": "MOV-0012", "nota_credito": 0.0, "numero_factura": "13", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 211.5, "valor_pagado": 211.5},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-19", "id_movimiento": "MOV-0013", "nota_credito": 0.0, "numero_factura": "14", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 234.0, "valor_pagado": 234.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-19", "id_movimiento": "MOV-0014", "nota_credito": 0.0, "numero_factura": "15", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1442.2, "valor_pagado": 1442.2},
  {"cliente": "FLORES LA CASTELLANA", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0015", "nota_credito": 0.0, "numero_factura": "16", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-18", "id_movimiento": "MOV-0016", "nota_credito": 0.0, "numero_factura": "17", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 246.0, "valor_pagado": 246.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-19", "id_movimiento": "MOV-0017", "nota_credito": 0.0, "numero_factura": "18", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 73.8, "valor_pagado": 73.8},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-12-26", "id_movimiento": "MOV-0018", "nota_credito": 1002.75, "numero_factura": "19", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 784.8, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-01-12", "id_movimiento": "MOV-0019", "nota_credito": 0.0, "numero_factura": "20", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 544.0, "valor_pagado": 544.0},
  {"cliente": "MEGAFLOR", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0020", "nota_credito": 0.0, "numero_factura": "21", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "MEGAFLOR", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0021", "nota_credito": 0.0, "numero_factura": "22", "observacion": "", "ruc_cedula": "1891782566001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-01-15", "id_movimiento": "MOV-0022", "nota_credito": 0.0, "numero_factura": "23", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 228.0, "valor_pagado": 228.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-01-16", "id_movimiento": "MOV-0023", "nota_credito": 0.0, "numero_factura": "24", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 380.0, "valor_pagado": 380.0},
  {"cliente": "MEGAFLOR", "estado": "PAGADO", "fecha": "2026-01-16", "id_movimiento": "MOV-0024", "nota_credito": 0.0, "numero_factura": "25", "observacion": "Pagado el 27-02 con transferencia", "ruc_cedula": "1891782566001", "saldo_pendiente": 0.0, "valor_factura": 810.0, "valor_pagado": 810.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-01-20", "id_movimiento": "MOV-0025", "nota_credito": 0.0, "numero_factura": "26", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 787.5, "valor_pagado": 787.5},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-01-21", "id_movimiento": "MOV-0026", "nota_credito": 0.0, "numero_factura": "27", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 379.4, "valor_pagado": 379.4},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-01-24", "id_movimiento": "MOV-0027", "nota_credito": 0.0, "numero_factura": "28", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1118.1, "valor_pagado": 1118.1},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-01-27", "id_movimiento": "MOV-0028", "nota_credito": 0.0, "numero_factura": "29", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 705.2, "valor_pagado": 705.2},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-01-27", "id_movimiento": "MOV-0029", "nota_credito": 281.6, "numero_factura": "30", "observacion": "Abona 3000 el 26-03. Abona 1000 el 02-04", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 99.2, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "", "id_movimiento": "MOV-0030", "nota_credito": 0.0, "numero_factura": "31", "observacion": "Fecha en el Excel: 28 - 01", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 457.6, "valor_pagado": 457.6},
  {"cliente": "FLORES LA CASTELLANA", "estado": "ANULADA", "fecha": "", "id_movimiento": "MOV-0031", "nota_credito": 0.0, "numero_factura": "32", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 0.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-05", "id_movimiento": "MOV-0032", "nota_credito": 0.0, "numero_factura": "33", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 226.0, "valor_pagado": 226.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-05", "id_movimiento": "MOV-0033", "nota_credito": 0.0, "numero_factura": "34", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 734.2, "valor_pagado": 734.2},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-10", "id_movimiento": "MOV-0034", "nota_credito": 77.44, "numero_factura": "35", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 194.56, "valor_pagado": 117.12},
  {"cliente": "MEGAFLOR", "estado": "PAGADO", "fecha": "2026-02-10", "id_movimiento": "MOV-0035", "nota_credito": 0.0, "numero_factura": "36", "observacion": "", "ruc_cedula": "1891782566001", "saldo_pendiente": 0.0, "valor_factura": 180.0, "valor_pagado": 180.0},
  {"cliente": "MEGAFLOR", "estado": "PAGADO", "fecha": "2026-02-10", "id_movimiento": "MOV-0036", "nota_credito": 0.0, "numero_factura": "37", "observacion": "", "ruc_cedula": "1891782566001", "saldo_pendiente": 0.0, "valor_factura": 180.0, "valor_pagado": 180.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-13", "id_movimiento": "MOV-0037", "nota_credito": 0.0, "numero_factura": "38", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 162.0, "valor_pagado": 162.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-19", "id_movimiento": "MOV-0038", "nota_credito": 0.0, "numero_factura": "39", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 570.0, "valor_pagado": 570.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-19", "id_movimiento": "MOV-0039", "nota_credito": 0.0, "numero_factura": "40", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 854.6, "valor_pagado": 854.6},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-23", "id_movimiento": "MOV-0040", "nota_credito": 0.0, "numero_factura": "43", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1005.4, "valor_pagado": 1005.4},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-23", "id_movimiento": "MOV-0041", "nota_credito": 70.44, "numero_factura": "44", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 147.16, "valor_pagado": 76.72},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-02-23", "id_movimiento": "MOV-0042", "nota_credito": 0.0, "numero_factura": "45", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 105.0, "valor_pagado": 105.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-03-31", "id_movimiento": "MOV-0043", "nota_credito": 0.0, "numero_factura": "46", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 26.6, "valor_pagado": 26.6},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-03-31", "id_movimiento": "MOV-0044", "nota_credito": 0.0, "numero_factura": "47", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 191.0, "valor_pagado": 191.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-03", "id_movimiento": "MOV-0045", "nota_credito": 0.0, "numero_factura": "48", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 373.4, "valor_pagado": 373.4},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-06", "id_movimiento": "MOV-0046", "nota_credito": 0.0, "numero_factura": "49", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 366.8, "valor_pagado": 366.8},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-06", "id_movimiento": "MOV-0047", "nota_credito": 0.0, "numero_factura": "50", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 183.8, "valor_pagado": 183.8},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-10", "id_movimiento": "MOV-0048", "nota_credito": 0.0, "numero_factura": "51", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 528.6, "valor_pagado": 528.6},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-14", "id_movimiento": "MOV-0049", "nota_credito": 0.0, "numero_factura": "52", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 59.8, "valor_pagado": 59.8},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-17", "id_movimiento": "MOV-0050", "nota_credito": 0.0, "numero_factura": "53", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 580.0, "valor_pagado": 580.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-20", "id_movimiento": "MOV-0051", "nota_credito": 0.0, "numero_factura": "54", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 978.9, "valor_pagado": 978.9},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-20", "id_movimiento": "MOV-0052", "nota_credito": 0.0, "numero_factura": "55", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 656.3, "valor_pagado": 656.3},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-21", "id_movimiento": "MOV-0053", "nota_credito": 0.0, "numero_factura": "56", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 2901.5, "valor_pagado": 2901.5},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-21", "id_movimiento": "MOV-0054", "nota_credito": 0.0, "numero_factura": "57", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 240.0, "valor_pagado": 240.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-23", "id_movimiento": "MOV-0055", "nota_credito": 0.0, "numero_factura": "58", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1076.5, "valor_pagado": 1076.5},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-23", "id_movimiento": "MOV-0056", "nota_credito": 0.0, "numero_factura": "59", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1601.2, "valor_pagado": 1601.2},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-05-24", "id_movimiento": "MOV-0057", "nota_credito": 0.0, "numero_factura": "60", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 949.1, "valor_pagado": 949.1},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-27", "id_movimiento": "MOV-0058", "nota_credito": 0.0, "numero_factura": "62", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1086.25, "valor_pagado": 1086.25},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-04-29", "id_movimiento": "MOV-0059", "nota_credito": 0.0, "numero_factura": "63", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 216.0, "valor_pagado": 216.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-05-05", "id_movimiento": "MOV-0060", "nota_credito": 0.0, "numero_factura": "64", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 143.6, "valor_pagado": 143.6},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-05-11", "id_movimiento": "MOV-0061", "nota_credito": 0.0, "numero_factura": "65", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 300.8, "valor_pagado": 300.8},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-05-15", "id_movimiento": "MOV-0062", "nota_credito": 0.0, "numero_factura": "66", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 243.1, "valor_pagado": 243.1},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-05-26", "id_movimiento": "MOV-0063", "nota_credito": 0.0, "numero_factura": "67", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 150.4, "valor_pagado": 150.4},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-02", "id_movimiento": "MOV-0064", "nota_credito": 0.0, "numero_factura": "68", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 878.9, "valor_pagado": 878.9},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-03", "id_movimiento": "MOV-0065", "nota_credito": 0.0, "numero_factura": "69", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 568.5, "valor_pagado": 568.5},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-08", "id_movimiento": "MOV-0066", "nota_credito": 0.0, "numero_factura": "70", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 610.9, "valor_pagado": 610.9},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-08", "id_movimiento": "MOV-0067", "nota_credito": 0.0, "numero_factura": "72", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1412.4, "valor_pagado": 1412.4},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-15", "id_movimiento": "MOV-0068", "nota_credito": 0.0, "numero_factura": "74", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1004.0, "valor_pagado": 1004.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-19", "id_movimiento": "MOV-0069", "nota_credito": 0.0, "numero_factura": "75", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1520.5, "valor_pagado": 1520.5},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-26", "id_movimiento": "MOV-0070", "nota_credito": 0.0, "numero_factura": "77", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 1006.7, "valor_pagado": 1006.7},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-26", "id_movimiento": "MOV-0071", "nota_credito": 0.0, "numero_factura": "78", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 297.4, "valor_pagado": 297.4},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PAGADO", "fecha": "2026-06-29", "id_movimiento": "MOV-0072", "nota_credito": 0.0, "numero_factura": "79", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 0.0, "valor_factura": 944.9, "valor_pagado": 944.9},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-07-06", "id_movimiento": "MOV-0073", "nota_credito": 0.0, "numero_factura": "80", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 370.3, "valor_factura": 370.3, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-07-31", "id_movimiento": "MOV-0074", "nota_credito": 0.0, "numero_factura": "81", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 1541.1, "valor_factura": 1541.1, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-08-06", "id_movimiento": "MOV-0075", "nota_credito": 936.3, "numero_factura": "82", "observacion": "AUN FALTA QUE NOS EMITAN LA INFORMACION EXACTA DEL DESCARTE", "ruc_cedula": "1091796152001", "saldo_pendiente": 170.8, "valor_factura": 1107.1, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-08-16", "id_movimiento": "MOV-0076", "nota_credito": 461.3, "numero_factura": "83", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 1535.9, "valor_factura": 1997.2, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-08-16", "id_movimiento": "MOV-0077", "nota_credito": 0.0, "numero_factura": "84", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 1889.0, "valor_factura": 1889.0, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-08-28", "id_movimiento": "MOV-0078", "nota_credito": 0.0, "numero_factura": "86", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 627.9, "valor_factura": 627.9, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-09-01", "id_movimiento": "MOV-0079", "nota_credito": 0.0, "numero_factura": "87", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 139.2, "valor_factura": 139.2, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-09-06", "id_movimiento": "MOV-0080", "nota_credito": 0.0, "numero_factura": "88", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 608.2, "valor_factura": 608.2, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-09-09", "id_movimiento": "MOV-0081", "nota_credito": 0.0, "numero_factura": "89", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 61.2, "valor_factura": 61.2, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-09-11", "id_movimiento": "MOV-0082", "nota_credito": 0.0, "numero_factura": "90", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 553.4, "valor_factura": 553.4, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-09-17", "id_movimiento": "MOV-0083", "nota_credito": 0.0, "numero_factura": "91", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 285.5, "valor_factura": 285.5, "valor_pagado": 0.0},
  {"cliente": "FLORES LA CASTELLANA", "estado": "PENDIENTE", "fecha": "2026-09-23", "id_movimiento": "MOV-0084", "nota_credito": 0.0, "numero_factura": "92", "observacion": "", "ruc_cedula": "1091796152001", "saldo_pendiente": 147.9, "valor_factura": 147.9, "valor_pagado": 0.0}
];

function revisarCargaEstadoCuenta() {
  const t = totalesCarga_();
  Logger.log('Filas a cargar: %s', CARGA_ESTADO_CUENTA.length);
  Logger.log('  pagadas %s | pendientes %s | anuladas %s', t.pagadas, t.pendientes, t.anuladas);
  Logger.log('  valor total    %s', t.valor.toFixed(2));
  Logger.log('  notas credito  %s', t.notas.toFixed(2));
  Logger.log('  cobrado        %s', t.cobrado.toFixed(2));
  Logger.log('  POR COBRAR     %s', t.saldo.toFixed(2));
  const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ESTADO_CUENTA');
  Logger.log('La hoja actual tiene %s filas y se reemplazan todas.', Math.max(0, hoja.getLastRow() - 1));
}

function totalesCarga_() {
  return CARGA_ESTADO_CUENTA.reduce(function(t, f) {
    t.valor += f.valor_factura; t.notas += f.nota_credito;
    t.cobrado += f.valor_pagado; t.saldo += f.saldo_pendiente;
    if (f.estado === 'PAGADO') t.pagadas++;
    else if (f.estado === 'PENDIENTE') t.pendientes++;
    else t.anuladas++;
    return t;
  }, { valor: 0, notas: 0, cobrado: 0, saldo: 0, pagadas: 0, pendientes: 0, anuladas: 0 });
}

function cargarEstadoCuenta() {
  const libro = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = libro.getSheetByName('ESTADO_CUENTA');
  if (!hoja) throw new Error('No existe la hoja ESTADO_CUENTA');

  const respaldo = 'ESTADO_CUENTA_RESPALDO_' + Utilities.formatDate(new Date(), 'GMT-5', 'yyyyMMdd_HHmmss');
  hoja.copyTo(libro).setName(respaldo);
  Logger.log('Respaldo creado: %s', respaldo);

  const encabezados = HEADERS_BY_SHEET.ESTADO_CUENTA;
  const registrado = Utilities.formatDate(new Date(), 'GMT-5', 'yyyy-MM-dd');
  const filas = CARGA_ESTADO_CUENTA.map(function(f) {
    return encabezados.map(function(col) {
      if (col === 'concepto') return 'Ventas de flor';
      if (col === 'tipo_movimiento') return 'FACTURA';
      if (col === 'fecha_registro') return registrado;
      return f[col] === undefined ? '' : f[col];
    });
  });

  hoja.clear();
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);
  hoja.setFrozenRows(1);
  SpreadsheetApp.flush();

  const t = totalesCarga_();
  Logger.log('Listo. %s facturas cargadas. Por cobrar: %s', filas.length, t.saldo.toFixed(2));
}

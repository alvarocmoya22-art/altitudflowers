# Esquema recomendado para Google Sheets - Altitud Flowers

El dashboard debe usar un Google Sheets con pestañas separadas por proceso. Esto evita mezclar pedidos, producción y cartera en una sola tabla.

## Pestañas principales

### DATOS_WEB
Producción diaria o semanal. Es la hoja que ya lee el dashboard actual.

Campos:
`id_registro`, `fecha`, `semana`, `mes`, `mes_num`, `siembra`, `cama`, `variedad`, `tallos_solicitados`, `tallos_cosechados`, `tallos_70`, `tallos_60`, `tallos_55`, `tallos_50`, `nacional`, `basura`, `cumplimiento_pct`, `descarte_pct`, `ingreso_total`, `diferencia_tallos`, `estado_cumplimiento`, `estado_descarte`, `observaciones`

### PEDIDOS
Pedidos de clientes/cargueras.

Campos:
`id_pedido`, `fecha_pedido`, `fecha_entrega`, `cliente_carguera`, `tipo_caja`, `cantidad_cajas`, `color_variedad`, `medida_cm`, `follaje`, `bonches`, `tallos`, `transporte`, `entregado`, `factura`, `estado_pedido`, `observaciones`

### ESTADO_CUENTA
Facturación, cobros y saldos.

Campos:
`factura`, `cliente`, `ruc_cedula`, `fecha_emision`, `fecha_vencimiento`, `valor_factura`, `estado`, `nota_credito`, `saldo`, `dias_vencido`, `observaciones`

Estados sugeridos:
`PENDIENTE`, `PAGADO`, `VENCIDO`, `ANULADA`

### PROYECCION_COSECHA
Proyección de cosecha por semana.

Campos:
`semana`, `fecha_inicio`, `fecha_fin`, `mes`, `siembra`, `variedades`, `tallos_brutos`, `descarte_estimado`, `tallos_vendibles`, `observaciones`

### INVENTARIO
Flor disponible para venta o despacho.

Campos:
`fecha`, `color_variedad`, `medida_cm`, `follaje`, `bonches`, `tallos`, `ubicacion`, `estado`, `observaciones`

### NACIONAL
Ventas nacionales.

Campos:
`fecha`, `cliente`, `bonches`, `tallos`, `color_variedad`, `forma_pago`, `valor`, `estado_pago`, `observaciones`

### DESCARTES
Venta de descartes.

Campos:
`fecha`, `numero_tallos`, `numero_bonches`, `variedad`, `cliente`, `valor`, `observaciones`

### NOTAS_CREDITO
Notas de crédito por calidad, anulación u otros motivos.

Campos:
`numero`, `cliente`, `fecha`, `valor`, `factura`, `motivo`, `observaciones`

### CATALOGOS
Listas maestras para evitar escribir nombres diferentes para lo mismo.

Campos:
`variedades`, `clientes_cargueras`, `tipos_caja`, `medidas_cm`, `estados_pago`, `estados_pedido`, `siembras`

## Reglas importantes

- No cambiar los nombres de las pestañas ni de los encabezados.
- Usar fechas reales, no texto libre.
- Usar números sin símbolos: por ejemplo `1328.40`, no `$1.328,40`.
- Registrar porcentajes como decimal o fórmula: `0.95` para 95%.
- Mantener clientes, variedades y estados con nombres consistentes usando la hoja `CATALOGOS`.
- No unir celdas en las tablas de datos.
- No dejar filas de títulos dentro de las tablas, solo encabezados en la fila 1.

## Archivo listo

La plantilla creada para importar o copiar a Google Sheets está en:

`Plantilla_Google_Sheets_Altitud_Flowers.xlsx`

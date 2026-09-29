# Altitud Flowers — dashboard de gestión

Florícola en Ecuador (hypericum: NEW RED, SPRING PEACH, GREEN XL). Sitio
estático publicado por GitHub Pages en
`https://alvarocmoya22-art.github.io/altitudflowers/`, repo
`alvarocmoya22-art/altitudflowers`.

**No hay build ni framework.** HTML + CSS + JS plano. Lo que está en `main`
es literalmente lo que se sirve. Cachebusting a mano con `?v=YYYYMMDD-nombre`
en cada `<script>` y `<link>`: **si tocás un `.js`, hay que subirle el `?v=`
en cada HTML que lo carga**, o el navegador de la operadora sigue con el
archivo viejo.

**Este proyecto se ha venido trabajando con Codex**, no conmigo. Las ramas se
llaman `codex/<tema>` y entran por PR. Antes de empezar, revisar si hay
trabajo sin commitear de la otra herramienta.

## El flujo, que es lo que da sentido a todo lo demás

```
PRODUCCION_CAMPO -> POSCOSECHA -> CONTROL_CALIDAD -> CUARTO_FRIO
                 -> VENTAS_VENDEDORES -> FACTURAS -> ESTADO_CUENTA
```

**Desde el 2026-08-20 (`qualityCutoverDate`) poscosecha ya no suma al stock.**
Solo los tallos que control de calidad aprueba entran a cuarto frío:
`stock disponible = tallos aprobados por calidad - tallos vendidos`.
Antes de esa fecha el inventario sale directo de poscosecha; por eso la
constante existe y no se puede borrar sin romper el histórico.

**El control de calidad se hace por total diario, no por procesadora.** Una
fila de `CONTROL_CALIDAD` = una combinación `fecha_proceso + variedad`. Los
campos `ids_poscosecha` y `procesadoras` (separados por `|`) conservan la
trazabilidad de los registros originales sin obligar a revisar persona por
persona. La clave de agrupación es `qualityGroupKey()` en `js/config.js`.

**Estados de calidad:** `APROBADO` (todo pasa), `AJUSTADO` (pasa menos de lo
declarado), `RECHAZADO` (no pasa nada). El estado se deriva solo si la hoja
no lo trae.

## Reglas de negocio que no se leen del código

**La unidad es el tallo; el bunch es empaque.** `tallosPorBunch: 10`. Las
medidas comerciales son 70, 60, 55 y 50 cm; `NACIONAL` es la flor que no da
la talla y se vende en el mercado local, y `BASURA` se descarta.
`comercial = 70+60+55+50`, y `util = comercial + nacional` — la nacional sí
se vende, así que cuenta como útil.

**Una venta se detecta como nacional aunque no lo digan.** `saleLooksNational()`
la reconoce por tipo, por medida, por las palabras NAC/NACIONAL/DESCARTE en
observaciones, o porque el precio unitario es <= $0,03. Ese último caso es
data sucia del Excel: si alguien vende comercial a menos de 3 centavos, el
sistema lo va a leer como nacional.

**Cajas HB:** la capacidad depende de la medida — 70 cm entran 25 bunches,
las demás medidas y la nacional 30 (`ALTITUD_HB_CAPACITY`). Se reportan cajas
completas + bunches sueltos, nunca cajas fraccionadas.

**Facturación:** una venta nace `PENDIENTE`. Al guardar una factura en
`ESTADO_CUENTA`, el campo `ids_ventas` vincula los despachos y esas ventas
pasan a `FACTURADO` y dejan de aparecer como pendientes.

## Datos

Todo vive en un Google Sheets (`ALTITUD.sheetId` en `js/config.js`).
Lectura por `gviz/tq` (público, solo lectura); escritura por Apps Script
(`ALTITUD.appsScriptUrl`, código fuente en los `.gs` de la raíz). El esquema
completo de pestañas y campos está en `ESQUEMA_GOOGLE_SHEETS.md` — **esa es
la fuente de verdad, y el Apps Script tiene que coincidir con ella**.

Reglas de la hoja: no renombrar pestañas ni encabezados, fechas reales (no
texto), números sin símbolos (`1328.40`), porcentajes como decimal (`0.95`),
sin celdas unidas y sin filas de título dentro de la tabla.

`asNumber()` acepta formato ecuatoriano y anglosajón a la vez (`1.328,40` y
`1,328.40`); si alguien escribe un número raro en la hoja, mirar ahí primero.

## Permisos — leer antes de tocar

`js/permisos.js` define cinco roles: `GERENCIA` (los 12 módulos),
`OPERADORA_PRODUCCION`, `VENDEDOR`, `ADMINISTRACION` y `CLIENTE_STOCK`.

**Esto ordena la interfaz; no es control de acceso.** El rol se resuelve
entero en el navegador y nada del lado del servidor lo verifica, así que sirve
para que cada persona vea su módulo y no para proteger datos. Siendo un sitio
estático contra una hoja de lectura pública, no hay dónde apoyar un control
real: eso exigiría cambiar de arquitectura (un backend con sesión y la hoja
cerrada). **No presentar estos roles como si protegieran información**, y no
poner detrás de ellos nada que no pueda ser público.

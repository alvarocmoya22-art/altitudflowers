function dateValue(row){const raw=text(row.fecha||row.fecha_emision||row.fecha_pago||row.fecha_corte||row.fecha_registro);if(!raw)return null;if(/^\d{4}-\d{1,2}-\d{1,2}/.test(raw)){const parts=raw.slice(0,10).split('-').map(Number);return new Date(parts[0],parts[1]-1,parts[2])}const latin=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(latin)return new Date(Number(latin[3]),Number(latin[2])-1,Number(latin[1]));const d=new Date(raw);return Number.isNaN(d.getTime())?null:d}
function localDateKey(date=new Date()){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function todayLabel(){return new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date())}
function inRange(row,filters){const d=dateValue(row);if(filters.desde&&d&&d<new Date(`${filters.desde}T00:00:00`))return false;if(filters.hasta&&d&&d>new Date(`${filters.hasta}T23:59:59`))return false;if(filters.semana&&asNumber(row.semana)!==asNumber(filters.semana))return false;if(filters.mes&&d&&(d.getMonth()+1)!==asNumber(filters.mes))return false;return true}
function currentFilters(){return{desde:$('filterDesde')?.value,hasta:$('filterHasta')?.value,semana:$('filterSemana')?.value,mes:$('filterMes')?.value,variedad:text($('filterVariedad')?.value),siembra:text($('filterSiembra')?.value).toUpperCase(),cliente:text($('filterCliente')?.value).toUpperCase(),vendedor:text($('filterVendedor')?.value).toUpperCase()}}
function sameDay(row){const d=dateValue(row);return d&&localDateKey(d)===localDateKey()}
function sameMonth(row){const d=dateValue(row);const now=new Date();return d&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()}
function filterRows(rows,filters,kind){return(rows||[]).filter(row=>{if(!inRange(row,filters))return false;if(filters.variedad&&normalizeVariety(row.variedad)!==filters.variedad)return false;if(filters.siembra&&text(row.siembra||row.bloque).toUpperCase().indexOf(filters.siembra)===-1)return false;if(kind==='ventas'&&filters.cliente&&text(row.cliente).toUpperCase().indexOf(filters.cliente)===-1)return false;if(kind==='ventas'&&filters.vendedor&&text(row.vendedor).toUpperCase().indexOf(filters.vendedor)===-1)return false;if(kind==='finanzas'&&filters.cliente&&text(row.cliente).toUpperCase().indexOf(filters.cliente)===-1)return false;return true})}

function cleanProductionRows(rows){const map=new Map();(rows||[]).forEach(row=>{const estado=text(row.estado).toUpperCase();if(estado==='ELIMINADO'||estado==='ANULADO')return;const tallos=asNumber(row.tallos_cortados||row.tallos||row.tallos_cosechados);if(!tallos)return;const id=text(row.id_produccion)||[row.fecha,row.semana,row.siembra||row.bloque,row.cama,row.variedad,tallos,row.responsable].map(text).join('|');const clean={...row,tallos_cortados:tallos,variedad:normalizeVariety(row.variedad),siembra:text(row.siembra||row.bloque)};const existing=map.get(id);if(!existing||text(clean.creado_en)>text(existing.creado_en))map.set(id,clean)});return Array.from(map.values())}

function groupSum(rows,keyFn,valueFn){return rows.reduce((acc,row)=>{const key=keyFn(row)||'Sin dato';acc[key]=(acc[key]||0)+valueFn(row);return acc},{})}
function topEntry(group){return Object.entries(group).sort((a,b)=>b[1]-a[1])[0]||['-',0]}
function countBy(rows,keyFn){return rows.reduce((acc,row)=>{const key=keyFn(row)||'SIN ESTADO';acc[key]=(acc[key]||0)+1;return acc},{})}
function kpiCard(label,value,note,group='operativo'){return`<div class="card kpi" data-permission-group="${group}"><div class="label">${label}</div><div class="value">${value}</div><div class="note">${note||''}</div></div>`}
function miniKpi(label,value){return`<div class="mini-kpi"><span>${label}</span><strong>${value}</strong></div>`}
function renderMini(id,items){const el=$(id);if(el)el.innerHTML=items.map(item=>miniKpi(item[0],item[1])).join('')}
function alertItem(type,title,detail){return`<div class="alert-item ${type}"><strong>${title}</strong><span>${detail}</span></div>`}
async function loadSafe(sheet){try{return await loadSheet(sheet)}catch(err){return[]}}
async function buildDashboard(){
  setStatus('Cargando KPIs...');
  const filters=currentFilters();
  const [produccionRaw,posRaw,ventasRaw,accountsRaw,ingresosRaw,comparativoRaw,clientesRaw,rendimientoRaw]=await Promise.all([
    loadSafe(ALTITUD.sheets.produccion),loadSafe(ALTITUD.sheets.poscosecha),loadSafe(ALTITUD.sheets.ventas),loadSafe(ALTITUD.sheets.estadoCuenta),loadSafe(ALTITUD.sheets.ingresos),loadSafe(ALTITUD.sheets.comparativoProyeccion),loadSafe(ALTITUD.sheets.clientes),loadSafe(ALTITUD.sheets.rendimientoProcesadoras)
  ]);
  const produccion=filterRows(cleanProductionRows(produccionRaw),filters,'produccion');
  const poscosecha=filterRows(normalizeProcessed(posRaw),filters,'poscosecha');
  const ventas=filterRows(normalizeSales(ventasRaw),filters,'ventas');
  const accounts=filterRows(normalizeAccounts(accountsRaw),filters,'finanzas');
  const ingresos=filterRows(ingresosRaw,filters,'finanzas');
  const comparativo=filterRows(comparativoRaw,filters,'comparativo');
  const stockData=calculateColdRoomStock(posRaw,ventasRaw,filters);
  const stock=stockData.porVariedad;
  const rendimientoBase=poscosecha.map(row=>({fecha:row.fecha,semana:row.semana,procesadora:row.responsable,tallos_procesados:row.comercial+row.nacional,minutos_trabajados:row.minutos_trabajados,horas_trabajadas:asNumber(row.minutos_trabajados)/60,estado:row.estado,variedad:row.variedad}));
  const rendimiento=filterRows(rendimientoBase,filters,'rendimiento').map(row=>{const tallos=asNumber(row.tallos_procesados||row.tallos),horas=asNumber(row.horas_trabajadas)||asNumber(row.minutos_trabajados)/60;return{...row,tallos,horas,tallosHora:horas?tallos/horas:0,procesadora:text(row.procesadora||row.responsable).toUpperCase()}});
  const rendimientoConTiempo=rendimiento.filter(row=>row.horas>0);
  const rendimientoHoras=rendimientoConTiempo.reduce((a,r)=>a+r.horas,0);
  const rendimientoTallos=rendimientoConTiempo.reduce((a,r)=>a+r.tallos,0);
  const promedioRendimiento=rendimientoHoras?rendimientoTallos/rendimientoHoras:0;
  const rendimientoPersonas=groupSum(rendimientoConTiempo,r=>r.procesadora,r=>r.tallos);
  const horasPersonas=groupSum(rendimientoConTiempo,r=>r.procesadora,r=>r.horas);
  const mejorProcesadora=Object.keys(rendimientoPersonas).map(persona=>[persona,horasPersonas[persona]?rendimientoPersonas[persona]/horasPersonas[persona]:0]).sort((a,b)=>b[1]-a[1])[0]||['-',0];
  const prodToday=produccion.filter(sameDay).reduce((a,r)=>a+asNumber(r.tallos_cortados),0);
  const prodMonth=produccion.filter(sameMonth).reduce((a,r)=>a+asNumber(r.tallos_cortados),0);
  const posToday=poscosecha.filter(sameDay).reduce((a,r)=>a+r.tallos_procesados,0);
  const posTotal=poscosecha.reduce((a,r)=>a+r.tallos_procesados,0);
  const utilTotal=poscosecha.reduce((a,r)=>a+r.util,0);
  const basuraTotal=poscosecha.reduce((a,r)=>a+r.basura,0);
  const descartePct=posTotal?basuraTotal/posTotal:0;
  const stockTotal=stockData.resumen.stockDisponible;
  const soldToday=ventas.filter(sameDay).reduce((a,r)=>a+r.tallos,0);
  const soldMonth=ventas.filter(sameMonth).reduce((a,r)=>a+r.tallos,0);
  const totalVenta=ventas.reduce((a,r)=>a+(r.total_venta||r.tallos*r.precio_unitario),0);
  const avgPrice=ventas.reduce((a,r)=>a+r.tallos,0)?totalVenta/ventas.reduce((a,r)=>a+r.tallos,0):0;
  const facturado=accounts.reduce((a,r)=>a+r.valor,0);
  const pendiente=accounts.reduce((a,r)=>a+r.saldo,0);
  const cobrado=accounts.reduce((a,r)=>a+r.valor_pagado,0)||(facturado-pendiente);
  const vencidas=accounts.filter(r=>r.estado==='VENCIDO'||(r.saldo>0&&dateValue({fecha:r.fecha_vencimiento})&&dateValue({fecha:r.fecha_vencimiento})<new Date())).length;
  const ingresosMes=ingresos.filter(sameMonth).reduce((a,r)=>a+asNumber(r.valor_ingresado),0);
  const compProy=comparativo.reduce((a,r)=>a+asNumber(r.tallos_proyectados),0);
  const compReal=comparativo.reduce((a,r)=>a+asNumber(r.tallos_reales||r.tallos_cosechados_reales||r.tallos_procesados_reales),0);
  const cumplimiento=compProy?compReal/compProy:0;
  const estadosComp=countBy(comparativo,r=>text(r.estado_resultado).toUpperCase());
  $('executiveKpis').innerHTML=[
    kpiCard('Tallos cortados hoy',fmtInt(prodToday),`Campo - ${todayLabel()}`,'operativo'),
    kpiCard('Tallos cortados acumulados',fmtInt(produccion.reduce((a,r)=>a+asNumber(r.tallos_cortados),0)),'Periodo filtrado','operativo'),
    kpiCard('Tallos procesados hoy',fmtInt(posToday),`Poscosecha - ${todayLabel()}`,'operativo'),
    kpiCard('Stock disponible',fmtInt(stockTotal),'Cuarto frio','operativo'),
    kpiCard('Tallos vendidos hoy',fmtInt(soldToday),`Ventas - ${todayLabel()}`,'ventas'),
    kpiCard('Promedio tallos/hora',fmtInt(promedioRendimiento),rendimientoHoras?'Rendimiento procesadoras':'Sin minutos registrados','operativo'),
    kpiCard('Mejor procesadora',mejorProcesadora[0],mejorProcesadora[1]?`${fmtInt(mejorProcesadora[1])} tallos/hora`:'Sin minutos registrados','operativo'),
    kpiCard('Total facturado',fmtMoney(facturado),'Estado de cuenta','finanzas'),
    kpiCard('Total cobrado',fmtMoney(cobrado),'Ingresos reales','finanzas'),
    kpiCard('Saldo pendiente',fmtMoney(pendiente),'Por cobrar','finanzas'),
    kpiCard('Cumplimiento proyeccion',fmtPct(cumplimiento),'Real / proyectado','gerencia'),
    kpiCard('Porcentaje descarte',fmtPct(descartePct),'Descarte / procesado','operativo'),
    kpiCard('Facturas vencidas',fmtInt(vencidas),'Requiere cobro','finanzas')
  ].join('');
  const topVar=topEntry(groupSum(produccion,r=>normalizeVariety(r.variedad),r=>asNumber(r.tallos_cortados)));
  const topSiembra=topEntry(groupSum(produccion,r=>text(r.siembra||r.bloque),r=>asNumber(r.tallos_cortados)));
  const topResponsable=topEntry(groupSum(produccion,r=>text(r.responsable),r=>asNumber(r.tallos_cortados)));
  renderMini('produccionKpis',[['Mes',fmtInt(prodMonth)],['Variedad lider',topVar[0]],['Siembra lider',topSiembra[0]],['Responsable',topResponsable[0]]]);
  renderRows($('produccionBody'),[['Cortados mes',fmtInt(prodMonth)],['Cumplimiento',fmtPct(cumplimiento)],['Diferencia proyeccion',fmtInt(compReal-compProy)]],[r=>r[0],r=>r[1]]);
  renderMini('poscosechaKpis',[['Procesados',fmtInt(posTotal)],['Comercial',fmtInt(poscosecha.reduce((a,r)=>a+r.comercial,0))],['Nacional',fmtInt(poscosecha.reduce((a,r)=>a+r.nacional,0))],['Descarte',fmtInt(basuraTotal)]]);
  renderRows($('medidasBody'),[['70 cm',poscosecha.reduce((a,r)=>a+r.tallos_70,0)],['60 cm',poscosecha.reduce((a,r)=>a+r.tallos_60,0)],['55 cm',poscosecha.reduce((a,r)=>a+r.tallos_55,0)],['50 cm',poscosecha.reduce((a,r)=>a+r.tallos_50,0)],['Nacional',poscosecha.reduce((a,r)=>a+r.nacional,0)]],[r=>r[0],r=>fmtInt(r[1])]);
  renderMini('inventarioKpis',[['Disponible',fmtInt(stockTotal)],['Stock nacional',fmtInt(stockData.porVariedadMedida.filter(r=>r.medida==='NACIONAL').reduce((a,r)=>a+r.stockDisponible,0))],['Bajo stock',fmtInt(stockData.resumen.variedadesBajoStock)],['Agotadas',fmtInt(stockData.resumen.variedadesAgotadas)]]);
  renderRows($('stockBody'),stockData.porVariedadMedida.slice(0,8),[r=>`${r.variedad} ${medidaLabel(r.medida)}`,r=>fmtInt(r.stockDisponible),r=>r.estado==='AGOTADO'||r.estado==='INCONSISTENCIA'?'<span class="pill bad">'+r.estado+'</span>':r.estado==='BAJO STOCK'?'<span class="pill warn">BAJO STOCK</span>':'<span class="pill ok">DISPONIBLE</span>']);
  const topVendedor=topEntry(groupSum(ventas,r=>r.vendedor,r=>r.tallos));
  const topCliente=topEntry(groupSum(ventas,r=>r.cliente,r=>r.tallos));
  renderMini('ventasKpis',[['Vendidos mes',fmtInt(soldMonth)],['Total vendido',fmtMoney(totalVenta)],['Precio promedio',fmtMoney(avgPrice)],['Mejor vendedor',topVendedor[0]]]);
  renderRows($('ventasBody'),[['Cliente mayor compra',topCliente[0]],['Ventas por variedad',topEntry(groupSum(ventas,r=>r.variedad,r=>r.tallos))[0]],['Ventas por medida',topEntry(groupSum(ventas,r=>r.medida_cm,r=>r.tallos))[0]]],[r=>r[0],r=>r[1]]);
  const estadosFact=countBy(accounts,r=>r.estado||'PENDIENTE');
  renderMini('finanzasKpis',[['Facturado',fmtMoney(facturado)],['Cobrado',fmtMoney(cobrado)],['Pendiente',fmtMoney(pendiente)],['Cobranza',fmtPct(facturado?cobrado/facturado:0)]]);
  renderRows($('facturasBody'),Object.entries(estadosFact),[r=>r[0],r=>fmtInt(r[1])]);
  renderMini('proyeccionKpis',[['Proyectado',fmtInt(compProy)],['Real',fmtInt(compReal)],['Diferencia',fmtInt(compReal-compProy)],['Cumplimiento',fmtPct(cumplimiento)]]);
  renderRows($('proyeccionBody'),Object.entries(estadosComp),[r=>r[0]||'SIN ESTADO',r=>fmtInt(r[1])]);
  const alerts=[];
  if(stockData.resumen.variedadesBajoStock)alerts.push(alertItem('warn','Bajo stock','Una o mas variedades/medidas estan por debajo del minimo.'));
  if(stockData.resumen.variedadesAgotadas)alerts.push(alertItem('bad','Variedades agotadas','Existen variedades/medidas sin disponibilidad.'));
  stockData.alertas.filter(a=>a.tipo==='bad').slice(0,3).forEach(a=>alerts.push(alertItem('bad','Alerta cuarto frio',a.mensaje)));
  if(descartePct>.10)alerts.push(alertItem('bad','Descarte elevado',`El descarte esta en ${fmtPct(descartePct)}.`));
  if(cumplimiento&&cumplimiento<.80)alerts.push(alertItem('bad','Produccion deficiente frente a proyeccion',`Cumplimiento ${fmtPct(cumplimiento)}.`));
  if(vencidas)alerts.push(alertItem('bad','Facturas vencidas',`${fmtInt(vencidas)} facturas requieren revision.`));
  if(pendiente>5000)alerts.push(alertItem('warn','Saldo pendiente alto',`Pendiente total ${fmtMoney(pendiente)}.`));
  $('alertsBody').innerHTML=alerts.length?alerts.join(''):'<div class="alert-item"><strong>Sin alertas criticas</strong><span>Los indicadores no superan los umbrales definidos.</span></div>';
  ALTITUD_PERMISOS.applyPermissionGroups(await ALTITUD_PERMISOS.resolveCurrentUser());
  setStatus(`KPIs actualizados ${new Intl.DateTimeFormat('es-EC',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())}`);
}
function setupDashboardFilters(){const month=$('filterMes');if(month)month.innerHTML='<option value="">Todos</option>'+Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');const variety=$('filterVariedad');if(variety)variety.innerHTML='<option value="">Todas</option>'+ALTITUD.variedades.map(v=>`<option value="${v}">${v}</option>`).join('');document.querySelectorAll('.dashboard-filters input,.dashboard-filters select').forEach(el=>el.addEventListener('change',buildDashboard));$('clearFilters')?.addEventListener('click',()=>{document.querySelectorAll('.dashboard-filters input,.dashboard-filters select').forEach(el=>el.value='');buildDashboard()})}
document.addEventListener('DOMContentLoaded',async()=>{const ok=await ALTITUD_PERMISOS.enforcePagePermission();if(!ok)return;setupDashboardFilters();await buildDashboard();window.setInterval(buildDashboard,60000)});

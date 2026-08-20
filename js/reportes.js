async function initReportes(){
  setStatus('Calculando reportes...');
  const {processed,quality,sales}=await loadProcessedAndSales();
  const stockData=calculateColdRoomStock(quality,sales);
  const totalProcesado=processed.reduce((a,r)=>a+r.tallos_procesados,0);
  const totalUtil=processed.reduce((a,r)=>a+r.util,0);
  const totalBasura=processed.reduce((a,r)=>a+r.basura,0);
  const totalVendido=normalizeSales(sales).reduce((a,r)=>a+r.tallos,0);
  const ingresos=normalizeSales(sales).reduce((a,r)=>a+(r.total_venta||r.tallos*r.precio_unitario),0);
  const stockTotal=stockData.resumen.stockDisponible;
  const totalAprobado=normalizeQuality(quality).reduce((a,r)=>a+r.tallos_aprobados,0);
  const totalRechazadoCalidad=normalizeQuality(quality).reduce((a,r)=>a+r.tallos_rechazados,0);
  if($('kProcesado'))$('kProcesado').textContent=fmtInt(totalProcesado);
  if($('kVendido'))$('kVendido').textContent=fmtInt(totalVendido);
  if($('kStock'))$('kStock').textContent=fmtInt(stockTotal);
  if($('kIngresos'))$('kIngresos').textContent=fmtMoney(ingresos);
  renderRows($('reportBody'),[
    {indicador:'Tallos procesados',valor:fmtInt(totalProcesado),nota:'Base POSCOSECHA / DATOS_WEB'},
    {indicador:'Tallos aprobados',valor:fmtInt(totalAprobado),nota:'CONTROL_CALIDAD'},
    {indicador:'Rechazo de calidad',valor:fmtInt(totalRechazadoCalidad),nota:'Ajustes posteriores a poscosecha'},
    {indicador:'Aprovechamiento',valor:fmtPct(totalProcesado?totalUtil/totalProcesado:0),nota:'Comercial + nacional'},
    {indicador:'Descarte',valor:fmtPct(totalProcesado?totalBasura/totalProcesado:0),nota:'Descarte sobre procesado'},
    {indicador:'Tallos vendidos',valor:fmtInt(totalVendido),nota:'VENTAS_VENDEDORES'},
    {indicador:'Stock disponible',valor:fmtInt(stockTotal),nota:'Aprobado por calidad - vendido'},
    {indicador:'Ingresos registrados',valor:fmtMoney(ingresos),nota:'Precio x tallos'}
  ],[r=>r.indicador,r=>r.valor,r=>r.nota]);
  setStatus('Reportes listos');
}
document.addEventListener('DOMContentLoaded',initReportes);

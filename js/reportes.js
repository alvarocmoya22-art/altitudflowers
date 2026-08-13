async function initReportes(){
  setStatus('Calculando reportes...');
  const {processed,sales}=await loadProcessedAndSales();
  const stock=buildStock(processed,sales);
  const totalProcesado=processed.reduce((a,r)=>a+r.tallos_procesados,0);
  const totalUtil=processed.reduce((a,r)=>a+r.util,0);
  const totalBasura=processed.reduce((a,r)=>a+r.basura,0);
  const totalVendido=normalizeSales(sales).reduce((a,r)=>a+r.tallos,0);
  const ingresos=normalizeSales(sales).reduce((a,r)=>a+(r.total_venta||r.tallos*r.precio_unitario),0);
  const stockTotal=stock.reduce((a,r)=>a+r.stock,0);
  if($('kProcesado'))$('kProcesado').textContent=fmtInt(totalProcesado);
  if($('kVendido'))$('kVendido').textContent=fmtInt(totalVendido);
  if($('kStock'))$('kStock').textContent=fmtInt(stockTotal);
  if($('kIngresos'))$('kIngresos').textContent=fmtMoney(ingresos);
  renderRows($('reportBody'),[
    {indicador:'Tallos procesados',valor:fmtInt(totalProcesado),nota:'Base POSCOSECHA / DATOS_WEB'},
    {indicador:'Aprovechamiento',valor:fmtPct(totalProcesado?totalUtil/totalProcesado:0),nota:'Comercial + nacional'},
    {indicador:'Descarte',valor:fmtPct(totalProcesado?totalBasura/totalProcesado:0),nota:'Descarte sobre procesado'},
    {indicador:'Tallos vendidos',valor:fmtInt(totalVendido),nota:'VENTAS_VENDEDORES'},
    {indicador:'Stock disponible',valor:fmtInt(stockTotal),nota:'Procesado - vendido'},
    {indicador:'Ingresos registrados',valor:fmtMoney(ingresos),nota:'Precio x tallos'}
  ],[r=>r.indicador,r=>r.valor,r=>r.nota]);
  setStatus('Reportes listos');
}
document.addEventListener('DOMContentLoaded',initReportes);

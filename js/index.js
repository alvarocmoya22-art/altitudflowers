async function initIndex(){
  setStatus('Cargando resumen...');
  const {processed,sales}=await loadProcessedAndSales();
  const accounts=await loadAccounts();
  const stock=buildStock(processed,sales);
  const totalProcesado=processed.reduce((a,r)=>a+r.tallos_procesados,0);
  const totalVendido=normalizeSales(sales).reduce((a,r)=>a+r.tallos,0);
  const totalStock=stock.reduce((a,r)=>a+r.stock,0);
  const ingresos=normalizeSales(sales).reduce((a,r)=>a+(r.total_venta||r.tallos*r.precio_unitario),0);
  const facturado=accounts.reduce((a,r)=>a+r.valor,0);
  const pendiente=accounts.reduce((a,r)=>a+r.saldo,0);
  const cobrado=facturado-pendiente;
  $('kProcesado').textContent=fmtInt(totalProcesado);
  $('kVendido').textContent=fmtInt(totalVendido);
  $('kStock').textContent=fmtInt(totalStock);
  $('kIngresos').textContent=fmtMoney(ingresos);
  $('kFacturado').textContent=fmtMoney(facturado);
  $('kCobrado').textContent=fmtMoney(cobrado);
  $('kPendiente').textContent=fmtMoney(pendiente);
  renderRows($('summaryBody'),stock.slice(0,10),[r=>r.variedad,r=>fmtInt(r.procesado),r=>fmtInt(r.vendido),r=>fmtInt(r.stock)]);
  setStatus('Resumen actualizado');
}
document.addEventListener('DOMContentLoaded',initIndex);

async function initConfiguracion(){
  setStatus('Cargando configuracion...');
  const sheets=['VARIEDADES','PRECIOS','VENDEDORES','RENDIMIENTO_PROCESADORAS','CONFIGURACION'];
  const rows=[];
  for(const sheet of sheets){
    try{const data=await loadSheet(sheet);rows.push({catalogo:sheet,registros:data.filter(r=>Object.values(r).some(Boolean)).length,estado:'Conectado'})}
    catch(err){rows.push({catalogo:sheet,registros:0,estado:'Pendiente'})}
  }
  renderRows($('configBody'),rows,[r=>r.catalogo,r=>fmtInt(r.registros),r=>r.estado,r=>'Google Sheets']);
  setStatus('Configuracion lista');
}
document.addEventListener('DOMContentLoaded',initConfiguracion);

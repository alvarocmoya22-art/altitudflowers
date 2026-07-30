function renderAltitudNav(user=ALTITUD_PERMISOS.getCurrentUser()){
  document.querySelectorAll('[data-nav], .nav').forEach(nav=>{
    const hasLocalAnchors=[...nav.querySelectorAll('a')].some(a=>(a.getAttribute('href')||'').startsWith('#'));
    if(hasLocalAnchors)return;
    const current=currentModuleId();
    const html=ALTITUD_MODULES.filter(module=>ALTITUD_PERMISOS.userCanAccess(module.id,user)).map(module=>`<a class="${module.id===current?'active':''}" href="${hrefWithRole(module.href,user)}">${module.label}</a>`).join('');
    nav.innerHTML=html;
  });
}
function hrefWithRole(href,user){
  const role=(user?.rol||'GERENCIA').toUpperCase();
  if(role==='GERENCIA')return href;
  const separator=href.includes('?')?'&':'?';
  return `${href}${separator}rol=${encodeURIComponent(role)}`;
}
document.addEventListener('DOMContentLoaded',async()=>{
  const user=await ALTITUD_PERMISOS.resolveCurrentUser();
  renderAltitudNav(user);
  await ALTITUD_PERMISOS.enforcePagePermission();
});

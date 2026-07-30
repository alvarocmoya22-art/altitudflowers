function renderAltitudNav(user=ALTITUD_PERMISOS.getCurrentUser()){
  document.querySelectorAll('[data-nav], .nav').forEach(nav=>{
    const hasLocalAnchors=[...nav.querySelectorAll('a')].some(a=>(a.getAttribute('href')||'').startsWith('#'));
    if(hasLocalAnchors)return;
    const current=currentModuleId();
    const html=ALTITUD_MODULES.filter(module=>ALTITUD_PERMISOS.userCanAccess(module.id,user)).map(module=>`<a class="${module.id===current?'active':''}" href="${module.href}">${module.label}</a>`).join('');
    nav.innerHTML=html;
  });
}
document.addEventListener('DOMContentLoaded',async()=>{
  const user=await ALTITUD_PERMISOS.resolveCurrentUser();
  renderAltitudNav(user);
  await ALTITUD_PERMISOS.enforcePagePermission();
});

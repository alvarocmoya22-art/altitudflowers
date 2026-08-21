const ALTITUD_NAV_GLYPHS={
  panel:'PG',
  produccion:'PC',
  poscosecha:'PO',
  'control-calidad':'CC',
  rendimiento:'RE',
  'cuarto-frio':'CF',
  vendedores:'VE',
  'estado-cuenta':'EC',
  'comparativo-proyeccion':'CP',
  clientes:'CL',
  reportes:'RP',
  configuracion:'CO'
};

function renderAltitudNav(user=ALTITUD_PERMISOS.getCurrentUser()){
  document.querySelectorAll('[data-nav], .nav').forEach(nav=>{
    const hasLocalAnchors=[...nav.querySelectorAll('a')].some(a=>(a.getAttribute('href')||'').startsWith('#'));
    if(hasLocalAnchors)return;
    const current=currentModuleId();
    const html=ALTITUD_MODULES.filter(module=>ALTITUD_PERMISOS.userCanAccess(module.id,user)).map(module=>{
      const glyph=ALTITUD_NAV_GLYPHS[module.id]||module.label.slice(0,2).toUpperCase();
      return `<a class="${module.id===current?'active':''}" href="${hrefWithRole(module.href,user)}" title="${module.label}"><span class="nav-glyph" aria-hidden="true">${glyph}</span><span class="nav-label">${module.label}</span></a>`;
    }).join('');
    nav.innerHTML=html;
  });
}

function setupAltitudSidebar(){
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar||sidebar.dataset.collapsibleReady==='true')return;

  sidebar.dataset.collapsibleReady='true';
  sidebar.id=sidebar.id||'altitudSidebar';
  document.body.classList.add('has-collapsible-sidebar');

  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='sidebar-toggle';
  toggle.title='Contraer menu';
  toggle.setAttribute('aria-label','Contraer menu lateral');
  toggle.setAttribute('aria-controls',sidebar.id);
  toggle.innerHTML='<span aria-hidden="true"><i></i><i></i><i></i></span>';
  sidebar.insertBefore(toggle,sidebar.querySelector('.nav'));

  const mobileToggle=document.createElement('button');
  mobileToggle.type='button';
  mobileToggle.className='mobile-nav-toggle';
  mobileToggle.title='Abrir menu';
  mobileToggle.setAttribute('aria-label','Abrir menu lateral');
  mobileToggle.setAttribute('aria-controls',sidebar.id);
  mobileToggle.innerHTML='<span aria-hidden="true"><i></i><i></i><i></i></span>';
  document.body.prepend(mobileToggle);

  const overlay=document.createElement('button');
  overlay.type='button';
  overlay.className='sidebar-overlay';
  overlay.setAttribute('aria-label','Cerrar menu lateral');
  document.body.appendChild(overlay);

  const desktopQuery=window.matchMedia('(min-width: 961px)');
  const savedCollapsed=localStorage.getItem('altitudSidebarCollapsed')==='true';

  function closeMobile(){
    document.body.classList.remove('sidebar-mobile-open');
    mobileToggle.setAttribute('aria-expanded','false');
  }

  function syncSidebarState(){
    if(desktopQuery.matches){
      closeMobile();
      document.body.classList.toggle('sidebar-collapsed',localStorage.getItem('altitudSidebarCollapsed')==='true');
    }else{
      document.body.classList.remove('sidebar-collapsed');
    }
    const collapsed=document.body.classList.contains('sidebar-collapsed');
    toggle.title=collapsed?'Expandir menu':'Contraer menu';
    toggle.setAttribute('aria-label',toggle.title+' lateral');
    toggle.setAttribute('aria-expanded',String(!collapsed));
  }

  if(savedCollapsed)document.body.classList.add('sidebar-collapsed');
  syncSidebarState();

  toggle.addEventListener('click',()=>{
    if(!desktopQuery.matches){
      closeMobile();
      return;
    }
    const collapsed=!document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed',collapsed);
    localStorage.setItem('altitudSidebarCollapsed',String(collapsed));
    syncSidebarState();
  });

  mobileToggle.addEventListener('click',()=>{
    const open=!document.body.classList.contains('sidebar-mobile-open');
    document.body.classList.toggle('sidebar-mobile-open',open);
    mobileToggle.setAttribute('aria-expanded',String(open));
  });
  overlay.addEventListener('click',closeMobile);
  sidebar.querySelector('.nav')?.addEventListener('click',event=>{
    if(event.target.closest('a')&&!desktopQuery.matches)closeMobile();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeMobile();
  });
  desktopQuery.addEventListener?.('change',syncSidebarState);
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
  setupAltitudSidebar();
  await ALTITUD_PERMISOS.enforcePagePermission();
});

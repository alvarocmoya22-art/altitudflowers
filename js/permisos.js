const ALTITUD_ROLES={
  GERENCIA:['panel','produccion','poscosecha','control-calidad','rendimiento','cuarto-frio','vendedores','estado-cuenta','comparativo-proyeccion','clientes','reportes','configuracion'],
  OPERADORA_PRODUCCION:['produccion','poscosecha','control-calidad','rendimiento','cuarto-frio'],
  VENDEDOR:['vendedores','clientes','cuarto-frio'],
  ADMINISTRACION:['estado-cuenta','clientes','reportes'],
  CLIENTE_STOCK:['cuarto-frio']
};
const ALTITUD_MODULES=[
  {id:'panel',label:'Panel gerencial',href:'index.html'},
  {id:'produccion',label:'Produccion campo',href:'produccion.html'},
  {id:'poscosecha',label:'Poscosecha',href:'poscosecha.html'},
  {id:'control-calidad',label:'Control de calidad',href:'control-calidad.html'},
  {id:'rendimiento',label:'Rendimiento',href:'rendimiento-procesadoras.html'},
  {id:'cuarto-frio',label:'Cuarto frio',href:'cuarto-frio.html'},
  {id:'vendedores',label:'Vendedores',href:'vendedores.html'},
  {id:'estado-cuenta',label:'Estado de Cuenta',href:'estado-cuenta.html'},
  {id:'comparativo-proyeccion',label:'Comparativo Proyeccion',href:'comparativo-proyeccion.html'},
  {id:'clientes',label:'Clientes',href:'clientes.html'},
  {id:'reportes',label:'Reportes',href:'reportes.html'},
  {id:'configuracion',label:'Configuracion',href:'configuracion.html'}
];
const ALTITUD_ROLE_GROUPS={
  operativo:['GERENCIA','OPERADORA_PRODUCCION'],
  ventas:['GERENCIA','VENDEDOR'],
  finanzas:['GERENCIA','ADMINISTRACION'],
  gerencia:['GERENCIA'],
  administracion:['GERENCIA','ADMINISTRACION']
};
function getStoredUser(){try{return JSON.parse(localStorage.getItem('altitudUsuarioActual')||'{}')}catch(err){return{}}}
function saveStoredUser(user){localStorage.setItem('altitudUsuarioActual',JSON.stringify(user||{}))}
function applyUserFromQuery(){const params=new URLSearchParams(location.search);const rol=params.get('rol'),correo=params.get('correo'),nombre=params.get('nombre');if(rol||correo||nombre){const current=getStoredUser();saveStoredUser({nombre:nombre||current.nombre||'Usuario Altitud',correo:correo||current.correo||'',rol:normalizeRole(rol||current.rol||'GERENCIA'),estado:'ACTIVO'})}}
function normalizeRole(role){const r=text(role||'GERENCIA').toUpperCase();return ALTITUD_ROLES[r]?r:'GERENCIA'}
function currentModuleId(){return document.body?.dataset?.module||ALTITUD_MODULES.find(m=>location.pathname.endsWith(m.href))?.id||'panel'}
function getCurrentUser(){const stored=getStoredUser();return{nombre:stored.nombre||'Usuario Altitud',correo:stored.correo||'',rol:normalizeRole(stored.rol||'GERENCIA'),estado:stored.estado||'ACTIVO'}}
function userCanAccess(moduleId,user=getCurrentUser()){return(ALTITUD_ROLES[user.rol]||[]).includes(moduleId)}
function firstAllowedModule(user=getCurrentUser()){return ALTITUD_MODULES.find(module=>userCanAccess(module.id,user))||ALTITUD_MODULES[0]}
function canSeeGroup(group,user=getCurrentUser()){return(ALTITUD_ROLE_GROUPS[group]||['GERENCIA']).includes(user.rol)}
async function resolveCurrentUser(){applyUserFromQuery();const stored=getCurrentUser();if(stored.correo){try{const rows=await loadSheet(ALTITUD.sheets.usuarios);const match=(rows||[]).find(row=>text(row.correo).toLowerCase()===stored.correo.toLowerCase()&&text(row.estado||'ACTIVO').toUpperCase()!=='INACTIVO');if(match){const user={nombre:text(match.nombre)||stored.nombre,correo:text(match.correo),rol:normalizeRole(match.rol),estado:text(match.estado||'ACTIVO').toUpperCase()};saveStoredUser(user);return user}}catch(err){}}return stored}
function applyPermissionGroups(user=getCurrentUser()){document.querySelectorAll('[data-permission-group]').forEach(el=>{el.hidden=!canSeeGroup(el.dataset.permissionGroup,user)})}
function showPermissionDenied(user,module){document.body.innerHTML=`<main class="login-view"><section class="login-card"><div class="brand">Altitud Flowers</div><h1>Sin permiso</h1><p class="subtitle">No tienes permiso para acceder a este modulo.</p><p class="subtitle">Rol actual: ${user.rol}</p><a class="btn primary" href="${module.href}" style="width:100%;margin-top:16px">Ir a mi modulo</a></section></main>`}
async function enforcePagePermission(){const user=await resolveCurrentUser();const moduleId=currentModuleId();if(!userCanAccess(moduleId,user)){const target=firstAllowedModule(user);showPermissionDenied(user,target);setTimeout(()=>{location.href=target.href},1800);return false}applyPermissionGroups(user);const roleStatus=$('roleStatus');if(roleStatus)roleStatus.textContent=`Rol: ${user.rol}`;return true}
window.ALTITUD_PERMISOS={roles:ALTITUD_ROLES,modules:ALTITUD_MODULES,getCurrentUser,saveStoredUser,resolveCurrentUser,userCanAccess,firstAllowedModule,canSeeGroup,applyPermissionGroups,enforcePagePermission};

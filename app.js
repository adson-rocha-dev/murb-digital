"use strict";
const URL='https://cowddlbzohpxpteaitph.supabase.co', KEY='sb_publishable_2LJ2dCsQfWx4afxc8SGX7g_AIK9zqZb';
const $=id=>document.getElementById(id);
const MODULES=['Manutenção de Vias','Programação de Vias','Geolocalização'];
let session=null,teams=[],places=JSON.parse(localStorage.getItem('central_vias_drafts_v1')||'[]'),filter='todos',page='vias';
const HIDDEN_KEY='central_vias_hidden_v19_v16';let hiddenV19=new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY)||'[]'));
places=places.filter(p=>!(p.origin==='v19'&&hiddenV19.has(p.id)));
// Marco inicial V22: arquivar localmente registros anteriores, sem apagar dados na V19/Supabase.
const MARCO_INICIAL='2026-11-23';
const MARCO_FIM_PRIMEIRA_SEMANA='2026-11-28';
const MARCO_ARCHIVE_KEY='central_vias_pre_marco_archive_v22';
function dataOperacionalValida(p){return typeof p?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&p.date>=MARCO_INICIAL}
function arquivarAntesDoMarco(){
 const antigos=places.filter(p=>!dataOperacionalValida(p));
 if(!antigos.length)return;
 let arquivo=[];
 try{const raw=JSON.parse(localStorage.getItem(MARCO_ARCHIVE_KEY)||'[]');if(Array.isArray(raw))arquivo=raw}catch{}
 const ids=new Set(arquivo.map(p=>String(p.id)));
 for(const p of antigos)if(!ids.has(String(p.id))){arquivo.push(p);ids.add(String(p.id))}
 // Nunca descartar registros se não houver espaço para guardar o histórico.
 try{localStorage.setItem(MARCO_ARCHIVE_KEY,JSON.stringify(arquivo));places=places.filter(dataOperacionalValida);localStorage.setItem('central_vias_drafts_v1',JSON.stringify(places))}catch(e){console.warn('Marco inicial: falha ao arquivar, mantendo dados originais',e)}
}
arquivarAntesDoMarco();

function setBarConnection(value){const el=$('cloud');if(el)el.textContent=value;const dot=$('bar-dot');if(dot){dot.className='bar-dot '+(value==='Autenticado'?'connected':'disconnected')}}
function updateBarTeams(){const el=$('bar-teams');if(el)el.textContent=String(teams.length);const fiscal=$('bar-fiscals');if(fiscal)fiscal.textContent=String(new Set(teams.map(fiscalName).filter(v=>v&&v!=='Fiscal não identificado')).size);const last=$('bar-last');if(last)last.textContent=new Date().toLocaleString('pt-BR');const active=$('bar-actives');if(active){const values=teams.map(t=>{const v=t.ativos??t.activeCount??t.totalAtivos??t.total_ativos??t.efetivoAtivo??t.efetivo_ativo;if(typeof v==='number')return v;if(typeof v==='string'&&/^\d+$/.test(v))return Number(v);if(Array.isArray(t.funcionarios))return t.funcionarios.filter(f=>f.ativo===true||String(f.status||'').toLowerCase()==='ativo').length;return null});active.textContent=values.length&&values.every(Number.isFinite)?String(values.reduce((a,b)=>a+b,0)):'Não disponível no backup'}}
// V23: uma única central de conexão, com login dentro do painel da barra.
function closeConnectionPanel(){
 const panel=$('premium-status-panel');panel.hidden=true;
 $('login').hidden=true;
 $('bar-cloud').setAttribute('aria-expanded','false');
}
function openConnectionPanel(showLogin=false){
 const panel=$('premium-status-panel');panel.hidden=false;
 $('bar-cloud').setAttribute('aria-expanded','true');
 $('login').hidden=!showLogin;
}
$('bar-cloud').onclick=()=>{
 if(!$('premium-status-panel').hidden){closeConnectionPanel();return}
 openConnectionPanel(false);
};
$('bar-close').onclick=closeConnectionPanel;
$('bar-connect').onclick=()=>{
 const login=$('login');login.hidden=!login.hidden;
 if(!login.hidden)login.scrollIntoView({block:'nearest'});
};
document.addEventListener('pointerdown',e=>{
 const panel=$('premium-status-panel');
 if(!panel.hidden&&!panel.contains(e.target)&&!$('bar-cloud').contains(e.target))closeConnectionPanel();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeConnectionPanel()});
$('bar-refresh').onclick=async()=>{
 if(!session){openConnectionPanel(true);toast('Conecte-se ao Supabase para atualizar equipes');return}
 await loadTeams();
};
window.centralGeoTeams=()=>teams.map(t=>({...t,id:String(t.id??t.sigla??t.code??t.name),name:teamName(t),fiscal:fiscalName(t)}));
window.centralGeoPrograms=()=>groupPlaces(places.filter(dataOperacionalValida)).map(groupSummary).map(p=>({id:p.id,address:p.address,area:p.area,date:p.date,team:p.team,fiscal:p.fiscal,service:p.service,status:p.status,lat:p.lat,lng:p.lng,mapLink:p.mapLink||'',members:p.members||[]}));
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(t){$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2200)}
function show(p,title){page=p;document.querySelectorAll('.page').forEach(e=>e.hidden=e.id!==p);$('title').textContent=title||({vias:'Manutenção de Vias',programar:'Programação de Vias'}[p]||'Manutenção de Vias');if(p==='vias')render();document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===p));}
$('home').onclick=()=>{show('vias');window.scrollTo({top:0,behavior:'smooth'})};
document.querySelectorAll('nav [data-page]').forEach(b=>b.onclick=()=>show(b.dataset.page));
$('new').onclick=()=>show('programar');
async function request(path,options={}){let r=await fetch(URL+path,{...options,headers:{apikey:KEY,...(session?{Authorization:'Bearer '+session.access_token}:{}),...(options.headers||{})}});let body=await r.text();if(!r.ok)throw Error('HTTP '+r.status+': '+body.slice(0,180));try{return JSON.parse(body)}catch{return body}}
$('loginform').onsubmit=async e=>{e.preventDefault();$('authstatus').textContent='Autenticando...';try{session=await request('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value,password:$('password').value})});$('password').value='';sessionStorage.setItem('central_vias_auth',JSON.stringify(session));setBarConnection('Autenticado');$('authstatus').textContent='Autenticação realizada. Consultando backup Johnson...';await loadTeams()}catch(err){session=null;setBarConnection('Desconectado');$('authstatus').textContent='Falha: '+err.message}};
$('logout').onclick=()=>{session=null;sessionStorage.removeItem('central_vias_auth');teams=[];setBarConnection('Desconectado');$('authstatus').textContent='Sessão encerrada';fillTeams();updateBarTeams()};$('refresh').onclick=loadTeams;
async function loadTeams(){if(!session){$('authstatus').textContent='Entre com seu e-mail e senha primeiro.';return}try{let user=await request('/auth/v1/user');let uid=user.id;if(!uid)throw Error('Usuário sem UID');let files=await request('/storage/v1/object/list/murb-johnson',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:uid+'/',limit:100,sortBy:{column:'created_at',order:'desc'}})});let latest=(Array.isArray(files)?files:[]).filter(x=>/^johnson-auto-.*\.json$/.test(x.name)).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0))[0];if(!latest)throw Error('Nenhum backup Johnson automático encontrado nesta conta. Nenhum dado foi alterado.');let name=encodeURIComponent(latest.name),r=await request('/storage/v1/object/authenticated/murb-johnson/'+encodeURIComponent(uid)+'/'+name);if(typeof r==='string')r=JSON.parse(r);if(!Array.isArray(r.teams))throw Error('Backup sem lista de equipes.');teams=r.teams;const imported=importDailySchedule(r);$('authstatus').textContent=`Backup ${latest.name}: ${teams.length} equipe(s). `+(imported.available?`${imported.count} programação(ões) V19 no backup; ${imported.added} nova(s) importada(s), ${imported.updated} atualizada(s).`:'O backup não contém dailySchedule; nenhuma programação V19 foi importada.')+' Consulta somente leitura.';fillTeams();updateBarTeams();toast(imported.available?'Equipes e programações consultadas':'Equipes carregadas; programações indisponíveis no backup')}catch(err){$('authstatus').textContent='Não foi possível carregar: '+err.message}}
// V15: programação diária da V19 presente no mesmo backup Johnson; leitura somente leitura.
// IDs têm prefixo próprio para não colidir com programações cadastradas na Central.
function importDailySchedule(backup){
 const rows=Array.isArray(backup.dailySchedule)?backup.dailySchedule:null;
 if(!rows)return {available:false,count:0,added:0,updated:0};
 const byTeamId=new Map(teams.map(t=>[String(t.id),t]));
 const existing=new Map(places.filter(p=>p.origin==='v19').map(p=>[p.id,p]));
 let added=0,updated=0;
 for(const row of rows){
  if(!row||typeof row!=='object'||!row.date||!row.local)continue;
  const date=String(row.date).slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<MARCO_INICIAL)continue;
  const team=byTeamId.get(String(row.teamId??''));
  const teamLabel=String(row.teamName||team?.name||teamName(team||{})||'Equipe não informada').trim();
  const identity=String(row.id??[date,row.teamId||teamLabel,row.local].join('|'));
  const id='v19:'+identity;
  if(hiddenV19.has(id))continue;
  const prior=existing.get(id);
  const fields={id,origin:'v19',sourceId:identity,sourceUpdatedAt:String(row.updatedAt||''),
   address:String(row.local||'').trim(),area:String(row.bairro||'').trim(),date,
   service:String(row.service||'').trim(),team:teamLabel,
   fiscal:String(row.responsavel||team?.lead||fiscalName(team||{})).trim(),
   activeCount:Number.isFinite(Number(row.activeCount))?Number(row.activeCount):null,
   encarregado:String(row.encarregado||''),note:String(row.note||''),
   status:'naoiniciada',priority:false,lat:null,lng:null,mapLink:''};
  if(prior){
   // Edições locais, status, prioridade e GPS não são substituídos pelo backup.
   if(!prior.localEdited){for(const key of ['address','area','date','service','team','fiscal','activeCount','encarregado','note'])prior[key]=fields[key]}
   prior.sourceUpdatedAt=fields.sourceUpdatedAt;
   updated++;
  }else{places.push(fields);added++}
 }
 persistPlaces();render();
 return {available:true,count:rows.length,added,updated};
}
function teamName(t){return String(t.sigla||t.code||t.nome||t.name||t.id||'Equipe sem identificação')}
function fiscalName(t){return String(t.lead||t.fiscal||t.supervisor||t.responsavel||t.inspector||t.fiscalName||t.supervisorName||'Fiscal não identificado').trim()||'Fiscal não identificado'}
function fillTeams(){let select=$('teamselect');select.innerHTML='<option value="">Selecione a equipe</option>'+teams.map((t,i)=>`<option value="${i}">${escapeHtml(teamName(t))}</option>`).join('')};$('teamselect').onchange=()=>{$('fiscal').value=teams[$('teamselect').value]?fiscalName(teams[$('teamselect').value]):''};
$('progform').onsubmit=e=>{e.preventDefault();let fd=new FormData(e.target),t=teams[Number(fd.get('team'))];if(!t||fd.get('team')===''){toast('Selecione equipe carregada do Supabase');return}let location;try{location=locationFields(fd)}catch(err){toast(err.message);return}places.unshift({id:crypto.randomUUID(),address:fd.get('address'),area:fd.get('area'),date:fd.get('date'),service:fd.get('service'),team:teamName(t),fiscal:fiscalName(t),...location,status:fd.get('status'),priority:fd.has('priority')});localStorage.setItem('central_vias_drafts_v1',JSON.stringify(places));e.target.reset();show('vias');toast('Programação salva neste dispositivo')};
function dateBR(value){
 const v=String(value||'').trim();if(!v)return 'Não informada';
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v);if(iso)return `${iso[3]}/${iso[2]}/${iso[1]}`;
 const br=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);return br?v:'Data não reconhecida';
}
// Accept official Google Maps share URLs, including shortened links copied from Android.
function normalizeMapLink(value){
 const raw=String(value||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
 if(!raw)return '';
 const match=raw.match(/https?:\/\/[^\s<>"']+/i);
 let candidate=(match?match[0]:raw).replace(/[),.;!]+$/g,'');
 try{
  const u=new globalThis.URL(candidate);
  if(u.protocol!=='https:')return '';
  const host=u.hostname.toLowerCase().replace(/\.$/,'');
  // Google Maps links shared from Android include maps.app.goo.gl and ?g_st=ac.
  const allowed=host==='maps.app.goo.gl'||host==='goo.gl'||host==='maps.google.com'||host==='google.com'||host.endsWith('.google.com')||/^google\.[a-z.]+$/.test(host)||/^maps\.google\.[a-z.]+$/.test(host);
  if(!allowed)return '';
  if(host==='goo.gl'&&!u.pathname.startsWith('/maps'))return '';
  return u.href;
 }catch{return ''}
}
function isGoogleMapsLink(value){return !!normalizeMapLink(value)}
function locationLink(p){
 const supplied=normalizeMapLink(p.mapLink);
 if(supplied)return supplied;
 return validCoordinates(p)?'https://www.google.com/maps?q='+encodeURIComponent(String(p.lat)+','+String(p.lng)):'';
}
// Coordenadas verificadas para o link específico fornecido pelo operador.
// Outros links encurtados continuam exigindo resolução segura ou confirmação manual.
const verifiedShortMapPoints={
 'Hx73ZhfcVWuAiRFNA':[-3.1139315,-60.0364438]
};
function verifiedShortMapCoordinates(value){
 const normalized=normalizeMapLink(value);
 if(!normalized)return null;
 try{
  const u=new globalThis.URL(normalized);
  if(u.hostname.toLowerCase()!=='maps.app.goo.gl')return null;
  const code=u.pathname.replace(/^\/+|\/+$/g,'');
  return Object.prototype.hasOwnProperty.call(verifiedShortMapPoints,code)?verifiedShortMapPoints[code].slice():null;
 }catch{return null}
}
function coordinatesFromMapLink(value){
 if(!value)return null;
 if(!isGoogleMapsLink(value))return null;
 const verified=verifiedShortMapCoordinates(value);if(verified)return verified;
 try{
  const u=new globalThis.URL(value);let raw=u.searchParams.get('q')||u.searchParams.get('query')||u.searchParams.get('ll')||'';
  let m=raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if(!m)m=decodeURIComponent(u.pathname).match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if(!m)m=decodeURIComponent(u.pathname+u.search).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if(!m)return null;
  const lat=Number(m[1]),lng=Number(m[2]);return Math.abs(lat)<=90&&Math.abs(lng)<=180?[lat,lng]:null;
 }catch{return null}
}
function locationFields(fd){
 const originalLink=String(fd.get('mapLink')||'').trim();
 const mapLink=normalizeMapLink(originalLink);
 if(originalLink&&!mapLink)throw Error('Cole um link HTTPS do Google Maps.');
 let lat=String(fd.get('lat')||'').trim(),lng=String(fd.get('lng')||'').trim();
 if((lat&&!lng)||(!lat&&lng))throw Error('Informe latitude e longitude juntas.');
 const coords=coordinatesFromMapLink(mapLink);
 if(coords){lat=String(coords[0]);lng=String(coords[1])}
 if(lat&&lng&&!validCoordinates({lat,lng}))throw Error('Coordenadas inválidas.');
 return {lat:lat||null,lng:lng||null,mapLink};
}
function format(p){
 const info=v=>String(v||'Não informado').trim();
 const location=locationLink(p)||'Localização GPS não cadastrada';
 return [
  '*PROGRAMAÇÃO OPERACIONAL*',
  '',
  '*DATA E LOCAL*',
  `Data: ${dateBR(p.date)}`,
  `Via / endereço: ${info(p.address)}`,
  `Área: ${info(p.area)}`,
  '',
  '*EXECUÇÃO DO SERVIÇO*',
  `Serviço: ${info(p.service)}`,
  `Equipe: *${info(p.team)}*`,
  `Fiscal: *${info(p.fiscal)}*`,
  `Situação: ${statusLabel(p.status)}`,
  '',
  '*LOCALIZAÇÃO NO MAPA*',
  location,
  '',
  '*CENTRAL OPERACIONAL | MURB SERVIÇOS*'
 ].join('\n');
}
async function copy(s){try{await navigator.clipboard.writeText(s);toast('Programação copiada!')}catch{let t=document.createElement('textarea');t.value=s;document.body.append(t);t.select();let ok=document.execCommand('copy');t.remove();toast(ok?'Programação copiada!':'Cópia indisponível: use HTTPS')}}
function persistPlaces(){arquivarAntesDoMarco();localStorage.setItem('central_vias_drafts_v1',JSON.stringify(places))}
function statusLabel(s){return {naoiniciada:'Não iniciada',andamento:'Em andamento',concluida:'Concluída'}[s]||'Não iniciada'}
// Uma única apresentação para equipes no mesmo local e dia, sem fundir os registros originais.
function groupKey(p){return [String(p.date||''),String(p.address||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ')].join('|')}
function groupPlaces(rows){const groups=new Map();for(const p of rows){const key=groupKey(p);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}return [...groups.values()]}
function groupSummary(group){const p=group[0];return {...p,area:[...new Set(group.map(x=>x.area).filter(Boolean))].join(' / '),team:[...new Set(group.map(x=>x.team).filter(Boolean))].join(', '),fiscal:[...new Set(group.map(x=>x.fiscal).filter(Boolean))].join(', '),service:[...new Set(group.map(x=>x.service).filter(Boolean))].join(' / '),priority:group.some(x=>x.priority),mapLink:group.find(x=>x.mapLink&&normalizeMapLink(x.mapLink))?.mapLink||'',lat:group.find(x=>validCoordinates(x))?.lat??p.lat,lng:group.find(x=>validCoordinates(x))?.lng??p.lng,activeCount:group.every(x=>Number.isFinite(Number(x.activeCount))&&x.activeCount!=null)?group.reduce((a,x)=>a+Number(x.activeCount),0):null}}
function groupById(id){const p=places.find(x=>x.id===id);return p?places.filter(x=>groupKey(x)===groupKey(p)):[]}
function render(){if(geoActive&&!$('map').hidden)updateGeoMap();let area=$('area').value,q=$('search').value.toLowerCase(),w=selectedWeek;let list=groupPlaces(places.filter(p=>dataOperacionalValida(p)&&(!w||weekMatch(p.date,w)))).filter(group=>(!area||group.some(p=>p.area===area))&&(filter==='todos'||group.some(p=>filter==='prioridades'?p.priority:p.status===filter))&&(!q||group.some(p=>[p.address,p.service,p.team,p.area].join(' ').toLowerCase().includes(q)))).map(groupSummary).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.address||'').localeCompare(String(b.address||''),'pt-BR'));let specs=[['todos','Total','#174b97'],['concluida','Concluídas','#138b41'],['andamento','Andamento','#d6a51f'],['naoiniciada','Não iniciadas','#777f89'],['prioridades','Prioridades','#c6313a']];$('metrics').innerHTML=specs.map(([id,label,c])=>`<button class="metric ${filter===id?'on':''}" data-filter="${id}" style="background:${c}"><b>${id==='todos'?places.length:id==='prioridades'?places.filter(p=>p.priority).length:places.filter(p=>p.status===id).length}</b><span>${label}</span></button>`).join('');$('list').innerHTML=list.length?list.map(p=>`<article class="card compact-card"><div class="card-top"><div class="card-identity"><button class="address" data-copy="${escapeHtml(p.id)}" title="Copiar programação e localização">📍 ${escapeHtml(p.address)}</button><p class="meta">${escapeHtml(p.area)} · ${escapeHtml(p.service)} · ${escapeHtml(dateBR(p.date))}</p></div><button class="edit-icon" data-edit="${escapeHtml(p.id)}" title="Editar programação" aria-label="Editar programação de ${escapeHtml(p.address)}">✎</button></div><div class="compact-actions"><button class="status-pill status-${escapeHtml(p.status||'naoiniciada')}" data-status="${escapeHtml(p.id)}" title="${p.status==='concluida'?'Toque para retornar a Em andamento':'Toque para avançar o serviço'}">${escapeHtml(statusLabel(p.status))}${p.status==='concluida'?' ↶':' ›'}</button>${p.status==='andamento'?`<button class="status-back" data-status-back="${escapeHtml(p.id)}" title="Retornar para Não iniciada" aria-label="Retornar para Não iniciada">↶</button>`:''}${p.team.split(', ').map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}${p.priority?'<span class="priority-mark" title="Ponto de atenção">!</span>':''}</div><details class="details"><summary>Detalhes</summary><p>Fiscal: ${escapeHtml(p.fiscal)}</p>${p.activeCount!=null?`<p>Ativos: ${p.activeCount}</p>`:''}<p>Localização: ${locationLink(p)?'Localização cadastrada':'Não cadastrada'}</p>${locationLink(p)?`<a href="${escapeHtml(locationLink(p))}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>`:''}</details></article>`).join(''):'<p class="notice">Nenhuma programação encontrada. Cadastre a primeira em “Nova programação”.</p>'}
function editPlace(p){const group=groupById(p.id);const picker=$('edit-member');picker.innerHTML=group.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.team||'Equipe')} — ${escapeHtml(x.fiscal||'Fiscal não informado')}</option>`).join('');picker.hidden=group.length<2;$('edit-member-label').hidden=group.length<2;picker.value=p.id;const dlg=$('editdialog');const f=$('editform');f.elements.id.value=p.id;for(const k of ['address','area','date','service','fiscal','lat','lng','mapLink'])f.elements[k].value=p[k]??'';f.elements.priority.checked=!!p.priority;$('edit-save-feedback').textContent='';dlg.showModal()}
$('editform').onsubmit=e=>{e.preventDefault();
 const f=e.currentTarget,fd=new FormData(f),feedback=$('edit-save-feedback');feedback.textContent='';
 const p=places.find(x=>String(x.id)===String(fd.get('id')));
 if(!p){feedback.textContent='Não foi possível identificar esta programação. Feche e abra a edição novamente.';return}
 const address=String(fd.get('address')||'').trim(),date=String(fd.get('date')||'').trim(),service=String(fd.get('service')||'').trim();
 if(!address||!service){feedback.textContent='Preencha o endereço e o serviço para salvar.';return}
 // Programações importadas podem ter data ausente: permitir salvar o link sem perder o registro.
 if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)){feedback.textContent='Confira a data da programação.';return}
 let location;try{location=locationFields(fd)}catch(err){feedback.textContent=err.message;return}
 const updated={...p,localEdited:p.origin==='v19'?true:p.localEdited,address,area:String(fd.get('area')||p.area),date:date||p.date,service,fiscal:String(fd.get('fiscal')||'').trim(),...location,priority:fd.has('priority')};
 try{
  const next=places.map(x=>x.id===p.id?updated:x);
  localStorage.setItem('central_vias_drafts_v1',JSON.stringify(next));
  places=next;
  $('editdialog').close();render();toast('Programação e localização salvas neste dispositivo');
 }catch(err){feedback.textContent='Não foi possível salvar no dispositivo: '+(err?.message||'erro de armazenamento')}
};
$('edit-member').onchange=()=>{const p=places.find(x=>x.id===$('edit-member').value);if(p){const f=$('editform');f.elements.id.value=p.id;for(const k of ['address','area','date','service','fiscal','lat','lng','mapLink'])f.elements[k].value=p[k]??'';f.elements.priority.checked=!!p.priority}};
$('delete-edit').onclick=()=>{const f=$('editform'),p=places.find(x=>x.id===f.elements.id.value);if(!p)return;const group=groupById(p.id);const all=group.length>1&&confirm('Este local possui '+group.length+' equipes. OK: excluir TODAS as equipes deste local. Cancelar: escolher exclusão individual.');let targets=all?group:[p];if(!all&&!confirm('Excluir a programação da equipe '+(p.team||'selecionada')+'?'))return;if(all&&!confirm('Confirma excluir todas as '+group.length+' programações deste local?'))return;for(const x of targets)if(x.origin==='v19')hiddenV19.add(x.id);localStorage.setItem(HIDDEN_KEY,JSON.stringify([...hiddenV19]));const ids=new Set(targets.map(x=>x.id));places=places.filter(x=>!ids.has(x.id));persistPlaces();$('editdialog').close();render();toast(targets.length+' programação(ões) excluída(s) deste dispositivo')};
$('cancel-edit').onclick=()=>$('editdialog').close();
// Semanas editáveis: armazenamento separado das programações existentes.
const WEEK_STORE='central_vias_weeks_v9',WEEK_SELECTED='central_vias_selected_week_v9';
function isoDay(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function dateShift(d,n){const t=new Date(d+'T12:00:00');t.setDate(t.getDate()+n);return isoDay(t)}
function defaultWeeks(){return Array.from({length:52},(_,i)=>{const a=dateShift(MARCO_INICIAL,i*7);return{id:'marco-'+i,start:a,end:dateShift(a,5)}})}
function loadWeeks(){
 let saved=[];try{const x=JSON.parse(localStorage.getItem(WEEK_STORE));if(Array.isArray(x))saved=x.filter(w=>w&&w.id&&w.start&&w.end&&w.start>=MARCO_INICIAL)}catch{}
 const first={id:'marco-0',start:MARCO_INICIAL,end:MARCO_FIM_PRIMEIRA_SEMANA};
 if(!saved.some(w=>w.start===MARCO_INICIAL&&w.end===MARCO_FIM_PRIMEIRA_SEMANA))saved.unshift(first);
 const ids=new Set(saved.map(w=>w.start+'|'+w.end));
 for(const w of defaultWeeks())if(!ids.has(w.start+'|'+w.end)){saved.push(w);ids.add(w.start+'|'+w.end)}
 return saved.sort((a,b)=>a.start.localeCompare(b.start));
}
let weeks=loadWeeks(),selectedWeek=localStorage.getItem(WEEK_SELECTED)||'';
if(selectedWeek&&!weeks.some(w=>w.id===selectedWeek))selectedWeek='';
// Na primeira abertura, exibe a semana vigente sem alterar escolhas já salvas.
if(!selectedWeek){const today=isoDay(new Date());const current=weeks.find(w=>w.start<=today&&w.end>=today)||weeks.find(w=>w.start===MARCO_INICIAL);if(current)selectedWeek=current.id;}
function weekMatch(date,id){const w=weeks.find(x=>x.id===id);return !!w&&!!date&&date>=MARCO_INICIAL&&date>=w.start&&date<=w.end}
function weekLabel(w){const fmt=d=>{const [y,m,day]=d.split('-');return `${day}/${m}/${y}`};return `${fmt(w.start)} a ${fmt(w.end)}`}
function saveWeeks(){localStorage.setItem(WEEK_STORE,JSON.stringify(weeks));localStorage.setItem(WEEK_SELECTED,selectedWeek)}
function updateWeekButton(){const w=weeks.find(x=>x.id===selectedWeek);$('week').innerHTML='<span class="week-date">'+(w?dateBR(w.start):'Todas as semanas')+'</span><span class="week-arrow">▾</span>'}
function drawWeeks(){const list=$('weeks-list');list.innerHTML='<button type="button" class="week-choice" data-week=""><span>Todas as semanas</span><span class="week-radio '+(!selectedWeek?'selected':'')+'"></span></button>'+weeks.slice().sort((a,b)=>{const today=isoDay(new Date());const ap=a.end<today?1:0,bp=b.end<today?1:0;return ap-bp||a.start.localeCompare(b.start)}).map(w=>`<div class="week-row"><button type="button" class="week-choice" data-week="${escapeHtml(w.id)}"><span>${escapeHtml(weekLabel(w))}</span><span class="week-radio ${selectedWeek===w.id?'selected':''}"></span></button><button type="button" class="week-pencil" data-week-edit="${escapeHtml(w.id)}" aria-label="Editar semana ${escapeHtml(weekLabel(w))}">✎</button></div>`).join('')}
function openWeeks(){drawWeeks();$('weeks-dialog').showModal()}
$('week').onclick=openWeeks;$('weeks-close').onclick=()=>$('weeks-dialog').close();
$('weeks-list').onclick=e=>{const edit=e.target.closest('[data-week-edit]');if(edit){const w=weeks.find(x=>x.id===edit.dataset.weekEdit);if(!w)return;$('week-id').value=w.id;$('week-start').value=w.start;$('week-end').value=w.end;$('week-start').focus();return}const btn=e.target.closest('[data-week]');if(!btn)return;selectedWeek=btn.dataset.week;saveWeeks();updateWeekButton();$('weeks-dialog').close();render()};
$('week-add').onclick=()=>{$('week-id').value='';$('week-start').value='';$('week-end').value='';$('week-start').focus()};
$('weeks-form').onsubmit=e=>{e.preventDefault();const start=$('week-start').value,end=$('week-end').value,id=$('week-id').value;if(!start||!end||end<start){toast('A data final deve ser igual ou posterior à inicial');return}if(id){const w=weeks.find(x=>x.id===id);if(w)Object.assign(w,{start,end})}else{weeks.push({id:'week-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),start,end})}saveWeeks();drawWeeks();updateWeekButton();render();$('week-id').value='';toast('Período salvo')};
updateWeekButton();
$('metrics').onclick=e=>{let b=e.target.closest('[data-filter]');if(b){filter=b.dataset.filter;render()}};$('list').onclick=e=>{let b=e.target.closest('[data-copy],[data-edit],[data-status],[data-status-back]');if(!b)return;let id=b.dataset.copy||b.dataset.edit||b.dataset.status||b.dataset.statusBack,p=places.find(x=>x.id===id);if(!p)return;const group=groupById(id);if(b.dataset.copy){copy(format(groupSummary(group)));return}if(b.dataset.edit){editPlace(p);return}const current=group.some(x=>x.status==='naoiniciada')?'naoiniciada':group.some(x=>x.status==='andamento')?'andamento':'concluida';const next=b.hasAttribute('data-status-back')?'naoiniciada':current==='naoiniciada'?'andamento':current==='andamento'?'concluida':'andamento';for(const x of group){x.status=next;if(next==='andamento')x.startedAt=new Date().toISOString();if(next==='concluida')x.completedAt=new Date().toISOString();if(next!=='concluida')delete x.completedAt;if(next==='naoiniciada')delete x.startedAt}persistPlaces();render();window.dispatchEvent(new Event('central:programs-changed'));toast('Status: '+statusLabel(next))};['area','search'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
// Mapa geográfico: integração da abordagem Leaflet + GPS utilizada na V19.
let geoMap=null,geoMarkers=null,geoLoadPromise=null,geoActive=false;
function validCoordinates(p){let lat=Number(p.lat),lng=Number(p.lng);return p.lat!==null&&p.lat!==''&&p.lng!==null&&p.lng!==''&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180}
function geoLink(p){return 'https://www.google.com/maps?q='+encodeURIComponent(p.lat+','+p.lng)}
function loadLeaflet(){
 if(window.L&&window.L.map)return Promise.resolve(window.L);
 if(geoLoadPromise)return geoLoadPromise;
 geoLoadPromise=new Promise((resolve,reject)=>{
  if(!document.querySelector('link[data-geo-leaflet]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';l.dataset.geoLeaflet='1';document.head.append(l)}
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=()=>window.L?resolve(window.L):reject(Error('Biblioteca de mapas indisponível'));s.onerror=()=>reject(Error('Não foi possível baixar o mapa. Verifique a internet.'));document.head.append(s)
 });return geoLoadPromise;
}
function mapLocations(){
 const area=$('area').value,q=$('search').value.toLowerCase(),w=selectedWeek;
 return groupPlaces(places.filter(p=>dataOperacionalValida(p)&&(!w||weekMatch(p.date,w))))
 .filter(g=>(!area||g.some(p=>p.area===area))&&(filter==='todos'||g.some(p=>filter==='prioridades'?p.priority:p.status===filter))&&(!q||g.some(p=>[p.address,p.service,p.team,p.area].join(' ').toLowerCase().includes(q))))
 .map(groupSummary).filter(validCoordinates);
}
async function resolveShortMapCoordinates(link){
 const u=new globalThis.URL('https://murb-maps-resolver.murbdigital.workers.dev/api/resolve-google-map');
 u.searchParams.set('url',link);
 const response=await fetch(u.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Serviço de links indisponível (HTTP '+response.status+').');
 const result=await response.json();
 if(result.lat==null||result.lng==null)return null;
 const lat=Number(result.lat),lng=Number(result.lng);
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lat,lng]:null;
}
async function resolveDashboardLinks(){
 const candidates=places.filter(p=>dataOperacionalValida(p)&&!validCoordinates(p)&&p.mapLink);
 let updated=0,unresolved=0,serviceUnavailable=false;
 for(const p of candidates){
  let coords=coordinatesFromMapLink(p.mapLink);
  if(!coords){try{coords=await resolveShortMapCoordinates(p.mapLink)}catch(e){serviceUnavailable=true}}
  if(coords){for(const member of groupById(p.id)){member.lat=coords[0];member.lng=coords[1]}updated++}
  else unresolved++;
 }
 if(updated){persistPlaces();render()}
 const result=updated+' ponto(s) reconhecido(s) do dashboard. '+(unresolved?unresolved+' ainda sem coordenadas confirmadas. ':'')+(serviceUnavailable?'Não foi possível consultar o resolvedor Cloudflare. Verifique se ele está publicado e permite acesso a partir deste site.':'');
 $('map-message').textContent=result;
 const geoStatus=document.getElementById('murbGeoLinksStatus');if(geoStatus)geoStatus.textContent=result;
 return updated;
}

window.centralGeoResolveLinks=resolveDashboardLinks;
// V33: confirmação manual preserva o link original da programação.
window.centralGeoSaveConfirmedPoint=function(id,lat,lng){
 const group=groupById(String(id));
 if(!group.length)throw Error('Programação não encontrada. Atualize a lista.');
 lat=Number(lat);lng=Number(lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error('Coordenadas inválidas.');
 for(const member of group){member.lat=lat;member.lng=lng;}
 persistPlaces();render();
 return group.map(member=>member.team).filter(Boolean).join(', ');
};

function fillMapProgramSelect(){
 const sel=$('map-program');
 const selected=sel.value;
 const list=groupPlaces(places.filter(dataOperacionalValida)).map(groupSummary);
 sel.replaceChildren(new Option('Selecione uma programação',''));
 for(const p of list)sel.add(new Option(p.address+' — '+p.team+' — '+dateBR(p.date),p.id));
 sel.value=list.some(p=>p.id===selected)?selected:'';
}
function saveManualMapPoint(lat,lng){
 const id=$('map-program').value;
 const group=id?groupById(id):[];
 if(!group.length){$('map-message').textContent='Selecione primeiro uma programação para vincular o ponto.';return;}
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){$('map-message').textContent='Coordenadas inválidas.';return;}
 for(const p of group){p.lat=lat;p.lng=lng;if(!p.mapLink)p.mapLink='https://www.google.com/maps?q='+lat+','+lng;}
 persistPlaces();render();updateGeoMap();
 $('map-message').textContent='Localização manual salva para '+group.map(p=>p.team).join(', ')+'.';
}
async function updateGeoMap(){
 if(!geoActive||$('map').hidden)return;
 const points=mapLocations();fillMapProgramSelect();$('mapcount').textContent=points.length+' local(is) com GPS';
 try{
  const L=await loadLeaflet();if(!geoActive||$('map').hidden)return;
  if(!geoMap){geoMap=L.map('geo-map',{zoomControl:true}).setView([-3.119,-60.021],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(geoMap);geoMarkers=L.layerGroup().addTo(geoMap);geoMap.on('click',e=>{if($('map-manual-mode').checked)saveManualMapPoint(e.latlng.lat,e.latlng.lng)})}
  geoMarkers.clearLayers();const bounds=[];
  for(const p of points){
   const color='#078B65';
   const html='<div class="geo-pin" style="--pin:'+color+'">'+(p.priority?'!':'●')+'</div>';
   const marker=L.marker([Number(p.lat),Number(p.lng)],{icon:L.divIcon({html,className:'geo-pin-wrap',iconSize:[30,36],iconAnchor:[15,33]})});
   const popup=document.createElement('div');popup.className='geo-popup';
   const title=document.createElement('strong');title.textContent=p.address;popup.append(title);
   for(const value of ['Data: '+dateBR(p.date),'Equipe(s): '+p.team,'Fiscal(is): '+p.fiscal,'Área(s): '+p.area,'Serviço: '+p.service,'Status: '+statusLabel(p.status),'Local programado — não é rastreamento ao vivo']){const line=document.createElement('p');line.textContent=value;popup.append(line)}
   const link=document.createElement('a');link.href=geoLink(p);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir localização no Google Maps';popup.append(link);
   marker.bindPopup(popup).addTo(geoMarkers);bounds.push([Number(p.lat),Number(p.lng)]);
  }
  setTimeout(()=>{if(!geoMap||!geoActive)return;geoMap.invalidateSize();if(bounds.length&&!mapSearchSelected)geoMap.fitBounds(bounds,{padding:[35,35],maxZoom:15})},80);
  $('map-message').textContent=points.length?'Toque no marcador para ver equipe, fiscal, serviço e localização. Marcadores são locais programados, não rastreamento ao vivo.':'Nenhuma programação com coordenadas GPS corresponde aos filtros. Cadastre ou edite um local e use “GPS do celular”.';
 }catch(err){$('map-message').textContent='Mapa indisponível: '+err.message+' As programações continuam acessíveis na Lista.'}
}
// V34 — Pesquisa gratuita sob demanda (Nominatim / OpenStreetMap).
// Sem autocomplete: cada consulta depende de clique explícito, com limite de frequência.
let mapSearchCandidates=[],mapSearchSelected=null,mapSearchMarker=null,mapSearchLastAt=0,mapSearchBusy=false;
function resetMapSearchSelection(){
 mapSearchSelected=null;$('map-search-confirm').hidden=true;
 if(mapSearchMarker&&geoMap){geoMap.removeLayer(mapSearchMarker);mapSearchMarker=null;}
}
function chooseMapSearchResult(index){
 const result=mapSearchCandidates[index];if(!result||!geoMap)return;
 resetMapSearchSelection();mapSearchSelected=result;
 $('map-manual-lat').value=result.lat;$('map-manual-lng').value=result.lng;
 for(const [i,button] of [...$('map-search-results').querySelectorAll('button')].entries())button.setAttribute('aria-pressed',String(i===index));
 geoMap.setView([result.lat,result.lng],17);
 mapSearchMarker=L.marker([result.lat,result.lng],{draggable:true}).addTo(geoMap);
 mapSearchMarker.bindPopup('Ponto sugerido. Arraste o marcador para ajustar e confirme abaixo.').openPopup();
 mapSearchMarker.on('dragend',()=>{const pos=mapSearchMarker.getLatLng();mapSearchSelected={...mapSearchSelected,lat:pos.lat,lng:pos.lng};$('map-manual-lat').value=pos.lat.toFixed(7);$('map-manual-lng').value=pos.lng.toFixed(7)});
 $('map-search-confirm').hidden=false;
 $('map-search-status').textContent='Ponto sugerido. Confira no mapa e, se necessário, arraste o marcador antes de confirmar.';
}
async function searchMapAddress(){
 const query=$('map-address-query').value.trim();
 if(query.length<3){$('map-search-status').textContent='Digite pelo menos 3 caracteres para pesquisar.';return}
 if(!navigator.onLine){$('map-search-status').textContent='A pesquisa precisa de conexão com a internet.';return}
 if(mapSearchBusy)return;
 const wait=mapSearchLastAt+1100-Date.now();if(wait>0){$('map-search-status').textContent='Aguarde um instante antes de pesquisar novamente.';return}
 mapSearchLastAt=Date.now();mapSearchBusy=true;resetMapSearchSelection();mapSearchCandidates=[];$('map-search-results').replaceChildren();
 const button=$('map-address-search');button.disabled=true;$('map-search-status').textContent='Pesquisando endereço...';
 try{
  const u=new URL('https://nominatim.openstreetmap.org/search');u.searchParams.set('q',query);u.searchParams.set('format','jsonv2');u.searchParams.set('limit','5');u.searchParams.set('addressdetails','1');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  let response;try{response=await fetch(u.toString(),{headers:{'Accept':'application/json'},signal:controller.signal})}finally{clearTimeout(timeout)}
  if(!response.ok)throw Error('Serviço de pesquisa indisponível (HTTP '+response.status+').');
  const data=await response.json();if(!Array.isArray(data))throw Error('Resposta inválida do serviço.');
  mapSearchCandidates=data.map(x=>({lat:Number(x.lat),lng:Number(x.lon),label:String(x.display_name||'Local encontrado')})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&Math.abs(x.lat)<=90&&Math.abs(x.lng)<=180);
  if(!mapSearchCandidates.length){$('map-search-status').textContent='Nenhum resultado encontrado. Experimente rua, bairro e cidade (ex.: Manaus).';return}
  mapSearchCandidates.forEach((x,i)=>{const b=document.createElement('button');b.type='button';b.textContent=x.label;b.setAttribute('aria-pressed','false');b.onclick=()=>chooseMapSearchResult(i);$('map-search-results').append(b)});
  $('map-search-status').textContent=mapSearchCandidates.length+' resultado(s). Toque no endereço correspondente.';
 }catch(err){$('map-search-status').textContent=err.name==='AbortError'?'A pesquisa demorou demais. Tente novamente.':'Não foi possível pesquisar: '+err.message}
 finally{mapSearchBusy=false;button.disabled=false}
}
$('map-address-search').onclick=searchMapAddress;
$('map-address-query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchMapAddress()}});
$('map-search-confirm').onclick=()=>{
 if(!mapSearchSelected)return;
 if(!$('map-program').value){$('map-search-status').textContent='Selecione a programação antes de confirmar o ponto.';return}
 const {lat,lng}=mapSearchSelected;
 if(!confirm('Confirmar este ponto para a programação selecionada?'))return;
 saveManualMapPoint(lat,lng);resetMapSearchSelection();$('map-search-status').textContent='Localização confirmada e salva. Confira o botão Ver no mapa.';
};
$('map-refresh').onclick=()=>updateGeoMap();
$('map-import-links').onclick=()=>{if(typeof window.openV19GeoLinks==='function')window.openV19GeoLinks();else resolveDashboardLinks().then(updateGeoMap)};
$('map-manual-save').onclick=()=>{const lat=Number($('map-manual-lat').value),lng=Number($('map-manual-lng').value);if(!$('map-manual-lat').value||!$('map-manual-lng').value){$('map-message').textContent='Informe latitude e longitude.';return}saveManualMapPoint(lat,lng)};
$('map-gps-photo').onclick=()=>{if(typeof window.openV19Geo==='function')window.openV19Geo();else $('map-message').textContent='Central GPS + Foto indisponível.'};

document.querySelectorAll('[data-gps-form]').forEach(button=>button.addEventListener('click',()=>{
 const id=button.dataset.gpsForm,form=$(id),msg=$('gps-'+id);
 if(!window.isSecureContext){msg.textContent='O GPS exige HTTPS ou localhost.';return}
 if(!navigator.geolocation){msg.textContent='Este dispositivo não oferece geolocalização.';return}
 button.disabled=true;msg.textContent='Solicitando permissão de localização...';
 navigator.geolocation.getCurrentPosition(pos=>{
  button.disabled=false;const {latitude,longitude,accuracy}=pos.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){msg.textContent='Coordenadas inválidas.';return}
  form.elements.lat.value=latitude.toFixed(7);form.elements.lng.value=longitude.toFixed(7);
  msg.textContent='GPS capturado (precisão aproximada: '+Math.round(accuracy)+' m). Confirme que o celular está no local de trabalho e salve.';
 },err=>{button.disabled=false;msg.textContent='GPS não obtido: '+(err.code===1?'permissão negada':err.code===2?'posição indisponível':'tempo esgotado')},{enableHighAccuracy:true,timeout:18000,maximumAge:0})
}));

$('listtab').onclick=()=>{geoActive=false;$('list').hidden=false;$('map').hidden=true;$('listtab').classList.add('active');$('maptab').classList.remove('active')};$('maptab').onclick=()=>{if(typeof window.openV19Geo==='function'){window.openV19Geo()}else{alert('Central de Geolocalização indisponível. Recarregue a página.')}};render();

(async function restoreAuth(){try{const saved=JSON.parse(sessionStorage.getItem('central_vias_auth')||'null');if(!saved?.refresh_token)return;session=saved;const exp=Number(saved.expires_at||0);if(exp&&Date.now()/1000>exp-60){const fresh=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:saved.refresh_token})});session=fresh;sessionStorage.setItem('central_vias_auth',JSON.stringify(session))}await request('/auth/v1/user');setBarConnection('Autenticado');await loadTeams()}catch(e){session=null;sessionStorage.removeItem('central_vias_auth');setBarConnection('Desconectado');$('authstatus').textContent='Sessão expirada. Abra a nuvem para entrar novamente.'}})();

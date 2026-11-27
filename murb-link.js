/* Supabase: chave publishable pública; acesso protegido por Auth + RLS. */
(function(){'use strict';
const $=id=>document.getElementById(id);
function backup(){
 const name=typeof murbPrincipalName==='function'?murbPrincipalName():'';
 if(!name)throw Error('Cadastre o nome do encarregado principal.');
 const d=JSON.parse(JSON.stringify(data));
 return {...d,teams:Array.isArray(d.teams)?d.teams:[],employees:Array.isArray(d.employees)?d.employees:[],moves:Array.isArray(d.moves)?d.moves:[],leader:{id:'fixed-admin',name},encarregadoPrincipal:name,encarregado:name,backupOwner:{id:'fixed-admin',name,role:'encarregado-principal'},leaderId:'fixed-admin',leaderName:name,backupCreatedAt:new Date().toISOString(),backupVersion:4};
}
async function copy(value,input){
 if(input){input.focus();input.select();input.setSelectionRange(0,input.value.length)}
 let ok=false;
 try{if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(value);ok=true}}catch(e){}
 if(!ok){try{ok=document.execCommand('copy')}catch(e){}}
 if(ok){alert('Cópia solicitada ao navegador. Confira se o texto foi colado por inteiro antes de salvar.')}else{alert('Cópia automática indisponível neste navegador. Use Selecionar tudo e Copiar, ou baixe o arquivo JSON compacto.')}
}
const SUPABASE_URL='https://cowddlbzohpxpteaitph.supabase.co';
const SUPABASE_KEY='sb_publishable_2LJ2dCsQfWx4afxc8SGX7g_AIK9zqZb';
const TOKEN_KEY='murb_supabase_session_v1';
const PENDING_KEY='murb_johnson_pending_v12';
const LAST_SYNC_KEY='murb_johnson_last_sync_v12';
const CONFLICT_KEY='murb_johnson_conflict_v15';
const OWNER_KEY='murb_johnson_sync_owner_v23';
const AUTO_BASE_KEY='murb_auto_cloud_baseline_v35';
const AUTO_FILE_KEY='murb_auto_cloud_filename_v35';
const AUTO_ERROR_KEY='murb_auto_cloud_error_v35';
let syncTimer=null, syncing=false;
let session=null;
function status(message){const e=$('murbLinkResult');if(e)e.textContent=message;}
function apiHeaders(token,extra={}){return {'apikey':SUPABASE_KEY,'Authorization':'Bearer '+token,...extra};}
async function api(path,opts={}){let res=await fetch(SUPABASE_URL+path,{...opts,mode:'cors'});let raw=await res.text(),value;try{value=JSON.parse(raw)}catch{value=raw}if(!res.ok)throw Error((value&& (value.msg||value.message||value.error_description||value.error))||('HTTP '+res.status));return value;}
let sessionRefreshPromise=null;
function readStoredSession(){
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(TOKEN_KEY)||'null')}catch{}
 if(!saved){try{saved=JSON.parse(sessionStorage.getItem(TOKEN_KEY)||'null')}catch{}}
 if(saved&&saved.access_token&&saved.refresh_token){
  try{localStorage.setItem(TOKEN_KEY,JSON.stringify(saved));sessionStorage.removeItem(TOKEN_KEY)}catch{}
  return saved;
 }
 return null;
}
function clearStoredSession(){session=null;localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY);window.dispatchEvent(new Event('murb-supabase-session-changed'));}
window.murbHasSupabaseSession=async function(){
 if(!navigator.onLine){const saved=readStoredSession();return !!(saved?.user?.id && window.murbAccountCurrent?.()===saved.user.id);}
 return !!(await getSession());
};
window.murbGetSupabaseSession=getSession;
async function getSession(){
 if(session&&session.expires_at>Date.now()/1000+90)return session;
 const saved=readStoredSession()||session;
 if(!saved)return null;
 if(saved.expires_at>Date.now()/1000+90){session=saved;return session;}
 if(!saved.refresh_token)return null;
 if(sessionRefreshPromise)return sessionRefreshPromise;
 sessionRefreshPromise=(async()=>{
  try{
   const v=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:saved.refresh_token})});
   return storeSession(v);
  }catch(e){
   // Do not sign out on temporary network errors. Only invalid refresh credentials end the session.
   if(/invalid.refresh.token|refresh.token.not.found|already.used|invalid.grant/i.test(String(e.message||'')))clearStoredSession();
   throw e;
  }finally{sessionRefreshPromise=null}
 })();
 return sessionRefreshPromise;
}
function storeSession(v){
 const newUid=v&&v.user&&v.user.id?String(v.user.id):null;
 if(!newUid)throw Error('Supabase não informou a identidade da conta.');
 const switched=window.murbAccountSwitch?window.murbAccountSwitch(newUid):false;
 session={access_token:v.access_token,refresh_token:v.refresh_token,expires_at:Math.floor(Date.now()/1000)+(v.expires_in||3600),user:v.user};
 localStorage.setItem(TOKEN_KEY,JSON.stringify(session));sessionStorage.removeItem(TOKEN_KEY);
 window.dispatchEvent(new Event('murb-supabase-session-changed'));
 if(switched){location.reload();return session;}
 setTimeout(()=>{murbAutoPull();flushPending();},500);
 return session;
}
async function login(){const email=prompt('E-mail cadastrado no Supabase:');if(email===null)return null;const password=prompt('Senha do Supabase (não será armazenada):');if(password===null)return null;const v=await api('/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});return storeSession(v);}
async function requireSession(){let s=await getSession();if(!s)s=await login();if(!s)throw Error('Acesso não iniciado.');const u=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});if(!u.id)throw Error('Usuário não identificado.');return {s,uid:u.id};}
function showLink(url){const el=$('murbLinkResult');el.replaceChildren();const input=document.createElement('input');input.readOnly=true;input.value=url;input.style.cssText='width:100%;padding:10px;margin:8px 0';el.append(input);const btn=document.createElement('button');btn.type='button';btn.textContent='📋 Copiar link';btn.onclick=()=>copy(url,input);el.append(btn);}
function queueSync(){
 try{localStorage.setItem(PENDING_KEY,JSON.stringify({updatedAt:new Date().toISOString()}));}catch(e){console.warn('Fila de backup não gravada',e);}
 clearTimeout(syncTimer);syncTimer=setTimeout(flushPending,4000);
}
async function flushPending(){
 if(syncing||murbAutoChecking||!navigator.onLine||!localStorage.getItem(PENDING_KEY)||localStorage.getItem(CONFLICT_KEY))return;
 syncing=true;
 try{
  const s=await getSession();if(!s)return; // sem senha salva; login explícito necessário
  const u=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});
  if(!u.id)return;
  if(window.murbAccountCurrent&&window.murbAccountCurrent()!==u.id)return;
  // Sincronização direta: não bloquear por divergência de versões.
  // Impedir apenas publicação cruzada entre contas distintas.
  if(localStorage.getItem(OWNER_KEY) && localStorage.getItem(OWNER_KEY)!==u.id){status('Conta diferente da vinculada a este navegador. Entre com a conta correta para enviar o Johnson.');return;}
  const pending=localStorage.getItem(PENDING_KEY);
  // A save without operational changes must not block reception.
  if(localStorage.getItem(AUTO_BASE_KEY)===murbDataFingerprint(data)){
   if(localStorage.getItem(PENDING_KEY)===pending)localStorage.removeItem(PENDING_KEY);
   setTimeout(murbAutoPull,0);return;
  }
  // Before publishing, compare the cloud head against the last confirmed baseline.
  // Never overwrite another device's changes without a verified common revision.
  const head=await murbLatestAuto(u.id,s.access_token);
  const lastFile=localStorage.getItem(AUTO_FILE_KEY);
  if(head && head.name!==lastFile){
   // Another device may have already published exactly this state.
   // Confirm receipt without overwriting the cloud or losing pending changes.
   const remoteHead=await murbReadAuto(head.name,u.id,s.access_token);
   if(murbPayloadEqual(remoteHead,data)){
    murbConfirmSynced(u.id,head.name,pending);return;
   }
   if(!lastFile){
    const remote=await murbReadAuto(head.name,u.id,s.access_token);
    if(murbPayloadEqual(remote,data)){
     localStorage.setItem(AUTO_FILE_KEY,head.name);
     localStorage.setItem(AUTO_BASE_KEY,murbDataFingerprint(data));
    }else{murbAutoWarning('Existem dados diferentes na nuvem. Envio pausado para proteger ambos os dispositivos.');return;}
   }else{murbAutoWarning('Outro dispositivo alterou a nuvem. Envio pausado para evitar perda de registros.');return;}
  }
  // If cloud has no newer revision but our queue is stale, verify the
  // last uploaded snapshot before creating a duplicate backup.
  if(head && head.name===lastFile){
   const remoteHead=await murbReadAuto(head.name,u.id,s.access_token);
   if(murbPayloadEqual(remoteHead,data)){
    murbConfirmSynced(u.id,head.name,pending);return;
   }
  }
  const sentFingerprint=murbDataFingerprint(data);const content=JSON.stringify(backup());const sentData=JSON.parse(JSON.stringify(data));const bytes=new Blob([content],{type:'application/json'});
  if(bytes.size>10*1024*1024){status('Backup pendente excede 10 MB; exporte JSON manualmente.');return;}
  const path=u.id+'/johnson-auto-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  await api('/storage/v1/object/murb-johnson/'+path,{method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json','x-upsert':'false'}),body:bytes});
  const uploadedName=path.split('/').pop();
  const verified=await murbReadAuto(uploadedName,u.id,s.access_token);
  if(!murbPayloadEqual(verified,sentData))throw Error('O Supabase não confirmou o conteúdo enviado.');
  localStorage.setItem(AUTO_FILE_KEY,uploadedName);
  localStorage.setItem(AUTO_BASE_KEY,sentFingerprint);
  localStorage.removeItem(AUTO_ERROR_KEY);
  if(localStorage.getItem(PENDING_KEY)===pending&&murbDataFingerprint(data)===sentFingerprint)localStorage.removeItem(PENDING_KEY);
  else queueSync();
  localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());
  localStorage.setItem(OWNER_KEY,u.id);
  localStorage.removeItem(CONFLICT_KEY);
  status('Alterações confirmadas no Supabase. '+new Date().toLocaleString('pt-BR'));
  setTimeout(murbAutoPull,800);
 }catch(e){murbAutoWarning('Envio pendente: '+e.message+'. Dados locais preservados.');}
 finally{syncing=false;setTimeout(murbRefreshConnectionIndicator,0);}
}
/* V35: recepção automática segura. O bucket de Johnson guarda snapshots, não
   transações; divergências sem ancestral comum exigem revisão humana. */
let murbAutoChecking=false;
function murbDataFingerprint(obj){
 const str=JSON.stringify(obj);let h=2166136261;
 for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
 return (h>>>0).toString(16)+':'+str.length;
}
function murbPayloadEqual(remote,local){
 // Compare operational state only. A backup includes timestamps and ownership
 // metadata that do not represent changes to the operational records.
 const keys=Object.keys(local).filter(k=>!['backupCreatedAt','backupVersion','backupOwner','leader','leaderId','leaderName','encarregado','encarregadoPrincipal'].includes(k));
 return keys.every(k=>JSON.stringify(remote[k])===JSON.stringify(local[k])) && JSON.stringify(remote.serviceHistory||[])===JSON.stringify(local.serviceHistory||[]);
}
function murbConfirmSynced(uid,filename,pending){
 localStorage.setItem(AUTO_FILE_KEY,filename);
 localStorage.setItem(AUTO_BASE_KEY,murbDataFingerprint(data));
 localStorage.setItem(OWNER_KEY,uid);
 localStorage.removeItem(AUTO_ERROR_KEY);
 if(localStorage.getItem(PENDING_KEY)===pending)localStorage.removeItem(PENDING_KEY);
 localStorage.removeItem(CONFLICT_KEY);
 localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());
 status('Dados confirmados na nuvem · '+new Date().toLocaleString('pt-BR'));
}

function murbAutoWarning(msg){
 localStorage.setItem(AUTO_ERROR_KEY,msg);status('⚠ Sincronização: '+msg);
 console.warn('[MURB Supabase]',msg);
}
async function murbLatestAuto(uid,token){
 const files=await api('/storage/v1/object/list/murb-johnson',{
  method:'POST',headers:apiHeaders(token,{'Content-Type':'application/json'}),
  body:JSON.stringify({prefix:uid+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})
 });
 return (Array.isArray(files)?files:[]).filter(f=>/^johnson-auto-[\w.-]+\.json$/.test(f.name)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0]||null;
}
async function murbReadAuto(name,uid,token){
 if(!/^johnson-auto-[\w.-]+\.json$/.test(name))throw Error('Nome de backup inválido');
 const r=await fetch(SUPABASE_URL+'/storage/v1/object/authenticated/murb-johnson/'+encodeURIComponent(uid)+'/'+encodeURIComponent(name),{headers:apiHeaders(token)});
 if(!r.ok)throw Error('Leitura do Supabase: HTTP '+r.status);
 const raw=await r.text();if(raw.length>10*1024*1024)throw Error('Backup muito grande');
 const obj=JSON.parse(raw);
 if(!obj||!Array.isArray(obj.teams)||!Array.isArray(obj.employees)||!Array.isArray(obj.moves))throw Error('Dados da nuvem inválidos');
 return obj;
}
function murbDetectUnsentChanges(){
 if(localStorage.getItem(CONFLICT_KEY))return;
 if(typeof data==='undefined'||!data)return;
 const baseline=localStorage.getItem(AUTO_BASE_KEY);
 const current=murbDataFingerprint(data);
 if(baseline&&baseline!==current&&!localStorage.getItem(PENDING_KEY)){
  queueSync();
 }
}
async function murbAutoPull(){
 if(murbAutoChecking||syncing||!navigator.onLine||typeof data==='undefined'||localStorage.getItem(CONFLICT_KEY))return;
 murbAutoChecking=true;
 try{
  const s=await getSession();if(!s)return;
  const u=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});
  if(!u.id)return;
  if(window.murbAccountCurrent&&window.murbAccountCurrent()!==u.id)return;
  const owner=localStorage.getItem(OWNER_KEY);
  if(owner&&owner!==u.id){murbAutoWarning('Conta Supabase diferente da vinculada a este navegador.');return;}
  const head=await murbLatestAuto(u.id,s.access_token);
  if(!head)return;
  if(head.name===localStorage.getItem(AUTO_FILE_KEY)&&localStorage.getItem(AUTO_BASE_KEY)===murbDataFingerprint(data)){
   const confirmed=await murbReadAuto(head.name,u.id,s.access_token);
   if(murbPayloadEqual(confirmed,data))murbConfirmSynced(u.id,head.name,localStorage.getItem(PENDING_KEY));
   return;
  }
  if(head.name===localStorage.getItem(AUTO_FILE_KEY))return;
  const stalePending=localStorage.getItem(PENDING_KEY);
  if(stalePending&&localStorage.getItem(AUTO_BASE_KEY)===murbDataFingerprint(data)){
   localStorage.removeItem(PENDING_KEY);
  }
  if(localStorage.getItem(PENDING_KEY)){
   // Pending does not imply divergence. Check whether the cloud already
   // contains precisely the same operational state before reporting conflict.
   const remotePending=await murbReadAuto(head.name,u.id,s.access_token);
   if(murbPayloadEqual(remotePending,data)){
    murbConfirmSynced(u.id,head.name,localStorage.getItem(PENDING_KEY));return;
   }
   // A genuinely different state is not safe to overwrite or auto-merge.
   murbAutoWarning('Alterações diferentes em aparelhos distintos. Dados preservados; requer conferência.');return;
  }
  const remote=await murbReadAuto(head.name,u.id,s.access_token);
  if(murbPayloadEqual(remote,data)){
   localStorage.setItem(AUTO_FILE_KEY,head.name);
   localStorage.setItem(AUTO_BASE_KEY,murbDataFingerprint(data));
   murbConfirmSynced(u.id,head.name,null);return;
  }
  const previous=localStorage.getItem(AUTO_BASE_KEY);
  const current=murbDataFingerprint(data);
  const empty=Array.isArray(data.teams)&&!data.teams.length&&Array.isArray(data.employees)&&!data.employees.length&&Array.isArray(data.moves)&&!data.moves.length;
  if(!empty&&(!previous||previous!==current)){
   murbAutoWarning('Dados locais e dados da nuvem diferentes. Recepção bloqueada para evitar substituição de registros.');return;
  }
  // Recheck immediately before replacement to protect a newly registered absence.
  if(localStorage.getItem(PENDING_KEY)||(!empty&&localStorage.getItem(AUTO_BASE_KEY)!==murbDataFingerprint(data))){
   murbAutoWarning('Uma alteração local surgiu durante a consulta. Recepção adiada para proteger os registros.');return;
  }
  // Keep the existing local schema and save a rollback copy before replacement.
  const old=localStorage.getItem(KEY);
  if(old)localStorage.setItem('murb_auto_rollback_v35',old);
  const next={...data};
  if(Array.isArray(remote.serviceHistory))next.serviceHistory=remote.serviceHistory;
  if(Array.isArray(remote.rankingTeamIds))next.rankingTeamIds=remote.rankingTeamIds;
  for(const k of Object.keys(data))if(Object.prototype.hasOwnProperty.call(remote,k))next[k]=remote[k];
  localStorage.setItem(KEY,JSON.stringify(next));
  data=next;
  localStorage.setItem(AUTO_FILE_KEY,head.name);
  localStorage.setItem(AUTO_BASE_KEY,murbDataFingerprint(next));
  localStorage.setItem(OWNER_KEY,u.id);
  localStorage.removeItem(AUTO_ERROR_KEY);
  localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());
  if(typeof renderAll==='function')renderAll();
  status('Atualização automática recebida do Supabase · '+new Date().toLocaleTimeString('pt-BR'));
 }catch(e){murbAutoWarning('Falha na consulta automática: '+e.message)}
 finally{murbAutoChecking=false;}
}
/* V1.6: consulta de integridade exclusivamente leitura, sem renovar sessão. */
window.murbSystemHealth=async function(){
 const rows=[]; const add=(label,value)=>rows.push([label,value]);
 const read=k=>localStorage.getItem(k); const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('pt-BR'):'Não disponível';
 add('Rede do dispositivo',navigator.onLine?'Disponível segundo navegador':'Offline');
 add('Fila local',read(PENDING_KEY)?'Alterações pendentes (quantidade não disponível)':'Sem pendência registrada');
 add('Sincronização',read(CONFLICT_KEY)?'Divergência bloqueante':read(AUTO_ERROR_KEY)?'Erro registrado':syncing?'Em andamento':read(PENDING_KEY)?'Pendente':'Sem alerta local registrado');
 add('Última referência local de sincronização',date(read(LAST_SYNC_KEY))+' (envio ou recebimento)');
 let saved=session; if(!saved){try{saved=JSON.parse(read(TOKEN_KEY)||sessionStorage.getItem(TOKEN_KEY)||'null')}catch{}}
 let cloud='Não consultado',johnson='Não verificado',marco='Não verificado';
 if(navigator.onLine&&saved?.access_token){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{const u=await api('/auth/v1/user',{headers:apiHeaders(saved.access_token),signal:controller.signal});if(!u?.id)throw Error('Sessão inválida');cloud='Autenticação confirmada';
   if(read(OWNER_KEY)&&read(OWNER_KEY)!==u.id){cloud+=' · conta diferente da referência local';}else{
    const files=await api('/storage/v1/object/list/murb-johnson',{method:'POST',headers:apiHeaders(saved.access_token,{'Content-Type':'application/json'}),body:JSON.stringify({prefix:u.id+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}}),signal:controller.signal});
    if(!Array.isArray(files))throw Error('Listagem indisponível');
    const latest=pattern=>{const f=files.find(x=>pattern.test(x.name||''));return f?date(f.created_at)+' · arquivo listado':files.length>=100?'Não localizado nos 100 primeiros':'Não localizado';};
    johnson=latest(/^johnson(?:-auto)?-[\w.-]+\.json$/);marco=latest(/^marco-zero-[\w.-]+\.json$/);
   }
  }catch(e){if(cloud==='Não consultado')cloud='Consulta indisponível ou sessão inválida';}finally{clearTimeout(timer);}
 }else cloud=navigator.onLine?'Aguardando login':'Offline';
 add('Conexão MURB',cloud);add('Backup Johnson',johnson);add('Marco Zero',marco);
 try{const q=await navigator.storage.estimate();add('Armazenamento da origem',Number.isFinite(q.usage)?(q.usage/1048576).toFixed(1)+' MB utilizados (estimativa)':'Não disponível');}catch{add('Armazenamento da origem','Não disponível');}
 add('Modo offline',navigator.serviceWorker?.controller?'Service worker ativo (cache não testado)':'Service worker não controla esta página');
 const n=performance.getEntriesByType('navigation')[0];add('Tempo de carregamento',n?.loadEventEnd>0?(n.loadEventEnd/1000).toFixed(2)+' s':'Não disponível');
 return rows;
};
window.murbAutoSyncDiagnostic=function(){return {
 connected:navigator.onLine,pending:!!localStorage.getItem(PENDING_KEY),
 latestFile:localStorage.getItem(AUTO_FILE_KEY),
 baseline:localStorage.getItem(AUTO_BASE_KEY),error:localStorage.getItem(AUTO_ERROR_KEY)
};};
setInterval(()=>{murbDetectUnsentChanges();if(localStorage.getItem(PENDING_KEY))flushPending();murbAutoPull();},10000);
window.addEventListener('online',()=>{flushPending();murbAutoPull();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)murbAutoPull();});
setTimeout(murbAutoPull,2500);

window.murbQueueJohnsonSync=queueSync;
window.addEventListener('online',flushPending);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)flushPending();});
setTimeout(flushPending,1200);

/* Marco Zero: recuperacao explicita do ultimo backup PRINCIPAL na pasta autenticada. */
window.murbRestoreLatestMarcoZero=async function(){
 const button=document.getElementById('murbMarcoZeroRestore');
 const message=document.getElementById('murbMarcoZeroMessage');
 const report=t=>{if(message)message.textContent=t;status(t);};
 if(button)button.disabled=true;
 try{
  if(syncing||murbAutoChecking)throw Error('Sincronizacao em andamento. Aguarde e tente novamente.');
  const {s,uid}=await requireSession();
  if(localStorage.getItem(OWNER_KEY)&&localStorage.getItem(OWNER_KEY)!==uid)throw Error('A conta conectada nao corresponde aos dados deste navegador.');
  const files=await api('/storage/v1/object/list/murb-johnson',{
   method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json'}),
   body:JSON.stringify({prefix:uid+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})
  });
  const candidates=(Array.isArray(files)?files:[])
   .filter(f=>/^marco-zero-[\w.-]+\.json$/.test(f.name))
   .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  if(!candidates.length)throw Error('Nenhum Marco Zero principal encontrado na pasta desta conta. Nenhum dado foi alterado.');
  const latest=candidates[0];
  const path=SUPABASE_URL+'/storage/v1/object/authenticated/murb-johnson/'+encodeURIComponent(uid)+'/'+encodeURIComponent(latest.name);
  const response=await fetch(path,{headers:apiHeaders(s.access_token)});
  if(!response.ok)throw Error('Nao foi possivel ler o backup: HTTP '+response.status);
  const blob=await response.blob();
  if(blob.size>10*1024*1024)throw Error('Backup acima de 10 MB.');
  const remote=JSON.parse(await blob.text());
  if(!remote||!Array.isArray(remote.teams)||!Array.isArray(remote.employees)||!Array.isArray(remote.moves))throw Error('Backup invalido; restauracao cancelada.');
  const stamp=latest.created_at?new Date(latest.created_at).toLocaleString('pt-BR'):'data nao informada';
  const summary=o=>'Equipes: '+o.teams.length+'; funcionarios: '+o.employees.length+'; movimentacoes: '+o.moves.length;
  if(!confirm('RESTAURAR ULTIMO MARCO ZERO?\n\nArquivo: '+latest.name+'\nSalvo em: '+stamp+'\n\nNA NUVEM: '+summary(remote)+'\nNESTE APARELHO: '+summary(data)+'\n\nA restauracao substitui os dados operacionais LOCAIS deste dispositivo. Outros aparelhos nao serao alterados automaticamente.')){
   report('Restauracao cancelada. Nenhum dado alterado.');return;
  }
  const snapshot=JSON.stringify(data);
  const backupName='murb-antes-restaurar-marco-zero-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  const url=URL.createObjectURL(new Blob([snapshot],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=backupName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  if(!confirm('Um download de seguranca dos dados atuais foi solicitado ('+backupName+').\n\nConfirme somente se salvou o arquivo e deseja prosseguir.')){
   report('Restauracao cancelada. Dados preservados.');return;
  }
  // Bloqueia envio e recebimento automatico durante a restauracao e revisao.
  localStorage.setItem(CONFLICT_KEY,JSON.stringify({reason:'marco-zero-restaurado-aguardando-revisao',detected_at:new Date().toISOString()}));
  clearTimeout(syncTimer);
  if(typeof window.murbRestoreJohnsonData!=='function')throw Error('Rotina de restauracao local indisponivel.');
  const restored=window.murbRestoreJohnsonData(remote);
  if(!restored){report('Restauracao nao concluida. Sincronizacao automatica bloqueada por seguranca; revise antes de continuar.');return;}
  localStorage.setItem(OWNER_KEY,uid);
  localStorage.removeItem(AUTO_BASE_KEY);
  localStorage.removeItem(AUTO_FILE_KEY);
  localStorage.setItem('murb-marco-zero-restaurado',JSON.stringify({name:latest.name,at:latest.created_at||null,restoredAt:new Date().toISOString()}));
  report('Marco Zero de '+stamp+' restaurado NESTE aparelho. Confira os dados. Para sincronizar com os outros dispositivos, use SALVAR NOVO MARCO ZERO.');
 }catch(e){report('Nao foi possivel restaurar Marco Zero: '+e.message);}
 finally{if(button)button.disabled=false;}
};

window.murbSaveMarcoZero=async function(){
 const msg=$('murbMarcoZeroMessage'),button=$('murbMarcoZeroSave');
 const report=t=>{if(msg)msg.textContent=t;status(t);};
 if(button)button.disabled=true;
 let locked=false;
 try{
  if(syncing)throw Error('Há um envio em andamento. Aguarde alguns segundos e tente novamente.');
  const {s,uid}=await requireSession();
  if(localStorage.getItem(OWNER_KEY)&&localStorage.getItem(OWNER_KEY)!==uid)throw Error('Conta Supabase diferente da vinculada a este navegador.');
  // Never silently discard an outstanding conflict from another device.
  const pendingBefore=localStorage.getItem(PENDING_KEY);
  const conflictBefore=localStorage.getItem(CONFLICT_KEY);
  const warningBefore=localStorage.getItem(AUTO_ERROR_KEY);
  if(pendingBefore||conflictBefore||warningBefore){
   if(!confirm('Este aparelho possui pendências ou divergências. Deseja publicar o estado DESTE APARELHO como novo Marco Zero central? Os dados diferentes de outros aparelhos NÃO serão mesclados automaticamente. Backups anteriores serão preservados.'))return;
  }
  syncing=true;locked=true;
  const payload=backup(),content=JSON.stringify(payload),bytes=new Blob([content],{type:'application/json'});
  if(bytes.size>10*1024*1024)throw Error('Backup ultrapassa o limite de 10 MB.');
  const stamp=new Date(),tag=stamp.toISOString().replace(/[:.]/g,'-');
  const headers=apiHeaders(s.access_token,{'Content-Type':'application/json','x-upsert':'false'});
  report('Enviando Marco Zero para o Supabase…');
  const path=uid+'/marco-zero-'+tag+'.json';
  await api('/storage/v1/object/murb-johnson/'+path,{method:'POST',headers,body:bytes});
  // The auto-sync readers discover only johnson-auto snapshots. Publish the
  // identical payload in that stream so other devices can receive this state.
  const autoName='johnson-auto-'+tag+'.json';
  await api('/storage/v1/object/murb-johnson/'+uid+'/'+autoName,{method:'POST',headers,body:bytes});
  const head=await murbLatestAuto(uid,s.access_token);
  if(!head||head.name!==autoName)throw Error('Marco Zero salvo, mas outro dispositivo publicou uma versão mais recente. Nenhuma pendência foi apagada.');
  const record={at:stamp.toISOString(),path,uid,autoName};
  localStorage.setItem('murb-marco-zero-confirmado',JSON.stringify(record));
  localStorage.setItem(AUTO_FILE_KEY,autoName);
  localStorage.setItem(AUTO_BASE_KEY,murbDataFingerprint(data));
  localStorage.setItem(OWNER_KEY,uid);
  localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());
  // Clear only unchanged pending entries. Do not erase edits made during upload.
  if(localStorage.getItem(PENDING_KEY)===pendingBefore)localStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(CONFLICT_KEY);localStorage.removeItem(AUTO_ERROR_KEY);
  const label=$('murbMarcoZeroLast');if(label)label.textContent=stamp.toLocaleString('pt-BR');
  report('Marco Zero confirmado no Supabase em '+stamp.toLocaleString('pt-BR')+'. Outros aparelhos receberão os dados se não tiverem alterações locais divergentes.');
 }catch(e){report('Marco Zero não totalmente sincronizado: '+e.message+' Verifique os backups antes de repetir.');}
 finally{if(locked)syncing=false;if(button)button.disabled=false;murbRefreshConnectionIndicator();}
};
function murbDisplayMarcoZero(){
 try{
  const v=JSON.parse(localStorage.getItem('murb-marco-zero-confirmado')||'null');
  if(v&&v.at&&$('murbMarcoZeroLast'))$('murbMarcoZeroLast').textContent=new Date(v.at).toLocaleString('pt-BR')+' (neste navegador)';
 }catch(e){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',murbDisplayMarcoZero);else murbDisplayMarcoZero();
window.murbPublishJohnson=async function(){
 try{
  const {s,uid}=await requireSession();const payload=backup();const content=JSON.stringify(payload);const bytes=new Blob([content],{type:'application/json'});
  if(bytes.size>10*1024*1024)throw Error('Johnson ultrapassa o limite de 10 MB do bucket.');
  // Envio manual direto, sem confirmação adicional ou comparação de versões.
  if(localStorage.getItem(OWNER_KEY) && localStorage.getItem(OWNER_KEY)!==uid)throw Error('Conta diferente da vinculada a este navegador.');
  status('Enviando Johnson para sua pasta privada…');
  const path=uid+'/johnson-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  await api('/storage/v1/object/murb-johnson/'+path,{method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json','x-upsert':'false'}),body:bytes});
  localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());localStorage.setItem(OWNER_KEY,uid);localStorage.removeItem(CONFLICT_KEY);
  const link='murb-johnson://'+path;status('Johnson enviado com sucesso.');showLink(link);
 }catch(e){status('Não foi possível enviar: '+e.message+'. Seus dados locais e o backup JSON offline permanecem disponíveis.');}
};
/* V13: recuperação controlada de backups, sem sobrescrever cadastros locais. */
window.murbListJohnsonBackups=async function(){
 try{
  const {s,uid}=await requireSession();
  status('Consultando backups privados…');
  const files=await api('/storage/v1/object/list/murb-johnson',{method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json'}),body:JSON.stringify({prefix:uid+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})});
  const list=Array.isArray(files)?files.filter(f=>f.name&&f.name.endsWith('.json')):[];
  const host=$('murbBackupList');if(!host)return;
  host.replaceChildren();
  if(!list.length){host.textContent='Nenhum backup JSON encontrado nesta pasta.';return;}
  // V34: lista compacta, cinco recentes e histórico completo sob demanda.
  const tabs=document.createElement('div');tabs.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px';
  const recent=document.createElement('button');recent.type='button';recent.textContent='Recentes (5)';
  const all=document.createElement('button');all.type='button';all.textContent='Histórico completo ('+list.length+')';
  tabs.append(recent,all);host.append(tabs);
  const info=document.createElement('p');info.textContent='A restauração substitui os dados locais. Faça um backup antes de restaurar.';host.append(info);
  const rows=document.createElement('div');host.append(rows);
  const render=(full)=>{
   rows.replaceChildren();
   recent.style.fontWeight=full?'normal':'bold';all.style.fontWeight=full?'bold':'normal';
   const subset=full?list:list.slice(0,5);
   for(const f of subset){
    const line=document.createElement('div');line.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px;margin:7px 0;border:1px solid var(--line);border-radius:10px';
    const label=document.createElement('div');label.style.cssText='flex:1 1 230px;min-width:0;overflow-wrap:anywhere';
    const kind=document.createElement('strong');kind.textContent=f.name.startsWith('johnson-auto-')?'Backup automático':'Backup manual';
    const date=document.createElement('div');date.style.cssText='font-size:12px;opacity:.75;margin-top:4px';date.textContent=(f.created_at?new Date(f.created_at).toLocaleString('pt-BR'):'Data indisponível')+' · '+f.name;
    label.append(kind,date);
    const btn=document.createElement('button');btn.type='button';btn.textContent='⬇ Baixar';btn.onclick=()=>window.murbDownloadJohnsonBackup(f.name);
    const preview=document.createElement('button');preview.type='button';preview.textContent='↺ Restaurar';preview.onclick=()=>window.murbPreviewCloudJohnson(f.name);
    line.append(label,btn,preview);rows.append(line);
   }
  };
  recent.onclick=()=>render(false);all.onclick=()=>render(true);render(false);
  status(list.length+' backup(s) encontrado(s) na pasta privada.');
 }catch(e){status('Não foi possível listar backups: '+e.message);}
};
window.murbDownloadJohnsonBackup=async function(name){
 try{
  if(!/^johnson(?:-auto)?-[a-zA-Z0-9_.-]+\.json$/.test(name))throw Error('Nome de arquivo inválido.');
  const {s,uid}=await requireSession();
  const path='/storage/v1/object/authenticated/murb-johnson/'+encodeURIComponent(uid)+'/'+encodeURIComponent(name);
  const response=await fetch(SUPABASE_URL+path,{headers:apiHeaders(s.access_token)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const blob=await response.blob();
  if(blob.size>10*1024*1024)throw Error('Arquivo acima de 10 MB.');
  const content=await blob.text();const obj=JSON.parse(content);
  if(!obj||typeof obj!=='object'||!Array.isArray(obj.teams)||!Array.isArray(obj.employees))throw Error('JSON não corresponde a um backup operacional esperado.');
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status('Backup baixado. Confira o conteúdo antes de restaurar manualmente. Os dados locais não foram alterados.');
 }catch(e){status('Falha ao baixar backup: '+e.message);}
};
/* V14: recuperação explícita e controlada. Nunca restaura silenciosamente. */
async function fetchJohnson(name){
 if(!/^johnson(?:-auto)?-[a-zA-Z0-9_.-]+\.json$/.test(name))throw Error('Nome inválido.');
 const {s,uid}=await requireSession();
 const response=await fetch(SUPABASE_URL+'/storage/v1/object/authenticated/murb-johnson/'+encodeURIComponent(uid)+'/'+encodeURIComponent(name),{headers:apiHeaders(s.access_token)});
 if(!response.ok)throw Error('Falha ao recuperar Johnson: HTTP '+response.status);
 const blob=await response.blob();if(blob.size>10*1024*1024)throw Error('Backup acima de 10 MB.');
 const obj=JSON.parse(await blob.text());
 if(!obj||typeof obj!=='object'||!Array.isArray(obj.teams)||!Array.isArray(obj.employees)||!Array.isArray(obj.moves))throw Error('Formato do Johnson inválido.');
 return obj;
}
/* V17: relatório de divergências, somente leitura. Sem mesclagem ou gravação. */
function murbStable(value){
 if(Array.isArray(value))return value.map(murbStable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,murbStable(value[k])]));
 return value;
}
function murbRecordTitle(item,kind,id){
 const parts=kind==='teams'?[item.name,item.nome,item.title]:kind==='employees'?[item.name,item.nome,item.fullName,item.nomeCompleto]:[item.type,item.tipo,item.description,item.descricao];
 const name=parts.find(v=>typeof v==='string'&&v.trim());
 return (name?String(name).trim():'Registro')+' [ID '+id+']';
}
function murbIndex(items){
 const map=new Map(),invalid=[];
 for(const item of items){
  const id=item&&item.id!=null&&String(item.id).trim()?String(item.id):null;
  if(!id){invalid.push('Registro sem ID');continue;}
  if(map.has(id))invalid.push('ID repetido: '+id);
  map.set(id,item);
 }
 return {map,invalid};
}
function murbValuePreview(v){
 if(v===undefined)return '(ausente)';
 if(v===null)return '(nulo)';
 const str=typeof v==='string'?v:JSON.stringify(v);
 return str.length>100?str.slice(0,100)+'…':str;
}
function murbCompareDetailed(localItems,remoteItems,kind){
 const a=murbIndex(localItems),b=murbIndex(remoteItems);
 const onlyLocal=[],onlyCloud=[],changed=[];let identical=0;
 for(const [id,v] of a.map){
  if(!b.map.has(id)){onlyLocal.push(murbRecordTitle(v,kind,id));continue;}
  const other=b.map.get(id);
  if(JSON.stringify(murbStable(v))===JSON.stringify(murbStable(other))){identical++;continue;}
  const keys=[...new Set([...Object.keys(v||{}),...Object.keys(other||{})])].sort();
  const differences=keys.filter(k=>JSON.stringify(murbStable(v?.[k]))!==JSON.stringify(murbStable(other?.[k])));
  changed.push({title:murbRecordTitle(v,kind,id),fields:differences,local:v,remote:other});
 }
 for(const [id,v] of b.map)if(!a.map.has(id))onlyCloud.push(murbRecordTitle(v,kind,id));
 return {onlyLocal,onlyCloud,changed,identical,invalidLocal:a.invalid,invalidCloud:b.invalid};
}
window.murbCompareCloudJohnson=async function(name){
 try{
  status('Comparando registros sem alterar dados…');
  const remote=await fetchJohnson(name),local=typeof data!=='undefined'?data:null;
  if(!local)throw Error('Dados locais indisponíveis.');
  const labels=[['teams','Equipes'],['employees','Funcionários'],['moves','Movimentações']];
  const lines=['COMPARAÇÃO V17 — DETALHES (SOMENTE LEITURA)',name,''];
  const maxExamples=25;
  for(const [key,label] of labels){
   const a=Array.isArray(local[key])?local[key]:[],b=Array.isArray(remote[key])?remote[key]:[];
   const c=murbCompareDetailed(a,b,key);
   lines.push('━━ '+label.toUpperCase()+' ━━');
   lines.push('Locais: '+a.length+' | Nuvem: '+b.length+' | Iguais: '+c.identical);
   lines.push('Somente local: '+c.onlyLocal.length+' | Somente nuvem: '+c.onlyCloud.length+' | Mesmo ID alterado: '+c.changed.length);
   function showList(title,items){
    if(!items.length)return;
    lines.push('',title+':');
    items.slice(0,maxExamples).forEach(v=>lines.push(' • '+v));
    if(items.length>maxExamples)lines.push(' ... e mais '+(items.length-maxExamples)+' registro(s).');
   }
   showList('Presentes apenas neste navegador (podem ser novos ou excluídos da nuvem)',c.onlyLocal);
   showList('Presentes apenas na nuvem (podem ser novos ou excluídos localmente)',c.onlyCloud);
   if(c.changed.length){
    lines.push('','Registros com campos diferentes:');
    for(const item of c.changed.slice(0,maxExamples)){
     lines.push(' • '+item.title);
     for(const field of item.fields.slice(0,8)){
      // Valores de campos podem conter informações pessoais; apresentar apenas os nomes
      // dos campos evita expor detalhes sensíveis num relatório visível no painel.
      lines.push('    Campo alterado: '+field);
     }
     if(item.fields.length>8)lines.push('    ... mais '+(item.fields.length-8)+' campo(s).');
    }
    if(c.changed.length>maxExamples)lines.push(' ... e mais '+(c.changed.length-maxExamples)+' registro(s) alterados.');
   }
   if(c.invalidLocal.length||c.invalidCloud.length){
    lines.push('ATENÇÃO: registros sem ID ou com ID duplicado — local '+c.invalidLocal.length+' / nuvem '+c.invalidCloud.length+'.');
   }
   lines.push('');
  }
  lines.push('Nenhum dado foi alterado. A ausência de um registro não comprova exclusão. Não há resolução automática de conflitos ou mesclagem.');
  const host=$('murbCompareResult');if(host){host.textContent=lines.join('\n');host.style.whiteSpace='pre-wrap';host.style.overflowWrap='anywhere';}
  status('Relatório detalhado concluído. Nenhum cadastro foi alterado.');
 }catch(e){status('Comparação não concluída: '+e.message);}
};
/* V18: inspeção campo a campo sem escrita ou mesclagem. */
function murbSideCell(value){
 if(value===undefined)return '(ausente)';
 if(value===null)return '(nulo)';
 try{const v=typeof value==='string'?value:JSON.stringify(value);return v.length>500?v.slice(0,500)+'… [truncado]':v;}catch{return '(valor indisponível)';}
}
window.murbCompareSideBySide=async function(name){
 try{
  status('Preparando visualização lado a lado, somente leitura…');
  const remote=await fetchJohnson(name),local=typeof data!=='undefined'?data:null;
  if(!local)throw Error('Dados locais indisponíveis.');
  const host=$('murbCompareResult');if(!host)throw Error('Área de comparação não encontrada.');
  host.replaceChildren();host.style.whiteSpace='normal';host.style.overflowWrap='anywhere';
  const title=document.createElement('h3');title.textContent='V18 — Valores lado a lado (somente leitura)';host.append(title);
  const info=document.createElement('p');info.textContent='Johnson: '+name+'. Nenhum dado será alterado. Campos podem conter dados pessoais: evite compartilhar capturas sem ocultar essas informações.';host.append(info);
  let totalChanged=0;
  for(const [kind,label] of [['teams','Equipes'],['employees','Funcionários'],['moves','Movimentações']]){
   const a=Array.isArray(local[kind])?local[kind]:[],b=Array.isArray(remote[kind])?remote[kind]:[];
   const c=murbCompareDetailed(a,b,kind);totalChanged+=c.changed.length;
   const section=document.createElement('section');section.style.cssText='margin:18px 0;border-top:1px solid #bbb;padding-top:12px';
   const h=document.createElement('h4');h.textContent=label+' — '+c.changed.length+' registros alterados';section.append(h);
   const summary=document.createElement('p');summary.textContent='Só neste navegador: '+c.onlyLocal.length+' | Só na nuvem: '+c.onlyCloud.length+' | Iguais: '+c.identical;section.append(summary);
   if(c.invalidLocal.length||c.invalidCloud.length){const warning=document.createElement('p');warning.textContent='ATENÇÃO: IDs ausentes ou repetidos; não faça mesclagem sem revisão.';section.append(warning);}
   const appendOnly=(caption,arr)=>{if(!arr.length)return;const d=document.createElement('details');const su=document.createElement('summary');su.textContent=caption+' ('+arr.length+')';d.append(su);const ul=document.createElement('ul');for(const item of arr){const li=document.createElement('li');li.textContent=item;ul.append(li)}d.append(ul);section.append(d);};
   appendOnly('Registros somente locais (não necessariamente novos)',c.onlyLocal);
   appendOnly('Registros somente na nuvem (não necessariamente excluídos)',c.onlyCloud);
   for(const item of c.changed){
    const d=document.createElement('details');d.style.cssText='margin:8px 0;padding:8px;border:1px solid #bbb;border-radius:8px';
    const su=document.createElement('summary');su.textContent=item.title+' — '+item.fields.length+' campo(s)';d.append(su);
    const wrap=document.createElement('div');wrap.style.cssText='overflow-x:auto;max-width:100%';
    const table=document.createElement('table');table.style.cssText='width:100%;min-width:440px;border-collapse:collapse;table-layout:fixed;font-size:13px';
    const head=document.createElement('tr');for(const txt of ['Campo','Neste navegador','Supabase']){const th=document.createElement('th');th.textContent=txt;th.style.cssText='border:1px solid #aaa;padding:6px;text-align:left';head.append(th)}table.append(head);
    for(const field of item.fields){const tr=document.createElement('tr');for(const v of [field,murbSideCell(item.local?.[field]),murbSideCell(item.remote?.[field])]){const td=document.createElement('td');td.textContent=v;td.style.cssText='border:1px solid #aaa;padding:6px;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap';tr.append(td)}table.append(tr)}
    wrap.append(table);d.append(wrap);section.append(d);
   }
   host.append(section);
  }
  const footer=document.createElement('p');footer.textContent='Somente leitura. '+totalChanged+' registro(s) com campos divergentes. Nenhum dado foi salvo, mesclado ou restaurado.';host.append(footer);
  status('Visualização V18 concluída. Nenhum cadastro alterado.');
 }catch(e){status('Falha na visualização V18: '+e.message);}
};
/* V19: plano de resolução, somente leitura. Não aplica alterações. */
window.murbPlanConflicts=async function(name){
 try{
  status('Preparando seleção segura de divergências…');
  const remote=await fetchJohnson(name),local=typeof data!=='undefined'?data:null;
  if(!local)throw Error('Dados locais indisponíveis.');
  const host=$('murbCompareResult');if(!host)throw Error('Área de comparação indisponível.');
  host.replaceChildren();host.style.whiteSpace='normal';host.style.overflowWrap='anywhere';
  const title=document.createElement('h3');title.textContent='V22 — Resolução assistida com auditoria pós-aplicação';host.append(title);
  const intro=document.createElement('p');intro.textContent='Escolha o destino de cada divergência. A opção padrão é Deixar pendente. Nenhuma seleção modifica o painel ou o Supabase. Ausência de registro não significa exclusão.';host.append(intro);
  const choices=[];
  const localSnapshot=JSON.stringify(local),remoteSnapshot=JSON.stringify(remote);
  const createChoice=(section,kind,id,localItem,cloudItem,label)=>{
   const wrap=document.createElement('div');wrap.style.cssText='border:1px solid #bbb;border-radius:10px;padding:10px;margin:10px 0;overflow-wrap:anywhere';
   const h=document.createElement('div');h.textContent=label;h.style.fontWeight='bold';wrap.append(h);
   const desc=document.createElement('p');desc.textContent='Local: '+(localItem?'presente':'ausente')+' | Supabase: '+(cloudItem?'presente':'ausente');wrap.append(desc);
   const protectedStatus=kind==='employees'&&localItem&&cloudItem&&String(localItem.status||'')!==String(cloudItem.status||'');
   const cloudUnavailable=!cloudItem;
   const choice={kind,id,decision:'pending',protectedStatus,cloudUnavailable};choices.push(choice);
   if(cloudUnavailable){const warning=document.createElement('p');warning.style.cssText='color:#9b351a;font-weight:600';warning.textContent='Registro presente somente neste navegador. A ausência no Johnson selecionado NÃO comprova exclusão. Usar Supabase foi desabilitado para impedir remoção; mantenha local ou pendente e confira o histórico antes de decidir.';wrap.append(warning)}
   if(protectedStatus){const warning=document.createElement('p');warning.style.cssText='color:#9b351a;font-weight:bold';warning.textContent='⚠ Situação funcional diferente ('+String(localItem.status||'não informado')+' / '+String(cloudItem.status||'não informado')+'). Resolução bloqueada nesta etapa: conferir desligamento, transferência ou afastamento.';wrap.append(warning)}
   const select=document.createElement('select');select.style.cssText='max-width:100%;padding:9px;border-radius:8px';
   for(const [value,text] of [['pending','Deixar pendente (recomendado)'],['local','Manter versão local'],['cloud','Usar versão do Supabase']]){
    const opt=document.createElement('option');opt.value=value;opt.textContent=text;select.append(opt);
   }
   if(protectedStatus){select.disabled=true;select.title='Situação funcional divergente: exige revisão fora da mesclagem automática.'}
   if(cloudUnavailable){const opt=[...select.options].find(o=>o.value==='cloud');if(opt){opt.disabled=true;opt.textContent='Usar Supabase — indisponível (registro ausente na nuvem)'}}
   select.onchange=()=>{choice.decision=select.value;refresh()};wrap.append(select);
   if(localItem&&cloudItem){
    const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Conferir campos diferentes';detail.append(summary);
    const fields=[...new Set([...Object.keys(localItem),...Object.keys(cloudItem)])].filter(k=>JSON.stringify(murbStable(localItem[k]))!==JSON.stringify(murbStable(cloudItem[k])));
    for(const field of fields){const p=document.createElement('p');p.textContent=field+' — Local: '+murbSideCell(localItem[field])+' | Supabase: '+murbSideCell(cloudItem[field]);detail.append(p)}wrap.append(detail);
   }
   section.append(wrap);
  };
  for(const [kind,label] of [['teams','Equipes'],['employees','Funcionários'],['moves','Movimentações']]){
   const localItems=Array.isArray(local[kind])?local[kind]:[],cloudItems=Array.isArray(remote[kind])?remote[kind]:[];
   const a=murbIndex(localItems),b=murbIndex(cloudItems);
   const section=document.createElement('section');section.style.cssText='border-top:1px solid #bbb;margin-top:16px;padding-top:10px';
   const h=document.createElement('h4');h.textContent=label;section.append(h);
   if(a.invalid.length||b.invalid.length){const w=document.createElement('p');w.textContent='ATENÇÃO: identificadores ausentes ou repetidos. Estes registros não podem ser selecionados com segurança.';section.append(w)}
   for(const id of new Set([...a.map.keys(),...b.map.keys()])){
    const l=a.map.get(id),r=b.map.get(id);
    if(l&&r&&JSON.stringify(murbStable(l))===JSON.stringify(murbStable(r)))continue;
    if(a.invalid.includes('ID repetido: '+id)||b.invalid.includes('ID repetido: '+id))continue;
    createChoice(section,kind,id,l,r,murbRecordTitle(l||r,kind,id));
   }
   host.append(section);
  }
  const summary=document.createElement('p');host.insertBefore(summary,host.children[2]||null);
  function refresh(){const localCount=choices.filter(c=>c.decision==='local').length,cloudCount=choices.filter(c=>c.decision==='cloud').length;summary.textContent='Total: '+choices.length+' divergências | Manter local: '+localCount+' | Usar Supabase: '+cloudCount+' | Pendentes: '+(choices.length-localCount-cloudCount)}
  refresh();
  const btn=document.createElement('button');btn.type='button';btn.textContent='⬇ Exportar plano de escolhas (JSON)';
  btn.onclick=()=>{
   const plan={format:'murb-conflict-plan-v19',sourceBackup:name,createdAt:new Date().toISOString(),warning:'PLANO DE SIMULAÇÃO. NÃO EXECUTAR COMO BACKUP OU RESTAURAÇÃO.',choices:choices.map(c=>({...c}))};
   const url=URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download='murb-plano-v19-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  };host.append(btn);
  const preview=document.createElement('div');preview.style.cssText='border:1px solid #bbb;border-radius:10px;padding:12px;margin-top:14px';host.append(preview);
  const apply=document.createElement('button');apply.type='button';apply.textContent='🔐 Conferir e aplicar escolhas seguras neste navegador';host.append(apply);
  function proposed(){
   const next=JSON.parse(localSnapshot);const changed=[];
   for(const c of choices){if(c.decision!=='cloud')continue;if(c.protectedStatus)throw Error('Situação funcional divergente exige revisão manual.');
    const list=next[c.kind],source=remote[c.kind]||[];
    const remoteItem=source.find(x=>String(x?.id)===String(c.id));
    if(!remoteItem)throw Error('Registro '+c.id+' está ausente no backup escolhido. Nenhuma exclusão será feita; deixe pendente ou mantenha local.');
    const index=list.findIndex(x=>String(x?.id)===String(c.id));
    if(index>=0)list[index]=JSON.parse(JSON.stringify(remoteItem));else list.push(JSON.parse(JSON.stringify(remoteItem)));
    changed.push(c.kind+': '+c.id);
   }
   return {next,changed};
  }
  function showPreview(){const {next,changed}=proposed();preview.replaceChildren();const h=document.createElement('strong');h.textContent='Prévia — '+changed.length+' registro(s) selecionado(s) da nuvem';preview.append(h);const p=document.createElement('p');p.textContent='Equipes: '+local.teams.length+' → '+next.teams.length+' | Funcionários: '+local.employees.length+' → '+next.employees.length+' | Movimentações: '+local.moves.length+' → '+next.moves.length+'. Registros ausentes na nuvem NÃO serão excluídos. Demais módulos permanecem locais.';preview.append(p);const details=document.createElement('details');const sm=document.createElement('summary');sm.textContent='Ver IDs selecionados';details.append(sm);const list=document.createElement('p');list.textContent=changed.join(' | ')||'Nenhuma alteração selecionada.';details.append(list);preview.append(details);return {next,changed}}
  // Atualiza a prévia ao mudar escolhas, sem escrever em armazenamento.
  host.querySelectorAll('select').forEach(sel=>sel.addEventListener('change',()=>{try{showPreview()}catch(e){preview.textContent=e.message}}));
  showPreview();
  apply.onclick=async()=>{try{
    const {next,changed}=showPreview();if(!changed.length)throw Error('Escolha pelo menos um registro da nuvem.');
    if(JSON.stringify(data)!==localSnapshot)throw Error('Os dados locais mudaram desde a comparação. Consulte novamente.');
    const currentRemote=await fetchJohnson(name);
    if(JSON.stringify(currentRemote)!==remoteSnapshot)throw Error('O backup remoto mudou. Refaça a comparação.');
    const backupName='murb-seguranca-antes-v21-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    const url=URL.createObjectURL(new Blob([localSnapshot],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=backupName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    if(!confirm('Foi solicitado o download do backup '+backupName+'. CONFIRME que ele foi salvo. Aplicar '+changed.length+' registro(s) selecionado(s) SOMENTE neste navegador? Nenhum dado será enviado automaticamente enquanto houver conflito.'))return;
    if(!confirm('ÚLTIMA CONFIRMAÇÃO: a mesclagem substitui integralmente os registros selecionados. Você conferiu os dados e guardou o backup?'))return;
    if(JSON.stringify(data)!==localSnapshot)throw Error('Dados locais alterados durante a confirmação.');
    if(typeof window.murbRestoreJohnsonData!=='function')throw Error('Restaurador local indisponível.');
    // A rotina original valida o Johnson e exige sua própria confirmação.
    const ok=window.murbRestoreJohnsonData(next);
    if(!ok)throw Error('Aplicação cancelada ou não concluída.');
    // V22: read the actual state after the existing restore routine finishes.
    const actual=typeof data!=='undefined'?data:null;
    if(!actual)throw Error('Restauração retornou sucesso, mas o estado não pôde ser auditado. Mantenha o backup.');
    const audit={format:'murb-v22-audit',createdAt:new Date().toISOString(),sourceBackup:name,
      selected:changed,passed:true,checks:[],warning:'Auditoria local; não comprova sincronização remota nem substitui conferência humana.'};
    const selectedIds=new Set(choices.filter(c=>c.decision==='cloud').map(c=>c.kind+':'+String(c.id)));
    for(const kind of ['teams','employees','moves']){
      const before=Array.isArray(local[kind])?local[kind]:[];
      const expected=Array.isArray(next[kind])?next[kind]:[];
      const after=Array.isArray(actual[kind])?actual[kind]:[];
      const byId=arr=>new Map(arr.map(item=>[String(item?.id),item]));
      const oldMap=byId(before),expectedMap=byId(expected),afterMap=byId(after);
      const allIds=new Set([...oldMap.keys(),...expectedMap.keys(),...afterMap.keys()]);
      for(const id of allIds){
        const chosen=selectedIds.has(kind+':'+id);
        const expectedValue=chosen?expectedMap.get(id):oldMap.get(id);
        const actualValue=afterMap.get(id);
        const equal=JSON.stringify(murbStable(expectedValue))===JSON.stringify(murbStable(actualValue));
        if(!equal){audit.passed=false;audit.checks.push({category:kind,id,selected:chosen,result:'DIVERGENTE'});}
      }
      if(after.length!==expected.length){audit.passed=false;audit.checks.push({category:kind,result:'CONTAGEM_DIVERGENTE',expected:expected.length,actual:after.length});}
    }
    audit.summary={checkedSelections:changed.length,unexpectedDifferences:audit.checks.length,
      teams:actual.teams?.length||0,employees:actual.employees?.length||0,moves:actual.moves?.length||0};
    const auditUrl=URL.createObjectURL(new Blob([JSON.stringify(audit,null,2)],{type:'application/json'}));
    const auditLink=document.createElement('a');auditLink.href=auditUrl;
    auditLink.download='murb-auditoria-v22-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    document.body.append(auditLink);auditLink.click();auditLink.remove();setTimeout(()=>URL.revokeObjectURL(auditUrl),60000);
    const auditBox=document.createElement('div');auditBox.style.cssText='border:1px solid #aaa;border-radius:10px;padding:12px;margin:12px 0';
    auditBox.textContent=audit.passed?'V22: auditoria local aprovada. '+changed.length+' registro(s) selecionado(s) conferido(s), sem diferenças inesperadas nas três listas. Relatório JSON solicitado para download.':'V22: ATENÇÃO! Auditoria encontrou '+audit.checks.length+' divergência(s) após a aplicação. NÃO continue editando; guarde o backup e o relatório para análise.';
    host.append(auditBox);
    localStorage.setItem(CONFLICT_KEY,JSON.stringify({reason:'v21-local-merge-requires-review',detected_at:new Date().toISOString()}));
    localStorage.removeItem(LAST_SYNC_KEY);
    status('V22: aplicação local concluída; auditoria '+(audit.passed?'aprovada':'com divergências')+'. Envio automático continua bloqueado. Confira o relatório e o painel.');
    apply.disabled=true;
   }catch(e){status('V22: '+e.message)}};
  const note=document.createElement('p');note.textContent='V22 aplica somente escolhas explícitas da nuvem neste navegador, após backup e confirmações. Não exclui registros, não mescla campos isolados e bloqueia mudanças de situação funcional. A publicação automática permanece suspensa até revisão.';host.append(note);
  status('Prévia V22 pronta. Nenhum cadastro foi alterado até a confirmação explícita.');
 }catch(e){status('Falha ao preparar plano V19: '+e.message)}
};
window.murbPreviewCloudJohnson=async function(name){
 try{
  status('Conferindo Johnson remoto…');
  const remote=await fetchJohnson(name);
  const local=typeof data!=='undefined'?data:null;
  const counts=o=>'Equipes: '+(o?.teams?.length||0)+'; funcionários: '+(o?.employees?.length||0)+'; movimentações: '+(o?.moves?.length||0);
  const msg='JOHNSON DO SUPABASE\n'+name+'\n'+counts(remote)+'\n\nDADOS DESTE APARELHO\n'+counts(local)+'\n\nA recuperação SUBSTITUI os cadastros locais e NÃO mescla alterações.\n\nDeseja iniciar o processo de restauração?';
  if(!confirm(msg)){status('Conferência concluída. Nenhum dado alterado.');return;}
  if(!local||typeof window.murbRestoreJohnsonData!=='function')throw Error('Restauração indisponível neste painel.');
  // Oferece download do estado atual ANTES de qualquer alteração.
  const current=JSON.stringify(local);
  const url=URL.createObjectURL(new Blob([current],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='murb-antes-da-restauracao-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  if(!confirm('O navegador solicitou o download de segurança dos dados atuais. CONFIRME que o arquivo foi salvo e que este aparelho não possui alterações pendentes importantes. Continuar?')){status('Restauração cancelada. Dados locais preservados.');return;}
  // O restaurador existente realiza uma última conferência de contagens e confirmação.
  const restored=window.murbRestoreJohnsonData(remote);
  if(restored){
   // Establish baseline only after a confirmed restore from the cloud.
   localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());
   const auth=await getSession();if(auth?.user?.id)localStorage.setItem(OWNER_KEY,auth.user.id);
   localStorage.removeItem(CONFLICT_KEY);
   // Do not automatically upload the restored snapshot; edits trigger the queue.
   localStorage.removeItem(PENDING_KEY);
  }
  status(restored?'Johnson restaurado após confirmações. Verifique as equipes e funcionários antes de editar em outro aparelho.':'Restauração cancelada ou não concluída.');
 }catch(e){status('Não foi possível conferir/restaurar: '+e.message);}
};
window.murbSyncDiagnosticV23=async function(){
 const pending=!!localStorage.getItem(PENDING_KEY),conflict=!!localStorage.getItem(CONFLICT_KEY);
 const baseline=localStorage.getItem(LAST_SYNC_KEY),owner=localStorage.getItem(OWNER_KEY);
 let msg='V23 — DIAGNÓSTICO (SOMENTE LEITURA)\n'+
 'Internet: '+(navigator.onLine?'disponível segundo navegador':'indisponível')+'\n'+
 'Alterações aguardando backup: '+(pending?'sim':'não')+'\n'+
 'Divergência bloqueante: '+(conflict?'sim':'não')+'\n'+
 'Referência local: '+(baseline?new Date(baseline).toLocaleString('pt-BR'):'ausente')+'\n'+
 'Conta vinculada: '+(owner?'sim':'ainda não registrada');
 try{const s=await getSession();if(s){const u=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});msg+='\nAutenticação: válida';if(owner&&owner!==u.id)msg+='\nALERTA: usuário diferente da referência local';
 const files=await api('/storage/v1/object/list/murb-johnson',{method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json'}),body:JSON.stringify({prefix:u.id+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})});
 const latest=Array.isArray(files)?files.find(f=>f.name&&f.name.endsWith('.json')):null;
 msg+='\nJohnson mais recente: '+(latest?.created_at?new Date(latest.created_at).toLocaleString('pt-BR'):'não encontrado');
 if(latest&&(!baseline||!latest.created_at||Date.parse(latest.created_at)>Date.parse(baseline)+2000))msg+='\nALERTA: nuvem mais recente ou referência ausente. Não publique.';
 }else msg+='\nAutenticação: sessão não iniciada';}catch(e){msg+='\nConsulta online indisponível: '+e.message;}
 msg+='\nNenhum cadastro foi alterado.';status(msg);
};
function installV23Button(){const target=$('murbLinkResult');if(!target||$('murbV23Diagnostic'))return;const b=document.createElement('button');b.id='murbV23Diagnostic';b.type='button';b.textContent='🛡️ V23 — Diagnóstico de sincronização';b.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';b.onclick=window.murbSyncDiagnosticV23;target.parentElement.insertBefore(b,target);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV23Button);else installV23Button();
/* V24: verificacao de fila offline, sem alterar dados nem remover conflitos. */
window.murbOfflineCheckV24=async function(){
 const pending=localStorage.getItem(PENDING_KEY), conflict=localStorage.getItem(CONFLICT_KEY);
 const owner=localStorage.getItem(OWNER_KEY), baseline=localStorage.getItem(LAST_SYNC_KEY);
 const online=navigator.onLine;
 let lines=['V24 — FILA OFFLINE (SOMENTE LEITURA)',
  'Conectividade informada pelo navegador: '+(online?'online':'offline'),
  'Backup local pendente: '+(pending?'sim':'não'),
  'Bloqueio por divergência: '+(conflict?'ativo':'não registrado'),
  'Referência local: '+(baseline||'ausente'),
  'Conta vinculada: '+(owner?'sim':'não'),
  'Nenhum dado foi enviado ou modificado.'];
 if(!online)lines.push('Sem internet: mantenha os dados neste navegador e exporte um JSON de segurança.');
 else if(conflict||!baseline||!owner)lines.push('Envio não deve ser liberado: confira as divergências e a referência antes de sincronizar.');
 else if(pending)lines.push('Há alterações pendentes; a publicação automática depende das verificações de segurança existentes.');
 status(lines.join('\n'));
};
window.murbDownloadOfflineSafetyV24=function(){
 try{
  const payload=backup();
  const content=JSON.stringify(payload,null,2);
  const blob=new Blob([content],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='murb-seguranca-offline-v24-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  status('Download de segurança solicitado. Confira se o arquivo JSON foi salvo. Nenhum cadastro foi alterado.');
 }catch(e){status('Não foi possível preparar o backup offline: '+e.message);}
};
function installV24Buttons(){
 const target=$('murbV23Diagnostic');if(!target||$('murbV24OfflineCheck'))return;
 const check=document.createElement('button');check.id='murbV24OfflineCheck';check.type='button';check.textContent='📡 V24 — Verificar fila offline';
 check.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';check.onclick=window.murbOfflineCheckV24;
 const download=document.createElement('button');download.id='murbV24OfflineSafety';download.type='button';download.textContent='⬇ V24 — Backup de segurança offline (JSON)';
 download.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';download.onclick=window.murbDownloadOfflineSafetyV24;
 target.insertAdjacentElement('afterend',check);check.insertAdjacentElement('afterend',download);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV24Buttons);else installV24Buttons();
/* V25: auditoria conservadora, somente leitura. Nunca altera o baseline,
   remove divergencias ou aciona a fila. */
window.murbAuditSyncV25=async function(){
 const pending=!!localStorage.getItem(PENDING_KEY);
 const rawConflict=localStorage.getItem(CONFLICT_KEY);
 const baseline=localStorage.getItem(LAST_SYNC_KEY);
 const owner=localStorage.getItem(OWNER_KEY);
 const lines=['V25 — AUDITORIA SEGURA (SOMENTE LEITURA)',
  'Fila offline: '+(pending?'pendente':'sem pendência registrada'),
  'Divergência: '+(rawConflict?'bloqueio registrado':'sem bloqueio registrado'),
  'Referência local: '+(baseline||'ausente'),
  'Conta vinculada: '+(owner?'registrada':'ausente')];
 let safe=false;
 try{
  const s=await getSession();
  if(!s){lines.push('Supabase: sessão não iniciada. Entre para verificar a nuvem.');}
  else {
   const user=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});
   if(!user.id)throw Error('Usuário não identificado');
   if(owner&&owner!==user.id)lines.push('ALERTA: conta autenticada diferente da conta vinculada.');
   const files=await api('/storage/v1/object/list/murb-johnson',{
    method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json'}),
    body:JSON.stringify({prefix:user.id+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})
   });
   const jsons=Array.isArray(files)?files.filter(f=>f.name&&f.name.endsWith('.json')):[];
   const latest=jsons[0];
   lines.push('Backups encontrados na consulta: '+jsons.length+(jsons.length===100?' (limite de 100; lista possivelmente incompleta)':''));
   lines.push('Backup mais recente: '+(latest?.created_at||'não identificado'));
   const localTime=baseline?Date.parse(baseline):NaN;
   const cloudTime=latest?.created_at?Date.parse(latest.created_at):NaN;
   if(latest&&(!Number.isFinite(localTime)||!Number.isFinite(cloudTime)||cloudTime>localTime+2000))
    lines.push('ALERTA: nuvem mais recente ou referência local ausente/inválida.');
   safe=!pending&&!rawConflict&&!!owner&&owner===user.id&&Number.isFinite(localTime)&&jsons.length<100&&(!latest||(Number.isFinite(cloudTime)&&cloudTime<=localTime+2000));
  }
 }catch(e){lines.push('Verificação remota não concluída: '+e.message);}
 lines.push(safe?'Indicadores consultados sem alerta; isso NÃO comprova ausência de divergências nos registros.':'Mantenha o envio bloqueado e confira os Johnsons antes de qualquer sincronização.');
 lines.push('Nenhum cadastro, referência, bloqueio ou backup foi alterado.');
 status(lines.join('\n'));
};
function installV25Button(){
 const target=$('murbV24OfflineSafety');if(!target||$('murbV25Audit'))return;
 const b=document.createElement('button');b.id='murbV25Audit';b.type='button';
 b.textContent='🛡️ V25 — Auditar conta e sincronização';
 b.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';
 b.onclick=window.murbAuditSyncV25;target.insertAdjacentElement('afterend',b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV25Button);else installV25Button();
/* V26: preflight de reconciliacao. Somente leitura; nenhuma referencia e criada. */
window.murbReconcilePreflightV26=async function(){
 const lines=['V26 — PRÉ-CONFERÊNCIA DE RECONCILIAÇÃO (SOMENTE LEITURA)'];
 const pending=!!localStorage.getItem(PENDING_KEY), conflict=!!localStorage.getItem(CONFLICT_KEY);
 const baseline=localStorage.getItem(LAST_SYNC_KEY), owner=localStorage.getItem(OWNER_KEY);
 lines.push('Fila offline: '+(pending?'pendente':'sem pendência registrada'));
 lines.push('Bloqueio por divergência: '+(conflict?'ativo':'não registrado'));
 lines.push('Referência de sincronização: '+(baseline||'ausente'));
 lines.push('Vínculo local de conta: '+(owner?'registrado':'ausente'));
 try{
  const s=await getSession();
  if(!s){lines.push('Autenticação: sessão não iniciada. Faça login e repita a conferência.');}
  else{
   const u=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});
   if(!u?.id)throw Error('Conta autenticada não identificada.');
   lines.push('Autenticação: válida');
   lines.push('Conta autenticada corresponde ao vínculo local: '+(!owner?'não verificável (vínculo ausente)':owner===u.id?'sim':'NÃO — conta diferente'));
   const files=await api('/storage/v1/object/list/murb-johnson',{method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json'}),body:JSON.stringify({prefix:u.id+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})});
   if(!Array.isArray(files))throw Error('Listagem remota inválida.');
   const list=files.filter(f=>f?.name&&/^johnson(?:-auto)?-[a-zA-Z0-9_.-]+\.json$/.test(f.name));
   list.sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
   lines.push('Backups visíveis: '+list.length+(files.length>=100?' (consulta limitada a 100 itens)':''));
   if(list.length){
    const latest=list[0];lines.push('Último Johnson: '+latest.name);
    lines.push('Criado em: '+(latest.created_at||'data indisponível'));
    const cloud=await fetchJohnson(latest.name);
    const local=typeof data!=='undefined'?data:null;
    if(!local)throw Error('Dados locais indisponíveis.');
    for(const [key,label] of [['teams','Equipes'],['employees','Funcionários'],['moves','Movimentações']]){
     const diff=murbCompareDetailed(local[key]||[],cloud[key]||[],key);
     lines.push(label+': local '+(local[key]||[]).length+' / nuvem '+(cloud[key]||[]).length+'; somente local '+diff.onlyLocal.length+'; somente nuvem '+diff.onlyCloud.length+'; campos divergentes '+diff.changed.length+'; iguais '+diff.identical);
    }
   }else lines.push('Nenhum Johnson encontrado; não é possível estabelecer referência automaticamente.');
  }
 }catch(e){lines.push('Consulta incompleta: '+e.message);}
 lines.push('DECISÃO: envio continua bloqueado quando há pendência, conflito ou referência ausente. Não foi criado vínculo ou baseline.');
 lines.push('Nenhum registro foi restaurado, mesclado, enviado ou excluído.');
 status(lines.join('\n'));
};
function installV26Button(){
 const target=$('murbV25Audit');if(!target||$('murbV26Preflight'))return;
 const b=document.createElement('button');b.id='murbV26Preflight';b.type='button';
 b.textContent='🛡️ V26 — Pré-conferir reconciliação segura';
 b.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';
 b.onclick=window.murbReconcilePreflightV26;target.insertAdjacentElement('afterend',b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV26Button);else installV26Button();
/* V27: vinculo de identidade explicito. NAO cria baseline, NAO remove conflito,
   NAO publica Johnson, NAO altera cadastros. */
window.murbBindAccountV27=async function(){
 const lines=['V27 — VINCULAÇÃO SEGURA DA CONTA'];
 try{
  const sess=await getSession();
  if(!sess)throw Error('Sessão Supabase não iniciada. Entre na conta e tente novamente.');
  const u=await api('/auth/v1/user',{headers:apiHeaders(sess.access_token)});
  if(!u?.id)throw Error('Não foi possível validar a identidade no Supabase.');
  const existing=localStorage.getItem(OWNER_KEY);
  if(existing&&existing!==u.id)throw Error('Este navegador já está vinculado a outra conta. Nenhuma alteração foi feita.');
  const files=await api('/storage/v1/object/list/murb-johnson',{
   method:'POST',headers:apiHeaders(sess.access_token,{'Content-Type':'application/json'}),
   body:JSON.stringify({prefix:u.id+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})
  });
  if(!Array.isArray(files))throw Error('A listagem de backups não pôde ser validada.');
  const jsons=files.filter(f=>f?.name&&f.name.endsWith('.json'));
  const pending=!!localStorage.getItem(PENDING_KEY),conflict=!!localStorage.getItem(CONFLICT_KEY);
  lines.push('Conta autenticada: '+(u.email||'e-mail não informado'));
  lines.push('Pasta privada confirmada: '+u.id+'/');
  lines.push('Backups JSON visíveis: '+jsons.length+(files.length>=100?' (listagem parcial)':''));
  lines.push('Fila offline: '+(pending?'pendente':'sem pendência registrada'));
  lines.push('Divergência: '+(conflict?'bloqueada':'sem bloqueio registrado'));
  lines.push('Referência de sincronização: '+(localStorage.getItem(LAST_SYNC_KEY)||'ausente'));
  if(existing===u.id){lines.push('Esta conta já está vinculada. Nenhuma alteração feita.');status(lines.join('\n'));return;}
  const ok=confirm('V27 — CONFIRMAR IDENTIDADE\n\nConta: '+(u.email||'não informada')+'\n\nVincular este navegador a esta conta Supabase?\n\nIsto NÃO sincroniza, NÃO cria referência, NÃO remove bloqueios e NÃO modifica cadastros. Confira se esta é a conta do encarregado responsável por estes dados.');
  if(!ok){lines.push('Vinculação cancelada. Nenhuma alteração.');status(lines.join('\n'));return;}
  // Uma vinculação de identidade não autoriza upload ou resolução de conflitos.
  localStorage.setItem(OWNER_KEY,u.id);
  lines.push('Conta vinculada com confirmação explícita.');
  lines.push('Envio permanece bloqueado quando houver pendência, divergência ou referência ausente.');
  lines.push('Nenhum cadastro, backup, referência ou bloqueio foi alterado.');
 }catch(e){lines.push('Não foi possível vincular: '+e.message);lines.push('Nenhuma sincronização foi autorizada.');}
 status(lines.join('\n'));
};
function installV27Button(){
 const target=$('murbV26Preflight');if(!target||$('murbV27BindAccount'))return;
 const b=document.createElement('button');b.id='murbV27BindAccount';b.type='button';
 b.textContent='🔐 V27 — Conferir e vincular conta Supabase';
 b.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';
 b.onclick=window.murbBindAccountV27;target.insertAdjacentElement('afterend',b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV27Button);else installV27Button();

/* V28: análise da referência candidata. Estritamente somente leitura.
   Não cria baseline, não altera vínculo, não libera envio e não restaura registros. */
window.murbReferenceReviewV28=async function(){
 const lines=['V28 — ANÁLISE DA REFERÊNCIA INICIAL (SOMENTE LEITURA)'];
 const owner=localStorage.getItem(OWNER_KEY);
 const baseline=localStorage.getItem(LAST_SYNC_KEY);
 const pending=!!localStorage.getItem(PENDING_KEY);
 const conflict=!!localStorage.getItem(CONFLICT_KEY);
 lines.push('Conta vinculada: '+(owner?'sim':'não'));
 lines.push('Referência existente: '+(baseline||'ausente'));
 lines.push('Fila offline: '+(pending?'pendente':'sem pendência'));
 lines.push('Divergência bloqueante: '+(conflict?'sim':'não'));
 try{
  const sess=await getSession();
  if(!sess)throw Error('Entre na conta Supabase para conferir os backups.');
  const user=await api('/auth/v1/user',{headers:apiHeaders(sess.access_token)});
  if(!user?.id)throw Error('Identidade não validada.');
  if(!owner||owner!==user.id)throw Error('Conta autenticada não corresponde a um vínculo local confirmado.');
  const files=await api('/storage/v1/object/list/murb-johnson',{
   method:'POST',headers:apiHeaders(sess.access_token,{'Content-Type':'application/json'}),
   body:JSON.stringify({prefix:user.id+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})
  });
  if(!Array.isArray(files))throw Error('Resposta de listagem inválida.');
  const list=files.filter(f=>f?.name&&/^johnson(?:-auto)?-[a-zA-Z0-9_.-]+\.json$/.test(f.name));
  list.sort((a,b)=>(Date.parse(b.created_at||'')||0)-(Date.parse(a.created_at||'')||0));
  lines.push('Backups encontrados: '+list.length+(files.length>=100?' (listagem parcial; não é seguro selecionar referência)':''));
  if(!list.length)throw Error('Nenhum Johnson disponível para comparação.');
  const latest=list[0];
  lines.push('Johnson candidato (mais recente na listagem): '+latest.name);
  lines.push('Data informada pelo Supabase: '+(latest.created_at||'não disponível'));
  const cloud=await fetchJohnson(latest.name);
  if(!cloud||typeof cloud!=='object')throw Error('Johnson inválido.');
  if(typeof data==='undefined'||!data)throw Error('Dados locais indisponíveis.');
  let differences=0;
  for(const [key,label] of [['teams','Equipes'],['employees','Funcionários'],['moves','Movimentações']]){
   const localRows=Array.isArray(data[key])?data[key]:[];
   const cloudRows=Array.isArray(cloud[key])?cloud[key]:[];
   const d=murbCompareDetailed(localRows,cloudRows,key);
   const count=d.onlyLocal.length+d.onlyCloud.length+d.changed.length;
   differences+=count;
   lines.push(label+': local '+localRows.length+' / nuvem '+cloudRows.length+
    ' | só local '+d.onlyLocal.length+' | só nuvem '+d.onlyCloud.length+
    ' | alterados '+d.changed.length+' | iguais '+d.identical);
  }
  lines.push('Total de registros divergentes nos três módulos: '+differences);
  if(differences||pending||conflict||!baseline||files.length>=100){
   lines.push('RESULTADO: NÃO APROVADO para sincronização automática. É necessário reconciliar os dados, revisar a fila e estabelecer referência segura em etapa posterior.');
  }else{
   lines.push('RESULTADO: sem divergências detectadas nestes três módulos; ainda NÃO é autorização para sincronizar. Outros módulos e a referência temporal precisam ser validados.');
  }
 }catch(e){lines.push('ANÁLISE INCOMPLETA: '+e.message);}
 lines.push('Nenhuma referência foi criada; nenhum registro foi alterado, restaurado, excluído ou enviado. Bloqueios preservados.');
 status(lines.join('\n'));
};
function installV28Button(){
 const target=$('murbV27BindAccount');
 if(!target||$('murbV28ReferenceReview'))return;
 const b=document.createElement('button');
 b.id='murbV28ReferenceReview';b.type='button';
 b.textContent='🛡️ V28 — Analisar referência inicial (somente leitura)';
 b.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';
 b.onclick=window.murbReferenceReviewV28;
 target.insertAdjacentElement('afterend',b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV28Button);
else installV28Button();

/* V29: relatório de reconciliação para revisão humana. Somente leitura. */
window.murbReconciliationV29=async function(){
 const lines=['V29 — MAPA DE RECONCILIAÇÃO (SOMENTE LEITURA)'];
 try{
  const sess=await getSession();
  if(!sess)throw Error('Primeiro clique em Entrar / verificar acesso Supabase.');
  const u=await api('/auth/v1/user',{headers:apiHeaders(sess.access_token)});
  if(!u?.id||localStorage.getItem(OWNER_KEY)!==u.id)
   throw Error('Confirme a conta vinculada na V27.');
  const files=await api('/storage/v1/object/list/murb-johnson',{
   method:'POST',headers:apiHeaders(sess.access_token,{'Content-Type':'application/json'}),
   body:JSON.stringify({prefix:u.id+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})
  });
  if(!Array.isArray(files)||files.length>=100)
   throw Error('Listagem incompleta. Não é seguro escolher um Johnson.');
  const backups=files.filter(f=>f?.name&&/^johnson(?:-auto)?-[a-zA-Z0-9_.-]+\.json$/.test(f.name))
   .sort((a,b)=>(Date.parse(b.created_at||'')||0)-(Date.parse(a.created_at||'')||0));
  if(!backups.length)throw Error('Nenhum Johnson encontrado.');
  const remote=await fetchJohnson(backups[0].name);
  if(typeof data==='undefined'||!data)throw Error('Dados locais indisponíveis.');
  lines.push('Johnson consultado: '+backups[0].name);
  lines.push('Esta análise não considera automaticamente a versão da nuvem como correta.');
  const modules=[['teams','EQUIPES'],['employees','FUNCIONÁRIOS'],['moves','MOVIMENTAÇÕES']];
  let total=0,critical=0;
  for(const [key,label] of modules){
   const a=Array.isArray(data[key])?data[key]:[];
   const b=Array.isArray(remote[key])?remote[key]:[];
   const d=murbCompareDetailed(a,b,key);
   const n=d.onlyLocal.length+d.onlyCloud.length+d.changed.length;
   total+=n;
   lines.push('',label+' — '+n+' diferenças');
   lines.push('Apenas neste navegador: '+d.onlyLocal.length+' | apenas na nuvem: '+d.onlyCloud.length+' | campos divergentes: '+d.changed.length);
   lines.push('Registros com ID ausente/repetido: local '+d.invalidLocal.length+' | nuvem '+d.invalidCloud.length);
   if(d.invalidLocal.length||d.invalidCloud.length)critical++;
   for(const [title,items] of [['SOMENTE LOCAL (não presumir inclusão ou exclusão)',d.onlyLocal],['SOMENTE NUVEM (não presumir inclusão ou exclusão)',d.onlyCloud]]){
    if(!items.length)continue;
    lines.push(title);
    items.slice(0,60).forEach(x=>lines.push(' • '+x));
    if(items.length>60)lines.push(' ... outros '+(items.length-60)+' registros');
   }
   if(d.changed.length){
    lines.push('MESMO ID COM CAMPOS DIFERENTES (conferência manual obrigatória)');
    for(const rec of d.changed.slice(0,60)){
     const sensitive=rec.fields.filter(f=>/status|situa|transf|demis|admis|afast|teamId|updatedAt|statusDate/i.test(f));
     if(sensitive.length)critical++;
     lines.push(' • '+rec.title+' — campos: '+rec.fields.join(', ')+(sensitive.length?' [ATENÇÃO: situação/histórico]':''));
    }
    if(d.changed.length>60)lines.push(' ... outros '+(d.changed.length-60)+' registros');
   }
  }
  lines.push('','TOTAL: '+total+' divergências | alertas de revisão prioritária: '+critical);
  lines.push('RECOMENDAÇÃO: conferir especialmente situações funcionais, transferências e registros exclusivos. Ausência em um Johnson não comprova exclusão.');
  lines.push('STATUS: sincronização NÃO autorizada. Nenhuma decisão foi aplicada.');
 }catch(e){lines.push('ANÁLISE INCOMPLETA: '+e.message);}
 lines.push('Nenhum dado, bloqueio, referência ou backup foi alterado.');
 status(lines.join('\n'));
};
function installV29Button(){
 const target=$('murbV28ReferenceReview');
 if(!target||$('murbV29Reconciliation'))return;
 const b=document.createElement('button');b.id='murbV29Reconciliation';b.type='button';
 b.textContent='🛡️ V29 — Conferir divergências por registro (somente leitura)';
 b.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';
 b.onclick=window.murbReconciliationV29;
 target.insertAdjacentElement('afterend',b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV29Button);
else installV29Button();

/* V30 — plano visual de reconciliação, sem escrita e sem persistência de decisões. */
window.murbReviewV30=async function(){
 const panel=$('murbV30Panel');if(!panel)return;
 panel.replaceChildren();
 const h=document.createElement('h3');h.textContent='V32 — Revisão com auditoria das escolhas';panel.append(h);
 const note=document.createElement('p');note.textContent='Somente revisão: não altera cadastros, não publica Johnson e não libera sincronização. Registros exclusivos são preservados no plano.';panel.append(note);
 const result=document.createElement('p');panel.append(result);
 const safe=v=>v===undefined?'(ausente)':v===null?'(nulo)':String(typeof v==='string'?v:JSON.stringify(v)).slice(0,300);
 try{
  const sess=await getSession();if(!sess)throw Error('Entre na conta Supabase primeiro.');
  const u=await api('/auth/v1/user',{headers:apiHeaders(sess.access_token)});
  if(!u?.id||localStorage.getItem(OWNER_KEY)!==u.id)throw Error('Conta diferente da vinculada na V27.');
  const files=await api('/storage/v1/object/list/murb-johnson',{method:'POST',headers:apiHeaders(sess.access_token,{'Content-Type':'application/json'}),body:JSON.stringify({prefix:u.id+'/',limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}})});
  if(!Array.isArray(files)||files.length>=100)throw Error('Listagem de backups incompleta.');
  const backups=files.filter(f=>f?.name&&/^johnson(?:-auto)?-[a-zA-Z0-9_.-]+\.json$/.test(f.name)).sort((a,b)=>(Date.parse(b.created_at||'')||0)-(Date.parse(a.created_at||'')||0));
  if(!backups.length)throw Error('Nenhum Johnson encontrado.');
  const remote=await fetchJohnson(backups[0].name);
  if(typeof data==='undefined'||!data)throw Error('Dados locais indisponíveis.');
  const local=JSON.parse(JSON.stringify(data)),cloud=JSON.parse(JSON.stringify(remote));
  const localTeams=new Map((local.teams||[]).filter(x=>x?.id).map(x=>[String(x.id),x.name||'(sem nome)']));
  const cloudTeams=new Map((cloud.teams||[]).filter(x=>x?.id).map(x=>[String(x.id),x.name||'(sem nome)']));
  const teamLabel=(id,side)=>{if(id===undefined||id===null||id==='')return safe(id);const m=side==='local'?localTeams:cloudTeams;return safe(id)+' — '+(m.get(String(id))||'equipe não localizada neste Johnson');};
  const display=(key,field,val,side)=>key==='employees'&&field==='teamId'?teamLabel(val,side):safe(val);
  const choices=new Map(),controls=new Map(),fieldInfo=new Map();let conflicts=0,exclusive=0,totalFields=0;
  const storeKey='murb_v32_review_'+u.id+'_'+backups[0].name;
  const reviewBox=document.createElement('div');reviewBox.style.cssText='border:2px solid #777;border-radius:10px;padding:12px;margin:12px 0';panel.append(reviewBox);
  const reviewHeading=document.createElement('h4');reviewHeading.textContent='Auditoria: escolhas realmente registradas';reviewBox.append(reviewHeading);
  const reviewList=document.createElement('div');reviewBox.append(reviewList);
  const recovery=document.createElement('p');recovery.textContent='A V32 confere os seletores reais ao exportar. Você pode importar um plano V31 para recuperar escolhas, mas revise-as antes de baixar a V32.';panel.append(recovery);
  const importInput=document.createElement('input');importInput.type='file';importInput.accept='.json,application/json';panel.append(importInput);
  const importStatus=document.createElement('p');panel.append(importStatus);
  const sub=document.createElement('p');sub.textContent='Johnson consultado: '+backups[0].name;panel.append(sub);
  for(const [key,label] of [['teams','Equipes'],['employees','Funcionários'],['moves','Movimentações']]){
   const aa=Array.isArray(local[key])?local[key]:[],bb=Array.isArray(cloud[key])?cloud[key]:[];
   const ia=murbIndex(aa),ib=murbIndex(bb);
   if(ia.invalid.length||ib.invalid.length)throw Error('IDs ausentes ou repetidos em '+label+'.');
   const section=document.createElement('section');section.style.cssText='border:1px solid #bbb;border-radius:12px;padding:12px;margin:14px 0';
   const title=document.createElement('h4');title.textContent=label;section.append(title);
   for(const id of new Set([...ia.map.keys(),...ib.map.keys()])){
    const lv=ia.map.get(id),rv=ib.map.get(id);
    if(lv===undefined||rv===undefined){
     exclusive++;const t=document.createElement('p');t.textContent='✓ Preservar '+(lv===undefined?'somente Supabase':'somente navegador')+': '+murbRecordTitle(lv===undefined?rv:lv,key,id);section.append(t);continue;
    }
    if(JSON.stringify(murbStable(lv))===JSON.stringify(murbStable(rv)))continue;
    conflicts++;
    const card=document.createElement('details');card.style.cssText='border:1px solid #ccc;border-radius:10px;padding:10px;margin:8px 0';
    const summary=document.createElement('summary');summary.textContent=murbRecordTitle(lv,key,id);card.append(summary);
    const fields=[...new Set([...Object.keys(lv),...Object.keys(rv)])].sort().filter(f=>JSON.stringify(murbStable(lv[f]))!==JSON.stringify(murbStable(rv[f])));
    for(const field of fields){
     totalFields++;
     const line=document.createElement('div');line.style.cssText='padding:10px 0;border-bottom:1px solid #ddd;overflow-wrap:anywhere';
     const labelEl=document.createElement('strong');labelEl.textContent=field;line.append(labelEl);
     const localText=document.createElement('p');localText.textContent='Navegador: '+display(key,field,lv[field],'local');line.append(localText);
     const cloudText=document.createElement('p');cloudText.textContent='Supabase: '+display(key,field,rv[field],'cloud');line.append(cloudText);
     if(key==='employees'&&field==='teamId'){
      const alert=document.createElement('p');alert.textContent='⚠ Confirme a equipe atual e o histórico de transferências antes de escolher.';line.append(alert);
     }
     const select=document.createElement('select');select.style.cssText='width:100%;max-width:100%;padding:10px;border-radius:8px';
     for(const [v,t] of [['pending','Pendente — não decidir'],['local','Manter campo do navegador (plano)'],['cloud','Usar campo do Supabase (plano)']]){
      const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o);
     }
     const choiceKey=key+':'+id+':'+field;
     controls.set(choiceKey,select);
     fieldInfo.set(choiceKey,{module:key,id,field,record:murbRecordTitle(lv,key,id),local:display(key,field,lv[field],'local'),cloud:display(key,field,rv[field],'cloud')});
     select.onchange=()=>{syncSelections();update();};
     line.append(select);card.append(line);
    }
    section.append(card);
   }
   panel.append(section);
  }
  function syncSelections(){
   choices.clear();
   for(const [k,select] of controls){if(select.value==='local'||select.value==='cloud'){
    const f=fieldInfo.get(k);choices.set(k,{module:f.module,id:f.id,field:f.field,choice:select.value});
   }}
  }
  function update(){
   syncSelections();result.textContent='Registros exclusivos preservados no plano: '+exclusive+' | registros conflitantes: '+conflicts+' | campos divergentes: '+totalFields+' | campos escolhidos: '+choices.size+' | campos pendentes: '+(totalFields-choices.size);
   reviewList.replaceChildren();
   if(!choices.size){const empty=document.createElement('p');empty.textContent='Nenhuma escolha registrada nesta tela.';reviewList.append(empty);}
   for(const [k,v] of choices){const info=fieldInfo.get(k),item=document.createElement('p');item.style.cssText='border-bottom:1px solid #bbb;padding:6px 0';item.textContent=info.record+' | '+v.field+' | '+(v.choice==='cloud'?'SUPABASE: '+info.cloud:'NAVEGADOR: '+info.local);reviewList.append(item);}
   try{localStorage.setItem(storeKey,JSON.stringify([...choices.values()]));}catch(e){importStatus.textContent='Aviso: não foi possível guardar escolhas no navegador; exporte seu plano.';}
  }
  function restore(list){
   if(!Array.isArray(list))throw Error('Lista de decisões inválida.');
   let restored=0,skipped=0;
   for(const d of list){if(!d||!['local','cloud'].includes(d.choice)){skipped++;continue;}
    const k=d.module+':'+d.id+':'+d.field,control=controls.get(k);
    if(!control){skipped++;continue;}
    control.value=d.choice;restored++;
   }
   update();return {restored,skipped};
  }
  try{const saved=JSON.parse(localStorage.getItem(storeKey)||'[]');if(saved.length){const n=restore(saved);importStatus.textContent='Escolhas locais V32 recuperadas: '+n.restored+'. Confira a auditoria.';}}catch(e){importStatus.textContent='Não foi possível recuperar escolhas locais: '+e.message;}
  importInput.onchange=async()=>{
   try{
    const f=importInput.files&&importInput.files[0];if(!f)return;
    const plan=JSON.parse(await f.text());
    if(![31,32].includes(plan.version)||plan.mode!=='review-only'||plan.cloudJohnson!==backups[0].name)throw Error('Plano incompatível com este Johnson. Nenhuma escolha importada.');
    const n=restore(plan.decisions);
    importStatus.textContent='Plano importado: '+n.restored+' escolhas correspondentes; '+n.skipped+' ignoradas. Confira a auditoria antes de exportar.';
   }catch(e){importStatus.textContent='IMPORTAÇÃO NÃO CONCLUÍDA: '+e.message;}
   importInput.value='';
  };
  update();
  const button=document.createElement('button');button.type='button';button.textContent='Baixar plano V32 (JSON — sem aplicar)';
  button.style.cssText='padding:12px;border-radius:10px;margin:12px 0';
  button.onclick=()=>{
   update();
   const audited=[...choices.values()].map(d=>{const i=fieldInfo.get(d.module+':'+d.id+':'+d.field);return {...d,record:i.record,selectedValue:d.choice==='cloud'?i.cloud:i.local};});
   const plan={version:32,mode:'review-only',createdAt:new Date().toISOString(),cloudJohnson:backups[0].name,cloudCreatedAt:backups[0].created_at,exclusivePreserved:exclusive,conflicts,fieldConflicts:totalFields,decisions:audited,pendingFields:totalFields-audited.length,warning:'Plano apenas para revisão. NÃO importar como Johnson. Não executa mesclagem nem autoriza sincronização.'};
   const blob=new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='murb-v32-plano-auditado.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };panel.append(button);
  const foot=document.createElement('p');foot.textContent='As decisões da V32 são mantidas neste navegador quando possível e auditadas no momento da exportação. Nenhum registro, referência ou bloqueio é alterado.';panel.append(foot);
 }catch(e){result.textContent='ANÁLISE INCOMPLETA: '+e.message;}
};
function installV30(){
 const target=$('murbV29Reconciliation');if(!target||$('murbV30Review'))return;
 const b=document.createElement('button');b.id='murbV30Review';b.type='button';b.textContent='🛡️ V32 — Conferir e auditar escolhas';
 b.style.cssText='display:block;margin:12px 0;padding:12px;border-radius:10px';b.onclick=window.murbReviewV30;
 const panel=document.createElement('div');panel.id='murbV30Panel';panel.style.cssText='max-width:100%;overflow-wrap:anywhere';
 target.insertAdjacentElement('afterend',b);b.insertAdjacentElement('afterend',panel);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV30);else installV30();
// V38.6: in-page Supabase login for mobile browsers (no prompt() dependency).
window.murbOpenSupabaseLogin=function(){
 const modal=document.getElementById('murbSupabaseLoginModal');
 if(!modal){status('Formulário de login não encontrado.');return;}
 modal.hidden=false;modal.style.display='flex';
 const feedback=document.getElementById('murbSupabaseLoginFeedback');
 if(feedback)feedback.textContent='';
 const email=document.getElementById('murbSupabaseEmail');
 if(email)email.focus();
};
window.murbCloseSupabaseLogin=function(){
 const modal=document.getElementById('murbSupabaseLoginModal');
 if(modal){modal.hidden=true;modal.style.display='none';}
 const password=document.getElementById('murbSupabasePassword');
 if(password)password.value='';
};
function murbInstallSupabaseLoginForm(){
 const form=document.getElementById('murbSupabaseLoginForm');
 if(!form||form.dataset.bound)return;
 form.dataset.bound='1';
 form.addEventListener('submit',async function(event){
  event.preventDefault();
  const email=document.getElementById('murbSupabaseEmail').value.trim();
  const password=document.getElementById('murbSupabasePassword').value;
  const feedback=document.getElementById('murbSupabaseLoginFeedback');
  const button=document.getElementById('murbSupabaseLoginSubmit');
  if(!email||!password)return;
  button.disabled=true;feedback.textContent='Autenticando no Supabase…';
  try{
   const result=await api('/auth/v1/token?grant_type=password',{
    method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
   });
   if(!result||!result.access_token)throw Error('O Supabase não retornou uma sessão válida.');
   storeSession(result);
   feedback.textContent='Login confirmado. Consultando sincronização…';
   window.murbCloseSupabaseLogin();
   if(window.murbRefreshConnectionIndicator)window.murbRefreshConnectionIndicator();
   status('Login Supabase confirmado. Verificando dados da nuvem…');
  }catch(err){feedback.textContent='Não foi possível entrar: '+(err&&err.message?err.message:'Erro desconhecido');}
  finally{button.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',murbInstallSupabaseLoginForm);
else murbInstallSupabaseLoginForm();
window.murbSupabaseLogout=async function(){const s=navigator.onLine?await getSession():null;if(s)try{await api('/auth/v1/logout',{method:'POST',headers:apiHeaders(s.access_token)})}catch{}clearStoredSession();if(window.murbAccountSwitch)window.murbAccountSwitch(null);location.reload();};
// Visual status: green only after an authenticated request succeeds.
let murbIndicatorBusy=false;
async function murbRefreshConnectionIndicator(){
 const node=$('murbSupabaseIndicator');if(!node||murbIndicatorBusy)return;
 const dot=$('murbSupabaseDot'),label=$('murbSupabaseLabel'),detail=$('murbSupabaseDetail');
 const set=(color,msg,extra)=>{dot.style.background=color;dot.style.boxShadow='0 0 9px '+color;label.textContent=msg;detail.textContent=extra||'';};
 if(!navigator.onLine){set('#f87171','Desconectado','Sem internet');return;}
 murbIndicatorBusy=true;
 set('#fbbf24','Verificando conexão','Consultando Supabase…');
 try{
  const s=await getSession();
  if(!s){set('#fbbf24','Aguardando login','Entre na Central Johnson');return;}
  const u=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});
  if(!u||!u.id){set('#f87171','Falha de autenticação','Sessão não validada');return;}
  const problem=localStorage.getItem(AUTO_ERROR_KEY)||localStorage.getItem(CONFLICT_KEY);
  const pending=localStorage.getItem(PENDING_KEY);
  if(problem||pending){set('#fbbf24','Sincronização pendente',problem?'Verifique o diagnóstico':'Alterações aguardando envio');return;}
  const baseline=localStorage.getItem(AUTO_BASE_KEY);
  if(!baseline||typeof data==='undefined'||baseline!==murbDataFingerprint(data)){
   set('#fbbf24','Supabase online · dados não confirmados','Verificando envio dos registros');return;
  }
  set('#6af59c','Supabase · envio confirmado','Última confirmação: '+(localStorage.getItem(LAST_SYNC_KEY)?new Date(localStorage.getItem(LAST_SYNC_KEY)).toLocaleString('pt-BR'):'não disponível'));
 }catch(e){set('#f87171','Sem comunicação','Falha ao verificar Supabase');}
 finally{murbIndicatorBusy=false;}
}
window.murbRefreshConnectionIndicator=murbRefreshConnectionIndicator;
setTimeout(murbRefreshConnectionIndicator,1400);
setInterval(murbRefreshConnectionIndicator,15000);
window.addEventListener('online',murbRefreshConnectionIndicator);
window.addEventListener('offline',murbRefreshConnectionIndicator);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)murbRefreshConnectionIndicator();});
window.murbSupabaseStatus=async function(){
 const host=$('murbMarcoZeroMessage');
 const report=t=>{status(t);if(host)host.textContent=t;};
 try{
  const s=await getSession();if(!s){report('Sem sessão Supabase. Entre na conta autorizada.');return;}
  const u=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});
  if(!u.id)throw Error('Sessão não identificada');
  const pending=!!localStorage.getItem(PENDING_KEY),error=localStorage.getItem(AUTO_ERROR_KEY);
  const head=await murbLatestAuto(u.id,s.access_token);
  report('Supabase autenticado. Alterações locais: '+(pending?'pendentes':'sem fila')+'. Último envio: '+(localStorage.getItem(LAST_SYNC_KEY)?new Date(localStorage.getItem(LAST_SYNC_KEY)).toLocaleString('pt-BR'):'não registrado')+'. Nuvem: '+(head?'backup disponível':'sem backup automático')+'. '+(error?'Diagnóstico: '+error:'Sem erro de recepção registrado.')+' Dados não foram apagados.');
  if(pending){await flushPending();await murbAutoPull();}
  await murbRefreshConnectionIndicator();
 }catch(e){report('Falha na verificação: '+e.message+'. Dados locais preservados.');}
};

/* V6.22.4: aplica alterações pendentes do administrador, sem apagar backups. */
let murbAdminQueueBusy=false;
async function murbAdminReceiveQueue(){
 if(murbAdminQueueBusy||!navigator.onLine||typeof data==='undefined'||!Array.isArray(data.employees))return;
 if(localStorage.getItem(PENDING_KEY)||localStorage.getItem(CONFLICT_KEY)||syncing)return;
 murbAdminQueueBusy=true;
 try{
  const s=await getSession();if(!s)return;
  const u=await api('/auth/v1/user',{headers:apiHeaders(s.access_token)});
  if(!u?.id||localStorage.getItem(OWNER_KEY)&&localStorage.getItem(OWNER_KEY)!==u.id)return;
  const rows=await api('/rest/v1/rpc/murb_operational_pending_changes',{method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json'}),body:'{}'});
  if(!Array.isArray(rows))return;
  for(const row of rows){
   if(localStorage.getItem(PENDING_KEY)||localStorage.getItem(CONFLICT_KEY))break;
   const employee=data.employees.find(e=>String(e.id)===String(row.employee_id));
   if(!employee){status('Edição administrativa pendente: funcionário não encontrado.');continue;}
   const patch=row.patch||{};
   if(Object.keys(patch).some(k=>!['name','role','teamId'].includes(k))){status('Edição administrativa com campos não reconhecidos.');continue;}
   if(patch.teamId!==undefined&&!data.teams.some(t=>String(t.id)===String(patch.teamId))){status('Transferência pendente: equipe de destino inexistente.');continue;}
   const prev=JSON.stringify(data);
   try{
    for(const k of ['name','role','teamId'])if(Object.prototype.hasOwnProperty.call(patch,k))employee[k]=patch[k];
    employee.updatedAt=new Date().toISOString().slice(0,10);
    if(typeof save!=='function'||save()===false)throw Error('Falha no salvamento local');
    queueSync();
    await flushPending();
    if(localStorage.getItem(PENDING_KEY)||localStorage.getItem(CONFLICT_KEY))throw Error('Backup Johnson ainda não confirmado; alteração segue pendente');
    await api('/rest/v1/rpc/murb_operational_ack_change',{method:'POST',headers:apiHeaders(s.access_token,{'Content-Type':'application/json'}),body:JSON.stringify({p_id:row.id,p_applied:true,p_note:'Gravado e backup Johnson confirmado'})});
    status('Alteração administrativa aplicada e sincronizada.');
   }catch(err){
    // Nunca desfazer uma edição local que pode ter sido gravada; manter a fila pendente.
    status('Alteração administrativa ainda pendente: '+err.message);
    break;
   }
  }
 }catch(e){if(!/404|function.*does not exist/i.test(e.message))status('Fila administrativa: '+e.message);}
 finally{murbAdminQueueBusy=false;}
}
setInterval(murbAdminReceiveQueue,15000);
window.addEventListener('online',murbAdminReceiveQueue);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)murbAdminReceiveQueue();});
setTimeout(murbAdminReceiveQueue,8000);
})();

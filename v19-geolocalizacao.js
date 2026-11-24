
(function(){
 'use strict';
 var panel=document.getElementById('murbGeoPanel'),records=[],map=null,markers=null,markerById=new Map(),storageKey='murbx_geo_records_v1',previewMarker=null,pending=null,lastGps=null,gpsBusy=false,linkedRecords=[],confirmTarget=null,confirmMarker=null;
 var el=function(id){return document.getElementById(id)};
 function note(s){el('murbGeoFeedback').textContent=s}
 function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
 function teams(){try{return typeof window.centralGeoTeams==='function'?window.centralGeoTeams():[]}catch(e){return []}}
 function teamName(t){return String(t.name||t.nome||t.code||t.sigla||t.id||'').trim()}
 function fiscalName(t){return String(t.lead||t.fiscal||t.supervisor||t.responsavel||t.inspector||t.fiscalName||'').trim()}
 function currentTeam(){return teams().find(function(t){return String(t.id)===el('murbGeoTeamSelect').value})}
 function refreshTeams(){
  var sel=el('murbGeoTeamSelect'),selected=sel.value;sel.replaceChildren();
  var first=document.createElement('option');first.value='';first.textContent='Selecione uma equipe';sel.appendChild(first);
  teams().forEach(function(t){var o=document.createElement('option');o.value=String(t.id);o.textContent=teamName(t);sel.appendChild(o)});
  sel.value=selected;updateFiscal();
 }
 function updateFiscal(){var t=currentTeam();el('murbGeoFiscalAuto').textContent=t?(fiscalName(t)||'Fiscal não informado no cadastro'):'Selecione a equipe'}
 function load(){try{var saved=JSON.parse(localStorage.getItem(storageKey)||'[]');records=Array.isArray(saved)?saved:[]}catch(e){records=[]}}
 function persist(){localStorage.setItem(storageKey,JSON.stringify(records))}
 function leaflet(){
  if(window.L&&window.L.map)return Promise.resolve(window.L);
  if(window.murbGeoLeafletPromise)return window.murbGeoLeafletPromise;
  window.murbGeoLeafletPromise=new Promise(function(resolve,reject){
   if(!document.getElementById('murbGeoLeafletCss')){var css=document.createElement('link');css.id='murbGeoLeafletCss';css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css)}
   var js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.onload=function(){window.L?resolve(window.L):reject(Error('Biblioteca de mapa não disponível'))};js.onerror=function(){reject(Error('Sem conexão para carregar o mapa'))};document.head.appendChild(js);
  }).catch(function(err){window.murbGeoLeafletPromise=null;throw err});
  return window.murbGeoLeafletPromise;
 }
 function safeText(node,value){node.textContent=String(value||'')}
 function statusName(s){return {naoiniciada:'Não iniciado',andamento:'Em andamento',concluida:'Concluído'}[s]||s||'Não iniciado'}
 function statusColor(s){return {naoiniciada:'#9299A3',andamento:'#F28C28',concluida:'#16A34A'}[s]||'#9299A3'}
 function popup(r){
  var box=document.createElement('div');box.className='geo-popup';
  var title=document.createElement('strong');safeText(title,r.team||'Equipe não informada');box.appendChild(title);
  var rows=['Fiscal: '+(r.fiscal||'Não informado'),r.service?'Serviço: '+r.service:'',r.status?'Situação: '+statusName(r.status):'',[r.street,r.neighborhood,r.zip].filter(Boolean).join(' • '),[r.date,r.time].filter(Boolean).join(' '),r.source==='gps'?'GPS • precisão estimada '+Math.round(r.accuracy||0)+' m':(r.source==='coordenadas-manuais'?'Coordenadas informadas manualmente':'')];
  rows.forEach(function(v){if(v){var p=document.createElement('div');safeText(p,v);box.appendChild(p)}});
  if(r.photo){var img=document.createElement('img');img.src=r.photo;img.alt='Fotografia do registro';img.title='Toque para ampliar a fotografia';img.addEventListener('click',function(){var overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#000e;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out';var large=document.createElement('img');large.src=r.photo;large.alt='Fotografia ampliada';large.style.cssText='max-width:96vw;max-height:92vh;object-fit:contain';overlay.appendChild(large);overlay.addEventListener('click',function(){overlay.remove()});document.body.appendChild(overlay)});box.appendChild(img)}
  return box;
 }
 function programRecords(){
  var programs=typeof window.centralGeoPrograms==='function'?window.centralGeoPrograms():[];
  return programs.map(function(p){
   var lat=Number(p.lat),lon=Number(p.lng),hasCoords=p.lat!==null&&p.lat!==undefined&&p.lat!==''&&p.lng!==null&&p.lng!==undefined&&p.lng!==''&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
   return {id:'program-'+p.id,team:p.team,fiscal:p.fiscal,street:p.address,neighborhood:p.area,date:p.date,service:p.service,status:p.status,lat:hasCoords?lat:null,lon:hasCoords?lon:null,link:p.mapLink||'',source:'programacao',active:true};
  });
 }
 function startConfirm(r){
  confirmTarget=r;
  el('murbGeoConfirmName').textContent=(r.street||'Local')+' • '+(r.team||'Equipe');
  el('murbGeoConfirmHelp').textContent='Abra o link do Google Maps, confira o local e depois toque no ponto exato deste mapa. O marcador de prévia não será salvo até você confirmar.';
  el('murbGeoConfirmPanel').hidden=false;
  el('murbGeoConfirmSave').disabled=true;
  if(confirmMarker&&map){map.removeLayer(confirmMarker);confirmMarker=null}
  if(r.link){el('murbGeoConfirmOpen').hidden=false;el('murbGeoConfirmOpen').href=r.link}
  else el('murbGeoConfirmOpen').hidden=true;
  el('murbGeoMap').scrollIntoView({behavior:'smooth',block:'center'});
  if(map){setTimeout(function(){map.invalidateSize()},100)}
 }
 function cancelConfirm(){
  confirmTarget=null;el('murbGeoConfirmPanel').hidden=true;
  if(confirmMarker&&map){map.removeLayer(confirmMarker);confirmMarker=null}
 }
 function syncPrograms(){
  linkedRecords=programRecords();
  var list=el('murbGeoLinksList');list.replaceChildren();
  var found=linkedRecords.filter(function(r){return r.lat!==null&&r.lon!==null});
  var pending=linkedRecords.filter(function(r){return r.lat===null||r.lon===null});
  el('murbGeoLinksStatus').textContent=found.length+' local(is) identificado(s) no mapa • '+pending.length+' aguardando coordenadas.';
  linkedRecords.forEach(function(r){
   var item=document.createElement('div');item.className='geo-link-item';
   var label=document.createElement('strong');safeText(label,r.street+' • '+r.team);item.appendChild(label);
   var detail=document.createElement('small');safeText(detail,(r.fiscal||'Fiscal não informado')+' • '+(r.lat!==null?'● Localizado':'○ Sem coordenadas'));item.appendChild(detail);
   if(r.lat!==null){var b=document.createElement('button');b.type='button';b.textContent='Ver no mapa';b.onclick=function(){focus(r)};item.appendChild(b)}
   else {
    if(r.link){var a=document.createElement('a');a.href=r.link;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir link no Google Maps';item.appendChild(a)}
    var b=document.createElement('button');b.type='button';b.textContent='📍 Confirmar ponto manualmente';b.onclick=function(){startConfirm(r)};item.appendChild(b);
    if(!r.link){var msg=document.createElement('small');msg.textContent='Sem link cadastrado. Escolha o ponto diretamente no mapa.';item.appendChild(msg)}
   }
   list.appendChild(item);
  });
  draw();
 }
 function draw(){
  if(!map||!markers)return;
  markers.clearLayers();markerById.clear();
  records.concat(linkedRecords).filter(function(r){return r.active!==false&&r.lat!==null&&r.lon!==null&&r.lat!==''&&r.lon!==''&&Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lon))}).forEach(function(r){
   var pin=window.L.divIcon({className:'',html:'<div class="geo-pin" style="width:17px;height:17px;background:'+statusColor(r.source==='programacao'?r.status:null)+'!important;box-shadow:0 0 0 2px '+statusColor(r.source==='programacao'?r.status:null)+',0 3px 8px #0003!important"></div>',iconSize:[20,20],iconAnchor:[10,10]});
   var m=window.L.marker([Number(r.lat),Number(r.lon)],{icon:pin}).addTo(markers);
   m.bindPopup(popup(r));markerById.set(String(r.id),m);
  });
 }
 window.addEventListener('central:programs-changed',function(){syncPrograms();if(typeof refreshSearchPrograms==='function')refreshSearchPrograms()});
 function focus(r){
  if(!map){note('O mapa ainda está carregando.');return}
  if(r.active===false){note('Este ponto foi removido do mapa. Use Restaurar.');return}
  map.setView([Number(r.lat),Number(r.lon)],Math.max(map.getZoom(),16));
  var marker=markerById.get(String(r.id));if(marker)marker.openPopup();
  el('murbGeoMap').scrollIntoView({behavior:'smooth',block:'center'});
 }
 function render(){
  var root=el('murbGeoRecords');root.replaceChildren();
  if(!records.length){root.textContent='Nenhuma localização registrada neste navegador.';draw();return}
  records.slice().reverse().forEach(function(r){
   var article=document.createElement('article'),info=document.createElement('div'),buttons=document.createElement('div');buttons.className='geo-actions';
   var strong=document.createElement('strong');safeText(strong,(r.team||'Equipe não identificada')+' • '+(r.fiscal||'Fiscal não informado'));info.appendChild(strong);
   var detail=document.createElement('p');detail.className='geo-muted';safeText(detail,[r.street,r.neighborhood,r.zip,r.date,r.time].filter(Boolean).join(' • '));info.appendChild(detail);
   var state=document.createElement('small');safeText(state,r.active===false?'Removido do mapa':'● No mapa');state.style.color=r.active===false?'#798b98':'#198c57';info.appendChild(state);
   var view=document.createElement('button');view.type='button';view.textContent='Ver no mapa';view.disabled=r.active===false;view.onclick=function(){focus(r)};buttons.appendChild(view);
   var toggle=document.createElement('button');toggle.type='button';toggle.className=r.active===false?'':'geo-danger';toggle.textContent=r.active===false?'Restaurar':'Remover do mapa';
   toggle.onclick=function(){
    if(r.active!==false&&!confirm('Remover o ponto de '+(r.team||'esta equipe')+' do mapa? O histórico será preservado.'))return;
    var was=r.active;r.active=r.active===false;
    try{persist();render();note(r.active?'Ponto restaurado no mapa.':'Ponto removido do mapa.')}catch(e){r.active=was;note('Não foi possível salvar a alteração: '+e.message)}
   };
   buttons.appendChild(toggle);article.append(info,buttons);root.appendChild(article);
  });
  draw();
 }
 async function open(){
  panel.classList.add('murb-geo-visible');panel.scrollTop=0;refreshTeams();load();render();syncPrograms();
  try{
   await leaflet();
   if(!map){
    map=window.L.map('murbGeoMap',{zoomControl:true}).setView([-3.119,-60.0217],12);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
    markers=window.L.layerGroup().addTo(map);
    map.on('click',function(e){
     if(!confirmTarget)return;
     if(confirmMarker)map.removeLayer(confirmMarker);
     confirmMarker=window.L.marker(e.latlng,{draggable:true}).addTo(map);
     function showCoords(){var c=confirmMarker.getLatLng();el('murbGeoConfirmCoords').textContent='Latitude '+c.lat.toFixed(7)+' • Longitude '+c.lng.toFixed(7);el('murbGeoConfirmSave').disabled=false}
     confirmMarker.on('dragend',showCoords);showCoords();
    });
   }
   setTimeout(function(){map.invalidateSize();draw()},50);
  }catch(err){note('Mapa interativo indisponível: '+err.message+'. Verifique a conexão.')}
 }
 async function cepLookup(){
  var zip=el('murbGeoZip').value.replace(/\D/g,'');
  if(zip.length!==8){note('Informe um CEP com 8 dígitos.');return false}
  note('Consultando CEP...');
  try{
   var response=await fetch('https://viacep.com.br/ws/'+zip+'/json/');
   if(!response.ok)throw Error('Serviço de CEP indisponível');
   var j=await response.json();if(j.erro){note('CEP não encontrado.');return false}
   el('murbGeoZip').value=zip.replace(/^(\d{5})(\d{3})$/,'$1-$2');
   el('murbGeoStreet').value=j.logradouro||'';
   el('murbGeoNeighborhood').value=j.bairro||'';
   el('murbGeoCity').value=j.localidade||'Manaus';
   el('murbGeoState').value=j.uf||'AM';
   note(j.logradouro?'CEP localizado. Confira os dados antes de registrar.':'CEP localizado, mas não possui rua específica. Informe rua e bairro para maior precisão.');
   return true;
  }catch(e){note('Falha ao consultar CEP: '+e.message);return false}
 }
 function thumbnail(file){
  return new Promise(function(resolve){
   var img=new Image(),url=URL.createObjectURL(file);
   img.onload=function(){
    try{var c=document.createElement('canvas'),w=Math.min(440,img.width),h=Math.round(img.height*w/img.width);c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.55))}
    catch(e){resolve('')}finally{URL.revokeObjectURL(url)}
   };img.onerror=function(){URL.revokeObjectURL(url);resolve('')};img.src=url;
  });
 }
 function km(a,b){var R=6371,p=Math.PI/180,dlat=(Number(a.lat)-Number(b.lat))*p,dlon=(Number(a.lon)-Number(b.lon))*p,x=Math.sin(dlat/2)**2+Math.cos(Number(a.lat)*p)*Math.cos(Number(b.lat)*p)*Math.sin(dlon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
 async function lookup(query){var url='https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=br&q='+encodeURIComponent(query),r=await fetch(url,{headers:{'Accept':'application/json'}});if(!r.ok)throw Error('Serviço de mapas indisponível');return r.json()}
 function cityOK(m,city){var a=m.address||{},actual=[a.city,a.town,a.municipality,a.village,a.county,m.display_name].filter(Boolean).map(norm);return actual.some(function(x){return x.includes(norm(city))})}
 function clearPreview(){if(previewMarker&&map){map.removeLayer(previewMarker)}previewMarker=null;pending=null;el('murbGeoConfirm').style.display='none';el('murbGeoCancel').style.display='none'}
 function validCoords(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180}
 function positionPreview(lat,lon,quality,source,accuracy){
  if(!map){note('Aguarde o mapa interativo carregar.');return}
  var t=currentTeam(),file=el('murbGeoPhoto').files[0];
  if(!t){note('Selecione uma equipe antes de registrar a localização.');return}
  if(!file){note('Selecione ou tire uma fotografia para associar ao ponto.');return}
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>12*1024*1024){note('Use uma fotografia JPG, PNG ou WEBP de até 12 MB.');return}
  if(!validCoords(lat,lon)){note('Latitude ou longitude inválida.');return}
  clearPreview();
  pending={file:file,teamId:String(t.id),team:teamName(t),fiscal:fiscalName(t),street:el('murbGeoStreet').value.trim(),neighborhood:el('murbGeoNeighborhood').value.trim(),zip:el('murbGeoZip').value.trim(),city:el('murbGeoCity').value.trim(),state:el('murbGeoState').value.trim(),lat:lat,lon:lon,quality:quality,source:source,accuracy:accuracy};
  previewMarker=window.L.marker([lat,lon],{draggable:true,autoPan:true}).addTo(map);
  previewMarker.bindPopup('Prévia: '+quality+'<br>Arraste para ajustar e confirme antes de salvar.').openPopup();
  previewMarker.on('dragend',function(){var pos=previewMarker.getLatLng();pending.lat=pos.lat;pending.lon=pos.lng;pending.quality='Posição ajustada manualmente no mapa';pending.source='ajuste-manual';note('Ponto ajustado. Confirme para salvar.')});
  map.setView([lat,lon],Math.max(map.getZoom(),17));
  el('murbGeoConfirm').style.display='inline-block';el('murbGeoCancel').style.display='inline-block';
  note(quality+'. Confira o marcador e clique em Confirmar ponto e salvar.');
 }
 function previewCoordinates(){
  var lat=Number(el('murbGeoLatitude').value.trim().replace(',','.')),lon=Number(el('murbGeoLongitude').value.trim().replace(',','.'));
  if(!el('murbGeoLatitude').value.trim()||!el('murbGeoLongitude').value.trim()||!validCoords(lat,lon)){note('Informe latitude entre -90 e 90 e longitude entre -180 e 180.');return}
  positionPreview(lat,lon,'Coordenadas informadas manualmente','coordenadas-manuais',null);
 }
 function requestGps(){
  if(gpsBusy)return;
  var status=el('murbGeoGpsStatus');
  if(!window.isSecureContext){status.textContent='GPS exige HTTPS ou localhost. Abra o endereço HTTPS do MURB X no celular.';return}
  if(!navigator.geolocation){status.textContent='Este navegador não oferece geolocalização.';return}
  gpsBusy=true;el('murbGeoUseGps').disabled=true;status.textContent='Solicitando localização do celular. Autorize o acesso quando solicitado...';
  navigator.geolocation.getCurrentPosition(function(pos){
   gpsBusy=false;el('murbGeoUseGps').disabled=false;
   var c=pos.coords,accuracy=Number(c.accuracy),lat=c.latitude,lon=c.longitude;
   if(!validCoords(lat,lon)){status.textContent='O aparelho retornou coordenadas inválidas.';return}
   lastGps={lat:lat,lon:lon,accuracy:accuracy,at:Date.now()};
   el('murbGeoLatitude').value=lat.toFixed(7);el('murbGeoLongitude').value=lon.toFixed(7);
   var quality='GPS do celular (precisão estimada '+Math.round(accuracy)+' m)';
   status.textContent='Localização recebida. '+quality+'. Confira o ponto no mapa; não é garantia de precisão exata.';
   if(el('murbGeoPhoto').files.length&&currentTeam())positionPreview(lat,lon,quality,'gps',accuracy);
   else note('GPS recebido. Selecione a equipe e tire ou importe uma fotografia; depois clique em Mostrar coordenadas no mapa.');
  },function(err){
   gpsBusy=false;el('murbGeoUseGps').disabled=false;
   status.textContent=err.code===1?'Acesso ao GPS negado. Autorize a localização nas configurações do navegador.':err.code===2?'O aparelho não conseguiu determinar a posição. Tente em local aberto.':'Tempo esgotado ao obter GPS. Tente novamente.';
  },{enableHighAccuracy:true,timeout:20000,maximumAge:0});
 }
 async function save(){
  var file=el('murbGeoPhoto').files[0],t=currentTeam(),zip=el('murbGeoZip').value.trim(),street=el('murbGeoStreet').value.trim(),hood=el('murbGeoNeighborhood').value.trim(),city=el('murbGeoCity').value.trim(),state=el('murbGeoState').value.trim();
  clearPreview();
  if(!file||!t){note('Selecione uma fotografia e uma equipe.');return}
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>12*1024*1024){note('Use uma foto JPG, PNG ou WEBP com até 12 MB.');return}
  if(!hood&&!zip){note('Informe o bairro ou um CEP. Não é seguro localizar somente pela rua.');return}
  if(!map){note('Aguarde o mapa carregar.');return}
  note('Validando CEP e buscando a rua correspondente...');
  try{
   var digits=zip.replace(/\D/g,'');
   if(zip&&digits.length!==8){note('CEP incompleto. Informe os 8 dígitos ou deixe o campo vazio.');return}
   if(digits.length===8){
    var cepResponse=await fetch('https://viacep.com.br/ws/'+digits+'/json/');
    if(!cepResponse.ok)throw Error('Não foi possível validar o CEP no ViaCEP');
    var cepData=await cepResponse.json();
    if(cepData.erro){note('CEP não encontrado no ViaCEP. Confira os números.');return}
    // O endereço oficial do CEP prevalece sobre texto OCR ou campos antigos.
    if(cepData.logradouro)street=cepData.logradouro;
    if(cepData.bairro)hood=cepData.bairro;
    if(cepData.localidade)city=cepData.localidade;
    if(cepData.uf)state=cepData.uf;
    el('murbGeoStreet').value=street;el('murbGeoNeighborhood').value=hood;
    el('murbGeoCity').value=city;el('murbGeoState').value=state;
    el('murbGeoZip').value=digits.slice(0,5)+'-'+digits.slice(5);
    zip=el('murbGeoZip').value;
   }
   var area=null,quality='',neighborhoodArea=null;
   if(hood){
    var neighborhoods=await lookup([hood,city,state,'Brasil'].join(', '));
    neighborhoodArea=neighborhoods.find(function(m){return cityOK(m,city)&&norm(m.display_name).includes(norm(hood))})||null;
   }
   if(street){
    var streetCandidates=await lookup([street,hood,city,state,'Brasil'].filter(Boolean).join(', '));
    if(!streetCandidates.length)streetCandidates=await lookup([street,city,state,'Brasil'].join(', '));
    var streetMatches=streetCandidates.filter(function(m){
     var addr=m.address||{},road=norm([addr.road,addr.pedestrian,addr.residential,addr.street,addr.path].filter(Boolean).join(' '));
     return cityOK(m,city)&&(road.includes(norm(street))||norm(m.display_name).includes(norm(street)));
    });
    if(neighborhoodArea)streetMatches=streetMatches.filter(function(m){return km(m,neighborhoodArea)<=5});
    if(streetMatches.length){
     streetMatches.sort(function(x,y){
      var ax=x.address||{},ay=y.address||{};
      var sx=(norm([ax.suburb,ax.neighbourhood,ax.city_district].join(' ')).includes(norm(hood))?2:0)+(neighborhoodArea?1/(1+km(x,neighborhoodArea)):0);
      var sy=(norm([ay.suburb,ay.neighbourhood,ay.city_district].join(' ')).includes(norm(hood))?2:0)+(neighborhoodArea?1/(1+km(y,neighborhoodArea)):0);
      return sy-sx;
     });
     area=streetMatches[0];quality='Rua encontrada na cidade; confirme visualmente a posição (não é GPS exato)';
    }
   }
   if(!area&&digits.length===8){
    var postal=await lookup([zip,city,state,'Brasil'].join(', '));
    var postalMatches=postal.filter(function(m){return cityOK(m,city)});
    if(neighborhoodArea)postalMatches=postalMatches.filter(function(m){return km(m,neighborhoodArea)<=5});
    if(postalMatches.length){area=postalMatches[0];quality='Referência aproximada do CEP — arraste até a rua correta'}
   }
   if(!area&&neighborhoodArea){area=neighborhoodArea;quality='Centro aproximado do bairro — arraste até a rua correta'}
   if(!area){note('Não foi possível localizar com segurança a rua, o CEP ou o bairro. Nenhum ponto foi salvo.');return}
   var lat=Number(area.lat),lon=Number(area.lon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error('Coordenadas inválidas');
   pending={file:file,teamId:String(t.id),team:teamName(t),fiscal:fiscalName(t),street:street,neighborhood:hood,zip:zip,city:city,state:state,lat:lat,lon:lon,quality:quality};
   previewMarker=window.L.marker([lat,lon],{draggable:true,autoPan:true}).addTo(map);
   previewMarker.bindPopup('Prévia: '+quality+'<br>Arraste este marcador para a posição correta.').openPopup();
   previewMarker.on('dragend',function(){var pos=previewMarker.getLatLng();pending.lat=pos.lat;pending.lon=pos.lng;pending.quality='Posição ajustada manualmente no mapa';note('Ponto ajustado. Clique em Confirmar ponto e salvar.')});
   map.setView([lat,lon],Math.max(map.getZoom(),15));
   el('murbGeoConfirm').style.display='inline-block';el('murbGeoCancel').style.display='inline-block';
   note(quality+'. Confira o marcador no mapa, arraste se necessário e confirme para salvar.');
  }catch(e){clearPreview();note('Não foi possível buscar localização: '+e.message)}
 }
 async function confirmPoint(){
  if(!pending||!previewMarker)return;
  if(!currentTeam()||String(currentTeam().id)!==pending.teamId){note('A equipe mudou. Busque novamente.');clearPreview();return}
  note('Salvando ponto confirmado...');
  var p=pending,photo=await thumbnail(p.file),r={id:Date.now()+'-'+Math.random().toString(36).slice(2),teamId:p.teamId,team:p.team,fiscal:p.fiscal,street:p.street,neighborhood:p.neighborhood,zip:p.zip,city:p.city,state:p.state,lat:p.lat,lon:p.lon,quality:p.quality,date:el('murbGeoDate').value.trim()||new Date().toLocaleDateString('pt-BR'),time:el('murbGeoTime').value.trim()||new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),source:p.source||'endereco',accuracy:p.accuracy||null,photo:photo,photoName:p.file.name,active:true};
  records.push(r);
  try{persist()}catch(e){records.pop();note('Falha ao salvar no navegador: '+e.message);return}
  clearPreview();render();focus(r);note('Ponto confirmado e salvo. '+r.quality+'.');
 }
 function loadOcrLibrary(){
  if(window.Tesseract&&window.Tesseract.recognize)return Promise.resolve(window.Tesseract);
  if(window.murbGeoOcrLoading)return window.murbGeoOcrLoading;
  window.murbGeoOcrLoading=new Promise(function(resolve,reject){
   var script=document.createElement('script');
   script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
   script.async=true;
   script.onload=function(){window.Tesseract?resolve(window.Tesseract):reject(Error('Biblioteca OCR indisponível'))};
   script.onerror=function(){reject(Error('Não foi possível carregar o reconhecimento de texto'))};
   document.head.appendChild(script);
  }).catch(function(err){window.murbGeoOcrLoading=null;throw err});
  return window.murbGeoOcrLoading;
 }

 function normalizePhotoText(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
 function extractPhotoAddress(text){
  var lines=String(text||'').replace(/\r/g,'').split('\n').map(function(l){return l.replace(/\s+/g,' ').trim()}).filter(Boolean);
  var found={zip:'',street:'',neighborhood:'',number:'',team:'',fiscal:'',date:'',time:'',city:'',state:''};
  var all=lines.join(' ');
  var zip=all.match(/\b(\d{5})[\s.-]?(\d{3})\b/);if(zip)found.zip=zip[1]+'-'+zip[2];
  var team=all.match(/\b(?:nota\s*[:.-]?\s*)?equipe\s*[:.#-]?\s*([A-Z]{1,3})\s*[- ]?\s*(\d{1,3})\b/i);
  if(team)found.team=(team[1]+team[2]).toUpperCase();
  for(var i=0;i<lines.length;i++){
   var line=lines[i],f=line.match(/\bfiscal\s*[:.-]\s*(.+)$/i);
   if(f&&f[1])found.fiscal=f[1].replace(/\s*(?:nota|equipe|rua)\s*[:.-].*$/i,'').replace(/[^\p{L}\s.'-]/gu,'').trim();
  }
  var date=all.match(/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(20\d{2})\b/);
  if(date)found.date=date[1].padStart(2,'0')+'/'+date[2].padStart(2,'0')+'/'+date[3];
  else {var month=all.match(/\b(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s+(?:de\s+)?(20\d{2})\b/i);
   if(month){var months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];found.date=month[1].padStart(2,'0')+'/'+String(months.indexOf(month[2].toLowerCase())+1).padStart(2,'0')+'/'+month[3]}}
  var time=all.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);if(time)found.time=time[0];
  if(/\bmanaus\b/i.test(all))found.city='Manaus';if(/\b(?:amazonas|\-\s*AM\b)\b/i.test(all))found.state='Amazonas';
  // Timemark: "Rua Francisco Queiroz, 90 - Col Oliveira" + "Machado, Manaus - AM, 69070-000".
  var streetRe=/\b(?:rua|r\.|avenida|av\.?|travessa|tv\.?|estrada|alameda|beco|passagem|praça|praca)\s+[^\n]+/i;
  for(var j=0;j<lines.length;j++){
   var m=lines[j].match(streetRe);if(!m)continue;
   var raw=m[0];
   var divider=raw.match(/\s*[-–]\s*(?:col(?:[oô]nia)?|bairro)\s+/i);
   var streetPart=divider?raw.slice(0,divider.index):raw;
   var no=streetPart.match(/,\s*(\d{1,5})\s*$/);
   if(no){found.number=no[1];streetPart=streetPart.slice(0,no.index)}
   if(!found.street)found.street=streetPart.replace(/[,\s-]+$/,'').trim();
   if(divider){
    var tail=raw.slice(divider.index+divider[0].length);
    if(j+1<lines.length&&!/\b(?:nota|equipe|fiscal)\b/i.test(lines[j+1]))tail+=' '+lines[j+1];
    tail=tail.replace(/,?\s*Manaus\b.*$/i,'').trim();
    if(tail&&tail.length<90)found.neighborhood=(/^\s*col/i.test(divider[0])?'Colônia ':'')+tail;
   }else if(j+1<lines.length){
    var next=lines[j+1].replace(/,?\s*Manaus\b.*$/i,'').trim();
    if(next&&!/^(?:manaus|amazonas|am|nota|fiscal|equipe)\b/i.test(next)&&next.length<65)found.neighborhood=next;
   }
   break;
  }
  for(var k=0;k<lines.length;k++){
   var named=lines[k].match(/\bbairro\s*[:.-]\s*(.+)/i);if(named&&!found.neighborhood)found.neighborhood=named[1].trim();
  }
  return found;
 }
 function photoCanvas(img,x,y,w,h){
  var canvas=document.createElement('canvas'),scale=Math.max(1,Math.min(2.6,1900/(img.width*w)));
  canvas.width=Math.round(img.width*w*scale);canvas.height=Math.round(img.height*h*scale);
  var ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,Math.round(x*img.width),Math.round(y*img.height),Math.round(w*img.width),Math.round(h*img.height),0,0,canvas.width,canvas.height);
  var pixels=ctx.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
  // White lettering over photographs: contrast against busy backgrounds by luminance threshold.
  for(var i=0;i<d.length;i+=4){var v=.299*d[i]+.587*d[i+1]+.114*d[i+2];var q=v>155?255:0;d[i]=d[i+1]=d[i+2]=q}
  ctx.putImageData(pixels,0,0);return canvas;
 }
 function loadPhoto(file){return new Promise(function(resolve,reject){var im=new Image(),url=URL.createObjectURL(file);im.onload=function(){URL.revokeObjectURL(url);resolve(im)};im.onerror=function(){URL.revokeObjectURL(url);reject(Error('Imagem inválida'))};im.src=url})}
 function mergePhotoFields(target,part){
  Object.keys(part).forEach(function(key){if(!part[key])return;
   // Prefer more complete fields; never concatenate two competing OCR guesses.
   if(!target[key]||(key==='neighborhood'&&part[key].length>target[key].length&&part[key].length<65))target[key]=part[key];
  });return target;
 }
 async function readPhotoText(){
  var file=el('murbGeoPhoto').files[0],status=el('murbGeoOcrStatus');
  if(!file){status.textContent='Selecione uma fotografia para leitura.';return}
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>12*1024*1024){status.textContent='Use JPG, PNG ou WEBP com até 12 MB.';return}
  status.textContent='Preparando análise das regiões da fotografia...';
  try{
   var T=await loadOcrLibrary(),img=await loadPhoto(file);
   // Regiões independentes: TimeMark no canto inferior esquerdo, GPS Camera no inferior direito.
   var regions=[
    {name:'endereço inferior esquerdo',x:0,y:.68,w:.78,h:.32},
    {name:'fiscal e equipe',x:0,y:.81,w:.75,h:.19},
    {name:'endereço inferior direito',x:.48,y:.66,w:.52,h:.34},
    {name:'data e horário',x:0,y:.54,w:.57,h:.25}
   ];
   var found={zip:'',street:'',neighborhood:'',number:'',team:'',fiscal:'',date:'',time:'',city:'',state:''};
   for(var i=0;i<regions.length;i++){
    var region=regions[i];status.textContent='Analisando '+region.name+' ('+(i+1)+'/'+regions.length+')...';
    var canvas=photoCanvas(img,region.x,region.y,region.w,region.h);
    var result=await T.recognize(canvas,'por+eng');
    var part=extractPhotoAddress(result.data&&result.data.text);
    mergePhotoFields(found,part);
   }
   // If critical fields remain missing, attempt original-color full image as a fallback.
   if(!found.street||!found.zip||!found.date){
    status.textContent='Conferindo dados ainda não reconhecidos...';
    var full=await T.recognize(file,'por+eng');mergePhotoFields(found,extractPhotoAddress(full.data&&full.data.text));
   }
   var fields=[['murbGeoStreet','street','rua'],['murbGeoNeighborhood','neighborhood','bairro'],['murbGeoZip','zip','CEP'],['murbGeoCity','city','cidade'],['murbGeoState','state','estado'],['murbGeoDate','date','data'],['murbGeoTime','time','horário']];
   var filled=[];
   fields.forEach(function(row){if(found[row[1]]){el(row[0]).value=found[row[1]];filled.push(row[2])}});
   if(found.number&&found.street)el('murbGeoStreet').value=found.street+', '+found.number;
   if(found.team){
    var select=el('murbGeoTeamSelect');
    var matching=Array.from(select.options).find(function(opt){return norm(opt.textContent)===norm(found.team)});
    if(matching){select.value=matching.value;updateFiscal()}
   }
   status.textContent=filled.length?'Leitura realizada: '+filled.join(', ')+'. Confira e corrija os campos antes de registrar.':'Nenhum campo reconhecido com segurança. Preencha manualmente.';
  }catch(err){status.textContent='Leitura indisponível: '+err.message+'. Você pode preencher manualmente.'}
 }

 window.openV19Geo=open;
 window.openV19GeoLinks=async function(){await open();el('murbGeoTabLinks').click();panel.scrollTop=0};
 function init(){
  var grid=panel.querySelector('.geo-grid'),form=panel.querySelector('.geo-form-card');if(grid&&form)grid.prepend(form);
  var btn=document.createElement('button');btn.type='button';btn.id='murbGeoLaunch';btn.title='Geolocalização';btn.setAttribute('aria-label','Abrir Central de Geolocalização');btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span>Geolocalização</span>';
  btn.style.cssText='position:fixed;bottom:82px;right:20px;z-index:12005;width:54px;height:54px;border:1px solid #bcd0df;border-radius:50%;background:#edf3f7;color:#4f7897;font-size:30px;box-shadow:0 4px 15px #0002;cursor:pointer';
  /* Abertura exclusiva pelo botão Geolocalização da barra Acompanhamento. */
  el('murbGeoClose').onclick=function(){clearPreview();panel.classList.remove('murb-geo-visible')};
  var geoMode='gps';
  function setGeoMode(mode){
   if(mode===geoMode)return;
   clearPreview();geoMode=mode;
   var gps=mode==='gps',manual=mode==='manual',links=mode==='links';
   el('murbGeoGpsMode').hidden=!gps;el('murbGeoManualMode').hidden=!manual;
   el('murbGeoLinksMode').hidden=!links;
   el('murbGeoTabGps').classList.toggle('geo-mode-active',gps);
   el('murbGeoTabManual').classList.toggle('geo-mode-active',manual);
   el('murbGeoTabLinks').classList.toggle('geo-mode-active',links);
   el('murbGeoTabGps').setAttribute('aria-pressed',String(gps));
   el('murbGeoTabManual').setAttribute('aria-pressed',String(manual));
   el('murbGeoTabLinks').setAttribute('aria-pressed',String(links));
   el('murbGeoSave').style.display=manual?'block':'none';
   el('murbGeoConfirm').style.display='none';
   document.querySelector('#murbGeoPanel .geo-common-team').hidden=links;
   if(links){syncPrograms();refreshSearchPrograms();runLinkSync()}
   note(gps?'GPS: selecione a equipe, capture a localização e tire a fotografia.':manual?'Manual: importe uma foto, consulte CEP ou informe rua e bairro.':'Links: pontos do dashboard atualizados automaticamente.');
  }
  async function runLinkSync(){
   var button=el('murbGeoSyncLinks'),status=el('murbGeoLinksStatus');
   if(button.disabled)return;
   button.disabled=true;status.textContent='Consultando localizações das programações...';
   try{if(typeof window.centralGeoResolveLinks==='function')await window.centralGeoResolveLinks();syncPrograms();
    var identified=linkedRecords.filter(function(r){return r.lat!==null&&r.lon!==null}).length;
    var pending=linkedRecords.length-identified;
    status.textContent=identified+' local(is) com ponto no mapa. '+(pending?pending+' sem coordenadas; links encurtados podem exigir confirmação manual.':'Todos os locais identificados.');
    if(map){map.invalidateSize();draw();var coords=linkedRecords.filter(function(r){return r.lat!==null&&r.lon!==null}).map(function(r){return [r.lat,r.lon]});if(coords.length)map.fitBounds(coords,{padding:[35,35],maxZoom:16})}
   }catch(err){syncPrograms();status.textContent='Não foi possível atualizar os links: '+err.message}
   finally{button.disabled=false;refreshSearchPrograms()}
  }
  // Pesquisa dentro da Central de Geolocalização, não no mapa legado oculto.
  var searchBusy=false,searchLastAt=0;
  function refreshSearchPrograms(){
   var select=el('murbGeoSearchProgram'),previous=select.value;
   select.replaceChildren(new Option('Selecione a programação',''));
   linkedRecords.forEach(function(r){
    if(r.lat!==null&&r.lon!==null)return;
    select.add(new Option((r.street||'Local')+' • '+(r.team||'Equipe'),r.id));
   });
   if(Array.from(select.options).some(function(o){return o.value===previous}))select.value=previous;
  }
  async function searchGeoAddress(){
   var query=el('murbGeoSearchQuery').value.trim(),status=el('murbGeoSearchStatus'),results=el('murbGeoSearchResults');
   if(query.length<3){status.textContent='Digite pelo menos 3 caracteres.';return}
   if(!el('murbGeoSearchProgram').value){status.textContent='Selecione primeiro a programação que receberá o ponto.';return}
   if(searchBusy)return;
   if(Date.now()-searchLastAt<1100){status.textContent='Aguarde um instante antes de pesquisar novamente.';return}
   searchLastAt=Date.now();searchBusy=true;el('murbGeoSearchGo').disabled=true;
   results.replaceChildren();status.textContent='Pesquisando endereço...';
   try{
    var url=new globalThis.URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q',query);url.searchParams.set('format','jsonv2');url.searchParams.set('limit','5');url.searchParams.set('countrycodes','br');
    var response=await fetch(url.toString(),{headers:{'Accept':'application/json'}});
    if(!response.ok)throw Error('Serviço de pesquisa indisponível (HTTP '+response.status+').');
    var data=await response.json();
    if(!Array.isArray(data)||!data.length){status.textContent='Nenhum resultado encontrado. Tente incluir Manaus e o bairro.';return}
    data.forEach(function(item){
     var lat=Number(item.lat),lon=Number(item.lon);
     if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;
     var button=document.createElement('button');button.type='button';button.textContent=item.display_name||'Local encontrado';
     button.onclick=function(){
      var target=linkedRecords.find(function(r){return r.id===el('murbGeoSearchProgram').value});
      if(!target){status.textContent='Selecione uma programação válida.';return}
      if(!map){status.textContent='Mapa ainda não carregou. Verifique a internet.';return}
      startConfirm(target);
      map.setView([lat,lon],17);
      if(confirmMarker)map.removeLayer(confirmMarker);
      confirmMarker=window.L.marker([lat,lon],{draggable:true,autoPan:true}).addTo(map);
      function update(){
       var point=confirmMarker.getLatLng();
       el('murbGeoConfirmCoords').textContent='Latitude '+point.lat.toFixed(7)+' • Longitude '+point.lng.toFixed(7);
       el('murbGeoConfirmSave').disabled=false;
      }
      confirmMarker.on('dragend',update);update();
      el('murbGeoConfirmHelp').textContent='Resultado aproximado. Confira a posição no mapa, arraste o marcador se necessário e confirme para salvar.';
      status.textContent='Local encontrado. Confira o marcador e toque em Confirmar e salvar ponto.';
     };
     results.appendChild(button);
    });
    status.textContent=results.children.length+' resultado(s). Selecione o endereço correto.';
   }catch(err){status.textContent='Falha na pesquisa: '+err.message}
   finally{searchBusy=false;el('murbGeoSearchGo').disabled=false}
  }
  el('murbGeoSearchGo').onclick=searchGeoAddress;
  el('murbGeoSearchQuery').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();searchGeoAddress()}});
  el('murbGeoTabGps').onclick=function(){setGeoMode('gps')};
  el('murbGeoTabManual').onclick=function(){setGeoMode('manual')};
  el('murbGeoTabLinks').onclick=function(){setGeoMode('links')};
  el('murbGeoSyncLinks').onclick=runLinkSync;
  el('murbGeoConfirmCancel').onclick=cancelConfirm;
  el('murbGeoConfirmSave').onclick=function(){
   if(!confirmTarget||!confirmMarker)return;
   try{
    var pos=confirmMarker.getLatLng();
    var teams=window.centralGeoSaveConfirmedPoint(confirmTarget.id.replace(/^program-/,''),pos.lat,pos.lng);
    cancelConfirm();syncPrograms();refreshSearchPrograms();
    el('murbGeoLinksStatus').textContent='Ponto confirmado e salvo para '+teams+'. Agora aparece em Ver no mapa.';
   }catch(err){el('murbGeoConfirmHelp').textContent='Não foi possível salvar: '+err.message}
  };
  new MutationObserver(function(){var count=el('murbGeoRecords').querySelectorAll('article').length;el('murbGeoHistoryCount').textContent=count+' registro'+(count===1?'':'s')}).observe(el('murbGeoRecords'),{childList:true});
  el('murbGeoHistorySearch').addEventListener('input',function(){var term=norm(this.value);Array.from(el('murbGeoRecords').querySelectorAll('article')).forEach(function(article){article.style.display=!term||norm(article.textContent).includes(term)?'':'none'})});
  el('murbGeoTeamSelect').onchange=function(){updateFiscal();if(geoMode==='gps'&&lastGps&&el('murbGeoPhoto').files.length&&currentTeam())positionPreview(lastGps.lat,lastGps.lon,'GPS do celular (precisão estimada '+Math.round(lastGps.accuracy)+' m)','gps',lastGps.accuracy)};
  el('murbGeoLookupCep').onclick=cepLookup;
  el('murbGeoZip').addEventListener('blur',function(){if(el('murbGeoMode').value==='manual'&&el('murbGeoZip').value.replace(/\D/g,'').length===8)cepLookup()});
  el('murbGeoPhoto').addEventListener('change',function(){if(geoMode==='manual'&&el('murbGeoMode').value==='automatic')readPhotoText();if(geoMode==='gps'&&lastGps&&currentTeam())positionPreview(lastGps.lat,lastGps.lon,'GPS do celular (precisão estimada '+Math.round(lastGps.accuracy)+' m)','gps',lastGps.accuracy)});
  el('murbGeoMode').addEventListener('change',function(){el('murbGeoOcrStatus').textContent=el('murbGeoMode').value==='automatic'?'Importe uma foto para ler os dados automaticamente.':'Modo manual: informe o CEP ou rua e bairro. A fotografia será anexada sem OCR.'});
  el('murbGeoUseGps').onclick=requestGps;
  el('murbGeoPreviewCoords').onclick=previewCoordinates;
  el('murbGeoTakePhoto').onclick=function(){el('murbGeoCamera').click()};
  el('murbGeoCamera').onchange=function(){var file=this.files&&this.files[0];if(!file)return;try{var dt=new DataTransfer();dt.items.add(file);el('murbGeoPhoto').files=dt.files;el('murbGeoPhoto').dispatchEvent(new Event('change',{bubbles:true}));el('murbGeoGpsStatus').textContent='Fotografia capturada. '+(lastGps?'Confira a prévia no mapa.':'Agora obtenha a localização GPS.');el('murbGeoGpsPhotoName').textContent='Foto: '+file.name;}catch(e){el('murbGeoGpsStatus').textContent='Não foi possível anexar a foto. Selecione-a pelo campo Fotografia do WhatsApp.'}};
  el('murbGeoSave').onclick=function(){if(geoMode==='manual')save()};el('murbGeoConfirm').onclick=confirmPoint;el('murbGeoCancel').onclick=function(){clearPreview();note('Ajuste cancelado; nenhum ponto novo foi salvo.')};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

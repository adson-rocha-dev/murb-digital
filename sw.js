/* Cache local de arquivos estáticos. Não armazena respostas de API Supabase. */
const CACHE='murb-operacional-drive-mobility-geo-sync-8';
const FILES=['./','./index.html','./murb-drive.js','./murb-drive.css','./murb-excel-reconstruido.js','./murb-link.js','./murb-jszip.min.js','./murb_logo.jpg','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png',...Array.from({length:7},(_,i)=>'./murb-folhas-dezembro/folha-'+String(i+1).padStart(2,'0')+'.png')];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async c=>{await Promise.allSettled(FILES.map(f=>c.add(f)));}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('murb-operacional-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}
  return response;
 }).catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html'))));
});

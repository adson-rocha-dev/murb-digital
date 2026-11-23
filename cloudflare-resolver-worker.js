// Cloudflare Worker separado: murb-maps-resolver.murbdigital.workers.dev
// Restrito a links HTTPS de domínios oficiais Google Maps, sem redirecionar a outros hosts.
const ALLOWED=new Set(['maps.app.goo.gl','goo.gl','maps.google.com','www.google.com','google.com']);
function safeUrl(raw){
 try{const u=new URL(raw);if(u.protocol!=='https:'||!ALLOWED.has(u.hostname.toLowerCase()))return null;
 if(u.hostname==='goo.gl'&&!u.pathname.startsWith('/maps'))return null;
 return u;
 }catch{return null}
}
function coords(text){
 if(!text)return null;
 const value=String(text).replace(/&amp;/g,'&').replace(/\\u003d/g,'=').replace(/\\u0026/g,'&');
 const tests=[/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,/[?&](?:q|query|ll)=(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/i,/"latitude"\s*:\s*(-?\d+(?:\.\d+)?).*?"longitude"\s*:\s*(-?\d+(?:\.\d+)?)/s];
 for(const pattern of tests){const m=value.match(pattern);if(m){const lat=Number(m[1]),lng=Number(m[2]);if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)return {lat,lng}}}
 return null;
}
const TRUSTED_ORIGINS=new Set(['https://murbdigital.workers.dev','https://nurbdigital.workers.dev']);
function corsHeaders(request){
 const origin=request.headers.get('Origin');
 return origin&&TRUSTED_ORIGINS.has(origin)?{
  'access-control-allow-origin':origin,'vary':'Origin',
  'access-control-allow-methods':'GET, OPTIONS',
  'access-control-allow-headers':'Accept, Content-Type',
  'access-control-max-age':'86400'
 }:{};
}
const json=(body,status=200,request)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...corsHeaders(request)}});

export default {async fetch(request){
 const req=new URL(request.url);
 if(req.pathname!=='/api/resolve-google-map')return json({error:'Not found'},404,request);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(request)});
 if(request.method!=='GET')return json({error:'Method not allowed'},405,request);
 let target=safeUrl(req.searchParams.get('url')||'');if(!target)return json({error:'Invalid Google Maps URL'},400,request);
 try{
  for(let i=0;i<5;i++){
   const r=await fetch(target.toString(),{redirect:'manual',headers:{'user-agent':'Mozilla/5.0 (compatible; MapLinkResolver/1.0)','accept':'text/html'}});
   const loc=r.headers.get('location');
   if(r.status>=300&&r.status<400&&loc){const next=safeUrl(new URL(loc,target).href);if(!next)return json({error:'Redirect destination not allowed'},422,request);target=next;continue}
   let result=coords(target.toString());
   if(!result&&r.ok){const html=(await r.text()).slice(0,350000);result=coords(html)}
   return json(result?{...result,resolved:true}:{resolved:false,reason:'Coordinates not exposed by Google Maps'},200,request);
  }
  return json({resolved:false,reason:'Too many redirects'},200,request);
 }catch{return json({resolved:false,reason:'Google Maps unavailable'},200,request)}
}};

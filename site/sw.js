const CACHE='rootwise-jiqiao-v1.0.1-goal-20261124';
const AUDIO_CACHE='rootwise-audio-ljspeech-v1';
const ASSETS=['./','./index.html','./styles.css','./brand.css','./runtime-config.js','./app.js','./core.js','./sync-state.js','./vendor/fsrs.js','./vendor/FSRS-LICENSE.txt','./vendor/SRS-KIT-LICENSE.txt','./speech.js','./recorded-speech.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./data/lexicon.json','./data/audio.json','./data/content-review.txt','./data/voice-notice.txt','./data/third-party-notices.txt','./data/privacy.txt','./data/ANDROIDX-LICENSE.txt','./data/ECDICT-LICENSE.txt'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rootwise-')&&k!==CACHE&&k!==AUDIO_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function mediaResponse(request){
 const cache=await caches.open(AUDIO_CACHE),key=new Request(request.url);
 let response=await cache.match(key);
 if(!response){const headers=new Headers(request.headers);headers.delete('Range');response=await fetch(new Request(request,{headers}));if(response.status===200&&!response.redirected&&/audio\//i.test(response.headers.get('Content-Type')||''))await cache.put(key,response.clone());}
 const range=request.headers.get('Range');
 if(!range||response.status!==200)return response;
 const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match)return response;
 const blob=await response.blob(),size=blob.size;
 const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;
 if(start>=size||start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 return new Response(blob.slice(start,end+1),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${size}`,'Accept-Ranges':'bytes'}});
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin)return;
 const relative=url.pathname.slice(new URL(self.registration.scope).pathname.length);
 if(/^audio\/[a-f0-9]{20}\.mp3$/.test(relative)){event.respondWith(mediaResponse(event.request).catch(()=>new Response('Audio unavailable offline',{status:503})));return;}
 const allowed=ASSETS.map(a=>new URL(a,self.registration.scope).pathname);if(!allowed.includes(url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok&&!response.redirected){const clone=response.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));}return response;}).catch(()=>caches.match(event.request).then(r=>r||new Response('Offline resource unavailable',{status:503}))));
});

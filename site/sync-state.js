import {normalizeState,eventKey} from './core.js';
const mergeList=(a,b,key)=>[...new Map([...a,...b].map(x=>[key(x),x])).values()].sort((x,y)=>(x.time||0)-(y.time||0)).slice(-50000);
export function cloudSnapshot(state,notes={},noteTimes={}){const copy=JSON.parse(JSON.stringify(state));delete copy.session;delete copy.parked;delete copy.settings.voiceId;return {...copy,notes,noteTimes};}
export function mergeCloud(local,remote,notes={},noteTimes={}){
 if(!remote)return {state:local,notes,noteTimes};const other=normalizeState(remote),merged=normalizeState(local);
 for(const [w,p] of Object.entries(other.progress)){const own=merged.progress[w];if(!own||(p.last||0)>(own.last||0)||((p.last||0)===(own.last||0)&&p.reps>own.reps))merged.progress[w]=p;}
 merged.events=mergeList(merged.events,other.events,eventKey);merged.attempts=mergeList(merged.attempts,other.attempts,a=>a.id);merged.checkins=[...new Set([...merged.checkins,...other.checkins])];
 merged.focus={...other.focus,...merged.focus};
 for(const list of ['favorites','custom']){
  const combined=new Set([...merged[list],...other[list]]),changes={...merged.collectionChanges};
  for(const [key,entry] of Object.entries(other.collectionChanges)){if(entry&&Number.isFinite(entry.time)&&entry.time>(changes[key]?.time||0))changes[key]=entry;}
  for(const [key,entry] of Object.entries(changes)){if(!key.startsWith(list+':'))continue;const word=key.slice(list.length+1);if(entry.present)combined.add(word);else combined.delete(word);}
  merged[list]=[...combined];merged.collectionChanges=changes;
 }
 if(other.settingsUpdated>merged.settingsUpdated){merged.settings={...other.settings,voiceId:merged.settings.voiceId};merged.settingsUpdated=other.settingsUpdated;merged.goal=other.goal;merged.book=other.book;}
 const nextNotes={...notes},times={...noteTimes};for(const [w,n] of Object.entries(remote.notes||{})){if(typeof n==='string'&&((Number(remote.noteTimes?.[w])||0)>(Number(times[w])||0)||!(w in nextNotes))){nextNotes[w]=n.slice(0,4000);times[w]=Number(remote.noteTimes?.[w])||0;}}
 return {state:merged,notes:nextNotes,noteTimes:times};
}
export function createSync({getLocal,applyMerged,onStatus,fetcher=fetch,delay=1200}){
 let timer,running=false,again=false,disabled=false,last=0;
 async function run(){clearTimeout(timer);if(running){again=true;return;}if(disabled)return;running=true;onStatus('syncing','正在同步…');
  try{for(let retry=0;retry<4;retry++){
   const response=await fetcher('/api/progress',{cache:'no-store',credentials:'same-origin'});if(response.status===401){disabled=true;onStatus('login','登录后可同步电脑与手机');return;}if(!response.ok)throw Error('网络或同步服务暂不可用');
   if(!response.headers.get('content-type')?.includes('application/json')){disabled=true;onStatus('login','请登录同一个账号后同步');return;}
   const cloud=await response.json(),local=getLocal(),merged=mergeCloud(local.state,cloud.payload,local.notes,local.noteTimes);applyMerged(merged);
   const current=getLocal(),result=await fetcher('/api/progress',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:cloud.revision,payload:cloudSnapshot(current.state,current.notes,current.noteTimes)})});
   if(result.status===409)continue;if(!result.ok){let reason;try{reason=(await result.json()).error;}catch{}throw Error(reason||'同步暂未完成');}last=Date.now();onStatus('synced','已同步 · '+new Date(last).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));return;
  }throw Error('其他设备正在更新，稍后再试');
  }catch(error){onStatus('offline',(error instanceof TypeError?'暂时无法连接同步服务':error.message)+'；本机记录已保留');}finally{running=false;if(again){again=false;queue();}}
 }
 function queue(){if(disabled)return;clearTimeout(timer);timer=setTimeout(run,delay);}
 return {run:()=>{disabled=false;return run();},queue,get last(){return last;}};
}

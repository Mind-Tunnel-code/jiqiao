import {fsrs,createEmptyCard,Rating,State} from './vendor/fsrs.js';
export const STORAGE_KEY='rootwise.state.v1',DAY=86400000;
export const localDay=(time=Date.now())=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function initialState(){return {version:1,schema:3,book:'cet4-all',goal:20,progress:{},favorites:[],events:[],attempts:[],custom:[],session:null,parked:{},checkins:[],focus:{},collectionChanges:{},settingsUpdated:0,settings:{sound:false,accent:'en-US',voiceId:'',voiceSource:'builtin',maintainAll:true,groupSize:20,spelling:true,reverse:false,theme:'mist'}};}
const wordArray=a=>Array.isArray(a)?[...new Set(a.filter(x=>typeof x==='string'&&/^[a-z][a-z '-]{0,79}$/.test(x)))].slice(0,20000):[];
export function normalizeGoal(value,fallback=20){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:fallback;}
export function normalizeState(raw){
 if(!raw||raw.version!==1||!raw.progress||typeof raw.progress!=='object'||Array.isArray(raw.progress))throw Error('不是有效的词序备份文件');
 const state=initialState();state.book=typeof raw.book==='string'?raw.book:state.book;state.goal=normalizeGoal(raw.goal);
 for(const [w,p] of Object.entries(raw.progress)){
  if(!/^[a-z][a-z '-]{0,79}$/.test(w)||!p||!Number.isFinite(p.due)||p.due<0||!Number.isFinite(p.reps))continue;
  state.progress[w]={due:p.due,reps:Math.max(0,Math.min(100000,p.reps)),lapses:Math.max(0,Number(p.lapses)||0),interval:Math.max(0,Math.min(3650,Number(p.interval)||0)),last:Number(p.last)||0,ease:Math.max(1.3,Math.min(3,Number(p.ease)||2.5)),known:!!p.known};
  if(p.fsrs&&Number.isFinite(p.fsrs.stability)&&p.fsrs.stability>0&&Number.isFinite(p.fsrs.difficulty)&&p.fsrs.difficulty>=1&&p.fsrs.difficulty<=10)state.progress[w].fsrs={stability:Math.min(36500,p.fsrs.stability),difficulty:p.fsrs.difficulty,state:[0,1,2,3].includes(p.fsrs.state)?p.fsrs.state:2,learning_steps:Math.max(0,Number(p.fsrs.learning_steps)||0),reps:Math.max(0,Number(p.fsrs.reps)||p.reps),lapses:Math.max(0,Number(p.fsrs.lapses)||0)};
 }
 state.favorites=wordArray(raw.favorites);state.custom=wordArray(raw.custom);
 state.events=Array.isArray(raw.events)?raw.events.filter(e=>e&&typeof e.word==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.day)&&['again','hard','good','easy'].includes(e.grade)).slice(-50000).map(e=>({id:typeof e.id==='string'?e.id:eventKey(e),word:e.word,day:e.day,grade:e.grade,new:!!e.new,time:Number(e.time)||0,book:typeof e.book==='string'?e.book:'',session:typeof e.session==='string'?e.session:''})):[];
 state.attempts=Array.isArray(raw.attempts)?raw.attempts.filter(a=>a&&typeof a.id==='string'&&typeof a.word==='string'&&Number.isFinite(a.time)&&Number.isInteger(a.stage)&&a.stage>=0&&a.stage<=3).slice(-50000).map(a=>({id:a.id.slice(0,100),word:a.word,time:a.time,stage:a.stage,correct:!!a.correct,hinted:!!a.hinted,mode:a.mode==='review'?'review':'new',book:String(a.book||'').slice(0,80),session:String(a.session||'').slice(0,100),duration:Math.min(3600000,Math.max(0,Number(a.duration)||0))})):[];
 state.checkins=Array.isArray(raw.checkins)?[...new Set(raw.checkins.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))]:[];
 state.settings={sound:!!raw.settings?.sound,accent:raw.settings?.accent==='en-GB'?'en-GB':'en-US',voiceId:typeof raw.settings?.voiceId==='string'?raw.settings.voiceId.slice(0,400):'',voiceSource:raw.settings?.voiceSource==='system'?'system':'builtin',maintainAll:raw.schema>=3?raw.settings?.maintainAll!==false:true,groupSize:[5,10,15,20,30,50].includes(raw.settings?.groupSize)?raw.settings.groupSize:20,spelling:raw.settings?.spelling!==false,reverse:!!raw.settings?.reverse,theme:['mist','rose','cloud'].includes(raw.settings?.theme)?raw.settings.theme:'mist'};
 state.settingsUpdated=Math.max(0,Number(raw.settingsUpdated)||0);state.collectionChanges=raw.collectionChanges&&typeof raw.collectionChanges==='object'&&!Array.isArray(raw.collectionChanges)?raw.collectionChanges:{};state.focus=raw.focus&&typeof raw.focus==='object'&&!Array.isArray(raw.focus)?raw.focus:{};
 const s=raw.session;
 if(s?.engine===2&&Array.isArray(s.words)&&s.items&&Array.isArray(s.queue)){
  const ws=wordArray(s.words),items={};
  for(const w of ws){const item=s.items[w];if(!item||!Number.isInteger(item.step)||item.step<0||item.step>4)throw Error('学习会话损坏');items[w]={step:item.step,new:!!item.new,failures:Math.min(10000,Math.max(0,Number(item.failures)||0)),hinted:!!item.hinted,done:!!item.done,known:!!item.known};}
  if(ws.length){const groupSize=[5,10,15,20,30,50].includes(s.groupSize)?s.groupSize:10;
   const candidate=Array.isArray(s.groups)?s.groups.map(wordArray):[],flat=candidate.flat();const groups=flat.length===ws.length&&new Set(flat).size===ws.length&&flat.every(w=>ws.includes(w))?candidate:chunks(ws,groupSize);
   const group=Math.max(0,Math.min(groups.length-1,Math.floor(Number(s.group)||0))),allowed=new Set(groups[group]);
   const queue=wordArray(s.queue).filter(w=>allowed.has(w)&&!items[w].done),feedback=s.feedback&&ws.includes(s.feedback.word)?{word:s.feedback.word,correct:!!s.feedback.correct,stage:Math.max(0,Math.min(3,Number(s.feedback.stage)||0)),message:typeof s.feedback.message==='string'?s.feedback.message.slice(0,200):'',known:!!s.feedback.known,pending:!!s.feedback.pending,answeredAt:Number(s.feedback.answeredAt)||Date.now(),duration:Number(s.feedback.duration)||0}:null;
   if(feedback?.pending&&(queue[0]!==feedback.word||items[feedback.word].step!==feedback.stage))throw Error('待核对的学习记录不一致');
   state.session={engine:2,id:typeof s.id==='string'?s.id:uid(),words:ws,items,queue,feedback,group,groups,groupSize,mode:s.mode==='review'?'review':'new',started:Number(s.started)||Date.now(),title:typeof s.title==='string'?s.title:'词汇学习',book:typeof s.book==='string'?s.book:state.book,spelling:s.spelling!==false,reverse:s.reverse!==false,rootId:typeof s.rootId==='string'?s.rootId:'',introSeen:Array.isArray(s.introSeen)?s.introSeen.filter(Number.isInteger):[],answerCount:Math.max(0,Number(s.answerCount)||0),legacy:false};
   for(const w of ws){const source=s.items[w];items[w].firstRating=['again','hard','good','easy'].includes(source.firstRating)?source.firstRating:null;items[w].baseLast=Number.isFinite(source.baseLast)?source.baseLast:source.new?0:state.progress[w]?.last||0;items[w].stale=!!source.stale;}
   state.session.flow=s.flow==='cards'?'cards':'legacy';state.session.orderVersion=Number(s.orderVersion)||0;toCardSession(state.session);
  }
 }else if(s&&Array.isArray(s.tasks)&&Number.isInteger(s.index)&&s.index>=0){
  const ws=wordArray(s.tasks.slice(s.index).map(t=>t.word));if(ws.length){state.session=createSession(state,ws,{mode:'new',title:s.title||'继续上次学习',now:Number(s.started)||Date.now(),legacy:true});state.session.orderVersion=0;}
 }
 for(const [key,value] of Object.entries(raw.parked||{}).slice(0,40)){if(!/^(new|review):[a-z0-9-]+(?::[a-z0-9-]+)?$/.test(key))continue;const restored=normalizeState({...raw,session:value,parked:{}}).session;if(restored)state.parked[key]=restored;}
 return state;
}
const scheduler=fsrs({request_retention:.9,maximum_interval:3650,enable_fuzz:false,enable_short_term:false});
export function schedule(previous,grade,now=Date.now()){
 const rating={again:Rating.Again,hard:Rating.Hard,good:Rating.Good,easy:Rating.Easy}[grade];if(!rating)throw Error('Invalid grade');
 const p=previous||{reps:0,lapses:0,interval:0,ease:2.5},card=createEmptyCard(new Date(now));
 if(p.reps){Object.assign(card,{due:new Date(p.due||now),last_review:new Date(Math.min(now,p.last||((p.due||now)-(p.interval||1)*DAY))),stability:p.fsrs?.stability||Math.max(.1,p.interval||1),difficulty:p.fsrs?.difficulty||5,state:State.Review,reps:p.fsrs?.reps||p.reps,lapses:p.fsrs?.lapses||0,scheduled_days:p.interval||1});}
 const {card:next}=scheduler.next(card,new Date(now),rating);
 return {reps:p.reps+1,lapses:p.lapses||0,interval:next.scheduled_days,ease:p.ease||2.5,due:+next.due,last:now,known:false,fsrs:{stability:next.stability,difficulty:next.difficulty,state:next.state,learning_steps:next.learning_steps,reps:next.reps,lapses:next.lapses}};
}
export const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const eventKey=e=>e.id||`${e.word}:${e.time||e.day}:${e.grade}:${!!e.new}`;
const chunks=(words,size)=>Array.from({length:Math.ceil(words.length/size)},(_,i)=>words.slice(i*size,(i+1)*size));
export const sessionKey=s=>`${s.mode}:${s.book}${s.rootId?':'+s.rootId:''}`;
export const groupWords=s=>s?.groups?.[s.group]||s?.words.slice(s.group*s.groupSize,(s.group+1)*s.groupSize)||[];
export function groupWordsByFamily(ws,words,size){const groups=[];let current=[];for(let i=0;i<ws.length;){const root=words[ws[i]]?.root;let family=[ws[i++]];if(root)while(i<ws.length&&words[ws[i]]?.root===root)family.push(ws[i++]);if(root&&current.length&&current.length+family.length>size){groups.push(current);current=[];}for(const w of family){current.push(w);if(current.length===size){groups.push(current);current=[];}}}if(current.length)groups.push(current);return groups;}
export function todayStats(state,now=Date.now()){
 const es=state.events.filter(e=>e.day===localDay(now));return {newCount:new Set(es.filter(e=>e.new).map(e=>e.word)).size,reviewCount:new Set(es.filter(e=>!e.new).map(e=>e.word)).size,answers:es.length,correct:es.filter(e=>['good','easy'].includes(e.grade)).length};
}
export function orderNew(ids,words,limit,{focus=''}={}){
 const available=new Set(ids),out=[],families=new Map();for(const w of ids){const r=words[w]?.studyRoot===undefined?words[w]?.root:words[w].studyRoot;if(r){if(!families.has(r))families.set(r,[]);families.get(r).push(w);}}
 const take=w=>{if(available.has(w)&&out.length<limit){out.push(w);available.delete(w);}};
 if(focus)for(const w of families.get(focus)||[])take(w);
 for(const family of families.values()){if(out.length>=limit)break;for(const member of family)take(member);}
 for(const w of ids){if(out.length>=limit)break;take(w);}return out;
}
export function shuffled(a,random=Math.random){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function createSession(state,ws,{mode='new',title='词汇学习',now=Date.now(),legacy=false,groups,rootId=''}={}){
 const words=[...new Set(ws)];if(!words.length)return null;
 const items=Object.fromEntries(words.map(w=>[w,{step:0,new:!state.progress[w],baseLast:state.progress[w]?.last||0,failures:0,hinted:false,done:false,known:false,firstRating:null}]));
 return {engine:2,flow:'cards',orderVersion:2,id:uid(),words,items,queue:[...words],groups:[words],group:0,groupSize:words.length,mode,title,book:state.book,rootId,started:now,feedback:null,spelling:false,reverse:false,answerCount:0,legacy};
}
export function reorderLegacyNewSession(s,words){
 if(!s||s.mode!=='new'||s.orderVersion>=2)return false;
 const fixed=s.feedback?.pending?s.feedback.word:null,queued=new Set(s.queue);
 const fresh=s.words.filter(w=>queued.has(w)&&!s.items[w].done&&!s.items[w].failures&&w!==fixed);
 const retries=s.queue.filter(w=>!s.items[w].done&&s.items[w].failures>0&&w!==fixed);
 const focus=fixed?(words[fixed]?.studyRoot===undefined?words[fixed]?.root:words[fixed].studyRoot):'';
 const unshown=new Set(fresh),ordered=orderNew(s.words,words,s.words.length,{focus}).filter(w=>unshown.has(w));
 s.queue=[...(fixed?[fixed]:[]),...ordered,...retries];s.orderVersion=2;return true;
}
function toCardSession(s){
 const migrate=s.flow!=='cards';s.flow='cards';s.groups=[s.words];s.group=0;s.groupSize=s.words.length;s.spelling=false;s.reverse=false;s.introSeen=[];
 for(const item of Object.values(s.items))item.step=item.done?4:0;
 if(migrate){if(!s.feedback?.pending||s.feedback.stage>1||s.items[s.feedback.word].done)s.feedback=null;else s.feedback.stage=0;s.queue=s.words.filter(w=>!s.items[w].done);if(s.feedback)s.queue=[s.feedback.word,...s.queue.filter(w=>w!==s.feedback.word)];}
 else {s.queue=s.queue.filter(w=>!s.items[w].done);for(const w of s.words)if(!s.items[w].done&&!s.queue.includes(w)&&s.feedback?.word!==w)s.queue.push(w);}
}
export function makeSession(state,ids,words,{mode='new',now=Date.now(),title='词汇学习',rootId=''}={}){
 const scope=[...new Set(ids)].filter(w=>words[w]);
 let selected=mode==='review'?scope.filter(w=>!state.progress[w]?.known&&state.progress[w]?.due<=now).sort((a,b)=>state.progress[a].due-state.progress[b].due).slice(0,100):orderNew(scope.filter(w=>!state.progress[w]),words,Math.max(0,state.goal-todayStats(state,now).newCount),{focus:state.focus[state.book]});
 if(mode==='review')selected=interleaveReview(selected,words);
 return createSession(state,selected,{mode,title,now,rootId});
}
export function interleaveReview(ids,words){const remaining=[...ids],out=[];let last;while(remaining.length){let index=remaining.findIndex(w=>!last||words[w]?.root!==last);if(index<0)index=0;const [w]=remaining.splice(index,1);out.push(w);last=words[w]?.root;}return out;}
export function reconcileSession(state,s){if(!s)return;for(const w of s.words){const item=s.items[w],p=state.progress[w];if(!item.done&&p&&(p.known||(p.last||0)>item.baseLast)){item.done=true;item.stale=true;if(s.feedback?.word===w)s.feedback=null;}}s.queue=s.queue.filter(w=>!s.items[w].done);if(!s.queue.length&&!s.feedback){while(s.group<(s.groups?.length||Math.ceil(s.words.length/s.groupSize))-1){s.group++;s.queue=groupWords(s).filter(w=>!s.items[w].done);if(s.queue.length)break;}}}
export function currentTask(s){if(!s||s.feedback||!s.queue.length)return null;const word=s.queue[0],item=s.items[word];return {word,stage:0,type:'recall',item};}
export function normalizeSpelling(s){return String(s).normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');}
export function useHint(s){const task=currentTask(s);if(task)task.item.hinted=true;}
function record(state,w,grade,now){const s=state.session,item=s.items[w],previous=state.progress[w];if(previous&&((previous.last||0)>item.baseLast||previous.known)){item.done=true;item.stale=true;return;}const lapses=(previous?.lapses||0)+item.failures;state.progress[w]=schedule(previous,grade,now);state.progress[w].lapses=lapses;state.events.push({id:uid(),word:w,grade,new:!previous,day:localDay(now),time:now,book:s.book,session:s.id});state.events=state.events.slice(-50000);item.done=true;}
export function answer(state,correct,{now=Date.now(),known=false,duration=0}={}){
 const s=state.session,task=currentTask(s);if(!task)throw Error('没有可回答的题目');const item=task.item,helped=item.hinted;correct=!!correct&&!helped;s.answerCount++;
 if(!item.firstRating)item.firstRating=helped?'hard':correct?'good':'again';
 state.attempts.push({id:uid(),word:task.word,time:now,stage:task.stage,correct,hinted:helped,mode:s.mode,book:s.book,session:s.id,duration:Math.max(0,duration)});state.attempts=state.attempts.slice(-50000);
 if(known&&task.stage===0&&correct){item.known=true;record(state,task.word,'easy',now);state.progress[task.word].known=true;}
 else if(!correct){item.failures++;item.step=0;}
 else {item.step=4;record(state,task.word,item.firstRating==='again'?'again':item.failures?'hard':item.firstRating,now);}
 item.hinted=false;s.queue.shift();s.feedback={word:task.word,correct,stage:task.stage,message:helped?'本次使用了提示，请重新独立完成。':correct?'回答正确':'再通过词根理解一次',known:!!known&&item.known};return s.feedback;
}
export function prepareAnswer(state,correct,{now=Date.now(),known=false,duration=0}={}){const s=state.session,task=currentTask(s);if(!task)return;const helped=task.item.hinted;s.feedback={word:task.word,correct:!!correct&&!helped,stage:task.stage,message:helped?'本次使用了提示，稍后再独立回忆。':correct?'核对答案，确认是否记对。':'结合词根与例句理解，稍后再练。',known,pending:true,answeredAt:now,duration};}
export function correctPending(s){if(!s?.feedback?.pending)return;s.feedback.correct=false;s.feedback.known=false;s.feedback.message='已改为记错了，稍后重新巩固。';}
export function continueSession(s,state){if(!s?.feedback)return;if(s.feedback.pending){if(!state)throw Error('待核对答案需要学习状态');const pending=s.feedback;s.feedback=null;answer(state,pending.correct,{now:pending.answeredAt,known:pending.known,duration:pending.duration});}const {word}=s.feedback,item=s.items[word];if(!item.done)s.queue.push(word);s.feedback=null;}
export function groupComplete(s){return !!s&&!s.feedback&&!s.queue.length;}
export function sessionComplete(s){return !!s&&s.words.every(w=>s.items[w].done);}
export function nextGroup(s){if(!groupComplete(s)||sessionComplete(s))return;s.group++;s.queue=groupWords(s).filter(w=>!s.items[w].done);}
export function bookProgress(state,ids){const ws=[...new Set(ids)],learned=ws.filter(w=>state.progress[w]).length,stable=ws.filter(w=>state.progress[w]?.known||state.progress[w]?.interval>=7).length;return {learned,stable,total:ws.length,percent:ws.length?Math.round(learned/ws.length*100):0};}

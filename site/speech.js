const language=v=>String(v?.lang||'').replaceAll('_','-').toLowerCase();
export const englishVoices=voices=>voices.filter(v=>/^en(?:-|$)/.test(language(v)));
export function selectVoice(voices,accent='en-GB',preferred=''){
 const english=englishVoices(voices),target=accent.toLowerCase();
 const exact=english.filter(v=>language(v)===target),pool=exact.length?exact:english;
 const chosen=pool.find(v=>v.voiceURI===preferred);
 if(chosen)return chosen;
 const score=v=>(/natural|neural|premium|enhanced/i.test(v.name)?100:0)+(/google|microsoft|samantha|daniel|alex/i.test(v.name)?10:0)+(v.default?1:0);
 return [...pool].sort((a,b)=>score(b)-score(a))[0]||null;
}
export function waitForVoices(synthesis,timeout=1800){
 const voices=synthesis.getVoices();if(englishVoices(voices).length)return Promise.resolve(voices);
 return new Promise(resolve=>{
  let timer;
  const finish=()=>{clearTimeout(timer);synthesis.removeEventListener?.('voiceschanged',onChange);resolve(synthesis.getVoices());};
  const onChange=()=>{if(englishVoices(synthesis.getVoices()).length)finish();};
  synthesis.addEventListener?.('voiceschanged',onChange);timer=setTimeout(finish,timeout);onChange();
 });
}
export function createSpeaker({synthesis,makeUtterance,onError=()=>{},onVoice=()=>{}}){
 let request=0;
 function stop(){request++;synthesis?.cancel();}
 async function speak(word,{accent='en-GB',voiceId=''}={}){
  const ticket=++request;
  if(!synthesis){onError('当前浏览器不支持朗读。');return;}
  synthesis.cancel();
  try{
   const voices=await waitForVoices(synthesis);if(ticket!==request)return;
   const voice=selectVoice(voices,accent,voiceId);
   if(!voice){onError('当前浏览器未提供英语音色，请切换到应用内置发音。');return;}
   const utterance=makeUtterance(word);utterance.voice=voice;utterance.lang=voice.lang.replaceAll('_','-');utterance.rate=1;utterance.pitch=1;utterance.volume=1;
   utterance.onerror=e=>{if(ticket===request&&!['interrupted','canceled'].includes(e.error))onError('朗读未成功，请更换英语音色或检查设备语音服务。');};
   utterance.onstart=()=>{if(ticket===request)onVoice(voice,language(voice)!==accent.toLowerCase());};
   synthesis.speak(utterance);return utterance;
  }catch{if(ticket===request)onError('暂时无法读取设备英语语音，请稍后重试。');}
 }
 return {speak,stop};
}

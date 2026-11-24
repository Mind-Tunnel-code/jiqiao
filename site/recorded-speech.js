export function createRecordedSpeaker({makeAudio,onError=()=>{},onVoice=()=>{}}){
 let manifest=null,current=null,request=0;
 function stop(){
  request++;
  if(current){current.onerror=null;current.onplaying=null;current.pause();current.removeAttribute?.('src');current.load?.();current=null;}
 }
 function setManifest(value){manifest=value?.words?value:null;}
 function speak(word){
  stop();const ticket=request,entry=manifest?.words?.[word];
  if(!manifest){onError('内置发音资源尚未加载，请联网刷新后重试。');return Promise.resolve(false);}
  if(!entry||!/^audio\/[a-f0-9]{20}\.mp3$/.test(entry.src)){onError('这个词暂未提供内置发音。');return Promise.resolve(false);}
  let reported=false;
  function fail(error){if(ticket!==request||reported)return;reported=true;onError(error?.name==='NotAllowedError'?'浏览器阻止了自动播放，请点击喇叭播放。':'音频暂时无法加载，请检查网络后重试。已缓存的音频可离线播放。');}
  try{
   const audio=makeAudio('./'+entry.src);current=audio;audio.preload='auto';audio.playbackRate=1;
   audio.onerror=fail;audio.onplaying=()=>{if(ticket===request)onVoice({name:manifest.voice,lang:manifest.locale,source:'builtin'});};
   return Promise.resolve(audio.play()).then(()=>ticket===request).catch(error=>{fail(error);return false;});
  }catch(error){fail(error);return Promise.resolve(false);}
 }
 return {setManifest,speak,stop,getManifest:()=>manifest};
}

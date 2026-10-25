import * as Store from './storage.js';
let context;
export function unlockFeedback(){
  if(!Store.settings().scanSound)return;
  try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(Audio){context||=new Audio();if(context.state==='suspended')context.resume().catch(()=>{});}}catch{}
}
export function scanFeedback(kind='success'){
  window.dispatchEvent(new CustomEvent('pikeo-scan-feedback',{detail:{kind}}));
  const prefs=Store.settings();
  if(prefs.scanVibration)try{navigator.vibrate?.(kind==='success'?70:kind==='unknown'?[50,65,50]:[120,70,120]);}catch{}
  if(!prefs.scanSound)return;
  try{
    unlockFeedback();if(!context||context.state!=='running')return;
    const frequencies=kind==='success'?[880]:kind==='unknown'?[440,600]:[220,180];
    frequencies.forEach((f,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.15;oscillator.frequency.value=f;gain.gain.setValueAtTime(.05,at);gain.gain.exponentialRampToValueAtTime(.001,at+.12);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.13);});
  }catch{}
}

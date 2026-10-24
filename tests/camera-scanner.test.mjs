import test from 'node:test';
import assert from 'node:assert/strict';
import * as Features from '../site/js/features.js';
import {state} from '../site/js/ui.js';

test('le sélecteur conserve le flux choisi dans les deux lecteurs de codes',async t=>{
  // Simulated media devices exercise the real scanner entrypoints. They do not
  // claim to replace a camera/permission test on a physical phone.
  const names=['navigator','document','window','localStorage','BarcodeDetector','ZXingBrowser'];
  const originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const memory=new Map(),opened=[],captures=[],decodes=[];let firstDetection,decodeCalls=0;
  const devices=[{kind:'videoinput',deviceId:'rear',label:'Arrière'},{kind:'videoinput',deviceId:'wide',label:'Grand angle <2>'},{kind:'videoinput',deviceId:'front',label:'Avant'}];
  const container={html:'',elements:{},set innerHTML(html){this.elements['#scan-video']&&(this.elements['#scan-video'].isConnected=false);this.html=html;this.elements={};if(html.includes('id="scan-video"'))this.elements={'#scan-video':{isConnected:true,srcObject:null,pause(){},async play(){}},'#scan-camera':{innerHTML:'',value:'',disabled:true},'#camera-hint':{textContent:''},'#camera-status':{textContent:''},'[data-action="next-camera"]':{disabled:true}};},get innerHTML(){return this.html;},querySelector(selector){return this.elements[selector]||null;},setAttribute(){},removeAttribute(){}};
  const mediaDevices={async getUserMedia(constraints){const previous=opened.at(-1);if(previous)assert.equal(previous.track.stopped,true,'old objective is released before opening the next');captures.push(constraints);const id=constraints.video.deviceId?.exact||'rear';const track={id,stopped:false,label:id,stop(){this.stopped=true;},getSettings(){return{deviceId:id};}};const stream={track,getVideoTracks:()=>[track],getTracks:()=>[track]};opened.push(stream);return stream;},async enumerateDevices(){return devices;}};
  const globals={navigator:{mediaDevices},window:{},localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value))},document:{hidden:false,querySelector:selector=>selector==='#camera-container'?container:null,createElement:()=>({}),head:{append:script=>queueMicrotask(()=>script.onload())}}};
  for(const [name,value]of Object.entries(globals))Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
  t.after(()=>{Features.stopCamera();for(const name of names){const descriptor=originals.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});

  await t.test('lecteur natif : sélection directe et bouton caméra suivante',async()=>{
    class Detector {static async getSupportedFormats(){return['code_128'];}detect(){if(decodeCalls++===0)return new Promise(resolve=>firstDetection=resolve);return Promise.resolve([]);}}
    window.BarcodeDetector=Detector;Object.defineProperty(globalThis,'BarcodeDetector',{value:Detector,configurable:true,writable:true});
    await Features.startCamera();assert.match(container.html,/Caméra utilisée/);assert.equal(opened.at(-1).track.id,'rear');assert.match(container.querySelector('#scan-camera').innerHTML,/Grand angle &lt;2&gt;/);
    await Features.nextCamera();assert.equal(opened.at(-1).track.id,'wide');assert.equal(container.querySelector('#scan-camera').value,'wide');
    firstDetection([{rawValue:'obsolete'}]);await new Promise(resolve=>setImmediate(resolve));assert.equal(state.scanResult,null,'an old detector cannot accept a code after switching objectives');
    await Features.changeCamera('front');assert.equal(opened.at(-1).track.id,'front');assert.equal(memory.get('ek-preferred-camera'),'front');assert.equal(container.querySelector('[data-action="next-camera"]').disabled,false);
    Features.stopCamera();assert.equal(opened.at(-1).track.stopped,true);
  });

  await t.test('repli ZXing : le même flux sélectionné est transmis, sans caméra par défaut supplémentaire',async()=>{
    delete window.BarcodeDetector;delete globalThis.BarcodeDetector;
    class Reader {async decodeFromStream(stream,video){decodes.push(stream);assert.equal(video.srcObject,stream);return{stop(){stream.getTracks().forEach(track=>track.stop());}};}}
    Object.defineProperty(globalThis,'ZXingBrowser',{value:{BrowserMultiFormatReader:Reader},configurable:true,writable:true});
    const before=captures.length;await Features.startCamera();assert.equal(opened.at(-1).track.id,'front','last objective is reused');
    await Features.changeCamera('rear');assert.equal(decodes.at(-1),opened.at(-1));assert.equal(decodes.at(-1).track.id,'rear');assert.equal(captures.length-before,2);assert.deepEqual(captures.at(-1).video.deviceId,{exact:'rear'});assert.equal(captures.at(-1).audio,false);
    Features.stopCamera();assert.equal(opened.every(stream=>stream.track.stopped),true);
  });
  await t.test('une seule caméra exposée : choix et bascule désactivés avec explication',async()=>{
    devices.splice(1);await Features.startCamera();
    assert.equal(container.querySelector('#scan-camera').disabled,true);assert.equal(container.querySelector('[data-action="next-camera"]').disabled,true);
    assert.match(container.querySelector('#camera-hint').textContent,/ne propose qu’une caméra/);
    const count=captures.length;await Features.nextCamera();assert.equal(captures.length,count);Features.stopCamera();
  });
});

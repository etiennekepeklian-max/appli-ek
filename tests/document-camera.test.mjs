import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentCamera} from '../site/js/document-camera.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(extra={}){
  const track={readyState:'live',stop(){this.readyState='ended';},getSettings(){return {deviceId:'rear'};}},stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  let calls=0;const dimensions=[];
  const video={isConnected:true,videoWidth:1920,videoHeight:1080,async play(){},pause(){}};
  const canvas=()=>({width:0,height:0,getContext:()=>({drawImage(){}}),toBlob(cb,type){dimensions.push([this.width,this.height]);cb(new Blob(['synthetic-'+dimensions.length],{type}));}});
  const camera=new DocumentCamera({mediaDevices:{async getUserMedia(){calls++;return stream;},async enumerateDevices(){return [];}},
    canvas,ImageCapture:null,...extra});
  return {camera,track,video,stream,dimensions,calls:()=>calls};
}
test('photos successives : un seul flux, fichiers distincts, caméra arrêtée explicitement',async()=>{
  const f=fixture();await f.camera.open(f.video);const a=await f.camera.capture(),b=await f.camera.capture();
  assert.equal(f.calls(),1);assert.notEqual(a.name,b.name);assert.equal(a.type,'image/jpeg');assert.equal(f.track.readyState,'live');assert.equal(f.video.srcObject,f.stream);f.camera.stop();assert.equal(f.track.readyState,'ended');assert.equal(f.video.srcObject,null);
});
test('autorisation tardive après fermeture : aucun flux ne reste ouvert',async()=>{
  const gate=deferred(),started=deferred(),f=fixture({mediaDevices:{getUserMedia:()=>{started.resolve();return gate.promise;}}});const open=f.camera.open(f.video);await started.promise;f.camera.stop();gate.resolve(f.stream);
  assert.equal(await open,false);assert.equal(f.track.readyState,'ended');assert.equal(f.video.srcObject,null);
});
test('capture photo haute définition utilisée et bornée sans conserver le bitmap',async()=>{
  let closed=0;const f=fixture({ImageCapture:class{async takePhoto(){return new Blob(['still']);}},bitmap:async()=>({width:6000,height:4000,close(){closed++;}})});
  await f.camera.open(f.video);await f.camera.capture();assert.equal(f.dimensions[0][0],3400);assert.equal(closed,1);f.camera.stop();
});
test('échec de photo haute définition : repli sur le cadrage vidéo',async()=>{
  const f=fixture({ImageCapture:class{async takePhoto(){throw Error('unsupported');}},bitmap:async()=>{throw Error('not used');}});
  await f.camera.open(f.video);await f.camera.capture();assert.deepEqual(f.dimensions[0],[1920,1080]);f.camera.stop();
});
test('une fermeture pendant l’encodage ne produit pas de photo tardive',async()=>{
  let encode;const f=fixture({canvas:()=>({getContext:()=>({drawImage(){}}),toBlob(cb){encode=cb;}})});await f.camera.open(f.video);
  const photo=f.camera.capture();f.camera.stop();encode(new Blob(['late'],{type:'image/jpeg'}));await assert.rejects(photo,/fermée/);
});
test('image vidéo pas encore prête et caméra absente donnent une erreur exploitable',async()=>{
  const f=fixture();await f.camera.open(f.video);f.video.videoWidth=0;await assert.rejects(f.camera.capture(),/cadrage se prépare/);f.camera.stop();await assert.rejects(f.camera.capture(),/fermée/);
  assert.throws(()=>new DocumentCamera({mediaDevices:{}}),/galerie/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraSession,cameraErrorMessage} from '../site/js/camera.js';

const device=(deviceId,label='',kind='videoinput')=>({deviceId,label,kind});
const stream=id=>{const track={label:'Objectif '+id,stopped:false,stop(){this.stopped=true;},getSettings(){return{deviceId:id};}};return{track,getTracks:()=>[track],getVideoTracks:()=>[track]};};
const failure=name=>Object.assign(new Error(name),{name});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('première ouverture : caméra arrière préférée, aucun micro et liste après autorisation',async()=>{
  const events=[];const s=stream('rear');
  const camera=new CameraSession({mediaDevices:{async getUserMedia(c){events.push('permission');assert.equal(c.audio,false);assert.deepEqual(c.video.facingMode,{ideal:'environment'});return s;},async enumerateDevices(){events.push('liste');return[device('rear','Arrière'),device('wide','Grand angle'),device('front','Avant'),device('rear','Doublon'),device('mic','Micro','audioinput')];}}});
  const opened=await camera.open();assert.deepEqual(events,['permission','liste']);assert.deepEqual(opened.cameras.map(d=>d.deviceId),['rear','wide','front']);assert.equal(opened.deviceId,'rear');camera.stop();
});

test('le changement libère l’objectif précédent et exige la caméra sélectionnée',async()=>{
  const first=stream('rear'),second=stream('wide');let calls=0;
  const camera=new CameraSession({mediaDevices:{async getUserMedia(c){if(!calls++){return first;}assert.equal(first.track.stopped,true);assert.deepEqual(c.video.deviceId,{exact:'wide'});return second;},async enumerateDevices(){return[device('rear'),device('wide')];}}});
  await camera.open();const opened=await camera.open('wide');assert.equal(opened.stream,second);assert.equal(opened.deviceId,'wide');assert.equal(second.track.stopped,false);camera.stop();assert.equal(second.track.stopped,true);
});

test('la préférence locale est réutilisée et le périphérique réellement ouvert est mémorisé',async()=>{
  let saved='telephoto';
  const camera=new CameraSession({recall:()=>saved,remember:id=>saved=id,mediaDevices:{async getUserMedia(c){assert.deepEqual(c.video.deviceId,{exact:saved});return stream(saved);},async enumerateDevices(){return[device(saved,'Téléobjectif')];}}});
  await camera.open();assert.equal(saved,'telephoto');camera.stop();await camera.open();assert.equal(camera.deviceId,'telephoto');camera.stop();
});

test('un objectif mémorisé disparu revient à la caméra arrière disponible',async()=>{
  const requests=[];let saved='disparu';
  const camera=new CameraSession({recall:()=>saved,remember:id=>saved=id,mediaDevices:{async getUserMedia(c){requests.push(c);if(c.video.deviceId)throw failure('OverconstrainedError');return stream('rear');},async enumerateDevices(){return[device('rear','Arrière')];}}});
  const opened=await camera.open();assert.equal(requests.length,2);assert.equal(opened.fallback,true);assert.equal(saved,'rear');camera.stop();
});

test('le refus de permission ne déclenche aucune tentative sur une autre caméra',async()=>{
  let calls=0;const camera=new CameraSession({recall:()=> 'rear',mediaDevices:{async getUserMedia(){calls++;throw failure('NotAllowedError');}}});
  await assert.rejects(camera.open(),{name:'NotAllowedError'});assert.equal(calls,1);assert.equal(camera.stream,null);assert.match(cameraErrorMessage(failure('NotAllowedError')),/Autorisez/);
});

test('quitter le scanner pendant la permission ferme le flux reçu tardivement',async()=>{
  const permission=deferred(),late=stream('rear');let remembers=0;
  const camera=new CameraSession({remember:()=>remembers++,mediaDevices:{getUserMedia:()=>permission.promise}});
  const opening=camera.open();await turn();camera.stop();permission.resolve(late);assert.equal(await opening,null);assert.equal(late.track.stopped,true);assert.equal(remembers,0);assert.equal(camera.stream,null);
});

test('des changements rapides restent sérialisés et seul le dernier choix reste ouvert',async()=>{
  const permission=deferred(),first=stream('rear'),last=stream('front');const requests=[];
  const camera=new CameraSession({mediaDevices:{async getUserMedia(c){const id=c.video.deviceId?.exact||'rear';requests.push(id);if(id==='rear')return permission.promise;assert.equal(first.track.stopped,true);return last;},async enumerateDevices(){return[device('rear'),device('wide'),device('front')];}}});
  const a=camera.open();await turn();const b=camera.open('wide');const c=camera.open('front');assert.deepEqual(requests,['rear']);permission.resolve(first);assert.equal(await a,null);assert.equal(await b,null);assert.equal((await c).stream,last);assert.deepEqual(requests,['rear','front']);camera.stop();
});

test('quitter pendant la découverte des objectifs ferme aussi le flux',async()=>{
  const list=deferred(),s=stream('rear');const camera=new CameraSession({mediaDevices:{async getUserMedia(){return s;},enumerateDevices:()=>list.promise}});
  const opening=camera.open();await turn();camera.stop();list.resolve([device('rear')]);assert.equal(await opening,null);assert.equal(s.track.stopped,true);
});

test('une liste restreinte conserve au moins la caméra active et un nom compréhensible',async()=>{
  const camera=new CameraSession({mediaDevices:{async getUserMedia(){return stream('only');},async enumerateDevices(){throw failure('NotAllowedError');}}});
  const opened=await camera.open();assert.deepEqual(opened.cameras,[{deviceId:'only',label:'Objectif only'}]);camera.stop();
});
test('lampe et zoom : seules les contraintes disponibles et valides sont appliquées',async()=>{
  const applied=[],settings={torch:false,zoom:1},track={getCapabilities:()=>({torch:true,zoom:{min:1,max:4,step:.1}}),getSettings:()=>settings,async applyConstraints(c){applied.push(c);Object.assign(settings,c.advanced[0]);},stop(){}};
  const session=new CameraSession({mediaDevices:{}});session.stream={getVideoTracks:()=>[track],getTracks:()=>[track]};
  assert.equal(await session.control('torch',true),true);assert.equal(await session.control('zoom',2.5),2.5);
  await assert.rejects(session.control('zoom',5));await assert.rejects(session.control('unknown',1));assert.equal(applied.length,2);
  session.stop();await assert.rejects(session.control('torch',true));
});

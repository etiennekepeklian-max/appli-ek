import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaState,mediaSession,mediaAction,createMediaController} from '../site/js/media-core.js';
import {nativeMediaAdapter} from '../site/js/media-controls.js';
import {helpFor} from '../site/js/help-core.js';
const row=(id,status='playing')=>({id,label:id==='yt'?'YouTube Music':'Lecteur du téléphone',status,canPlay:true,canPause:true});
const native=(sessions=[row('yt')],permission='granted')=>({schema:1,platform:'android',supported:true,permission,sessions});
function fake(value=native()){
 let current=value,listener,release;
 const calls=[];
 const adapter={
  async getState(){return current;},
  async command(args){calls.push(args);return {accepted:true};},
  async openAccessSettings(){return {opened:true};},
  async addListener(event,fn){assert.equal(event,'stateChanged');listener=fn;return {remove(){release=true;}};}
 };
 return {adapter,calls,set(v){current=v;},emit(){listener?.();},removed:()=>release};
}
test('Musique : web et PWA ne prétendent pas contrôler une autre application',async()=>{
 assert.equal(nativeMediaAdapter({navigator:{mediaSession:{}}}),null);
 assert.equal(nativeMediaAdapter({Capacitor:{isNativePlatform:()=>false}}),null);
 const c=createMediaController(null);await c.refresh();assert.equal(c.snapshot().state.supported,false);
 await assert.rejects(c.toggle(),/pas disponible/);await assert.rejects(c.openAccessSettings(),/future version Android/);
});
test('Musique : le pont natif exige Android, son enregistrement et les méthodes du contrat',()=>{
 const f=fake(),Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',isPluginAvailable:()=>true};
 assert.equal(nativeMediaAdapter({Capacitor,PikeoMediaBridge:f.adapter}),f.adapter);
 assert.equal(nativeMediaAdapter({Capacitor:{...Capacitor,getPlatform:()=>'ios'},PikeoMediaBridge:f.adapter}),null);
 assert.equal(nativeMediaAdapter({Capacitor,PikeoMediaBridge:{getState(){}}}),null);
});
test('Musique : schéma inconnu ou autorisation absente retire toute session commandable',()=>{
 assert.equal(mediaState({...native(),schema:2}).supported,false);
 assert.deepEqual(mediaState(native([row('yt')],'required')).sessions,[]);
 assert.equal(mediaSession(mediaState(native([]))),null);
 const s=mediaState(native([row('yt'),row('yt'),row('phone','alien'),null]));
 assert.equal(s.sessions.length,2);assert.equal(s.sessions[1].status,'unknown');assert.equal(mediaAction(s.sessions[1]),'');
});
test('Musique : lecteur actif prioritaire et choix manuel conservé',async()=>{
 const f=fake(native([row('phone','paused'),row('yt')])),c=createMediaController(f.adapter);
 await c.refresh();assert.equal(c.snapshot().session.id,'yt');c.select('phone');assert.equal(c.snapshot().session.id,'phone');
 await c.toggle();assert.deepEqual(f.calls,[{sessionId:'phone',action:'play',expectedStatus:'paused'}]);
});
test('Musique : pause cible uniquement la session affichée et attend son état réel',async()=>{
 const f=fake(),c=createMediaController(f.adapter);await c.refresh();assert.equal(await c.toggle(),true);
 assert.deepEqual(f.calls,[{sessionId:'yt',action:'pause',expectedStatus:'playing'}]);
 assert.equal(c.snapshot().session.status,'playing'); // Dispatch alone must not paint a pause.
 f.set(native([row('yt','paused')]));await c.refresh();assert.equal(mediaAction(c.snapshot().session),'play');
});
test('Musique : disparition de source ne redirige pas une commande vers un autre lecteur',async()=>{
 const f=fake(),c=createMediaController(f.adapter);await c.refresh();f.set(native([row('phone')]));
 await assert.rejects(c.toggle(),/source a changé/);assert.equal(f.calls.length,0);
});
test('Musique : pause concurrente ne devient jamais une reprise accidentelle',async()=>{
 const f=fake(),c=createMediaController(f.adapter);await c.refresh();f.set(native([row('yt','paused')]));
 await assert.rejects(c.toggle(),/lecture ou la source a changé/);assert.equal(f.calls.length,0);
});
test('Musique : retrait de permission bloque la commande sans effacer les données métier',async()=>{
 const f=fake(),c=createMediaController(f.adapter);await c.refresh();f.set(native([row('yt')],'required'));
 await assert.rejects(c.toggle());assert.equal(f.calls.length,0);assert.equal(c.snapshot().session,null);
 assert.deepEqual(await c.openAccessSettings(),{opened:true});assert.equal(c.snapshot().state.permission,'required');
});
test('Musique : refus de commande et état inconnu sont explicites',async()=>{
 const f=fake();f.adapter.command=async()=>({accepted:false});const c=createMediaController(f.adapter);await c.refresh();
 await assert.rejects(c.toggle(),/pas accepté/);assert.equal(c.snapshot().busy,false);
 f.set(native([{...row('yt'),canPause:false}]));await c.refresh();await assert.rejects(c.toggle(),/pas disponible/);
});
test('Musique : double appui pendant une commande ne déclenche qu’une seule action',async()=>{
 const f=fake();let done;f.adapter.command=async args=>{f.calls.push(args);await new Promise(r=>done=r);return {accepted:true};};
 const c=createMediaController(f.adapter);await c.refresh();const pending=c.toggle();
 await new Promise(r=>setImmediate(r));assert.equal(await c.toggle(),false);done();await pending;assert.equal(f.calls.length,1);
});
test('Musique : une réponse tardive ne rétablit pas un accès retiré',async()=>{
 let first;let requests=0;const c=createMediaController({getState(){return ++requests===1?new Promise(r=>first=r):Promise.resolve(native([],'required'));}});
 const old=c.refresh();await c.refresh();first(native());await old;assert.equal(c.snapshot().state.permission,'required');
});
test('Musique : les événements et leur nettoyage restent locaux',async()=>{
 const f=fake(),c=createMediaController(f.adapter);await c.listen();f.set(native([row('phone','paused')]));f.emit();
 await new Promise(r=>setImmediate(r));assert.equal(c.snapshot().session.label,'Lecteur du téléphone');await c.destroy();assert.equal(f.removed(),true);
});
test('Musique : l’aide explique le web, les priorités et la permission sans annoncer une migration',()=>{
 const [title,steps]=helpFor({context:'music'}),text=steps.join(' ');
 assert.match(title,/musique/);assert.match(text,/YouTube Music/);assert.match(text,/version web/);assert.match(text,/notifications/);assert.match(text,/future version Android/);
});

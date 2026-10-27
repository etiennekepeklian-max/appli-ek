import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingDayDrafts,switchDayDraftState} from '../site/js/day-drafts-core.js';
import {restartDayPlan} from '../site/js/day-core.js';
import {protectedFiles} from '../site/js/archive-core.js';

const yesterday={date:'2026-10-26',pages:[{id:'yesterday',photoId:'photo-old',text:'Lecture conservée',reviewed:true,sections:[{number:'000001234',lines:[{sku:'001234',quantity:12}]}]}],choices:{'000001234':'replace'}};
test('passer à aujourd’hui conserve hier sans changer sa date, ses lectures ni ses choix',()=>{
  const old=structuredClone(yesterday),today=switchDayDraftState('2026-10-27',yesterday);
  assert.deepEqual(today.draft,{date:'2026-10-27',pages:[],choices:{}});
  assert.deepEqual(today.backlog['2026-10-26'],old);assert.deepEqual(yesterday,old);
  today.draft.pages.push({id:'today',photoId:'photo-new'});
  const resumed=switchDayDraftState('2026-10-26',today.draft,today.backlog);
  assert.deepEqual(resumed.draft,old);assert.equal(resumed.backlog['2026-10-27'].pages[0].photoId,'photo-new');
  assert.deepEqual(pendingDayDrafts(resumed.draft,resumed.backlog).map(d=>d.date),['2026-10-27','2026-10-26']);
});
test('un changement vers la même date conserve les corrections et supprime une copie ancienne',()=>{
  const result=switchDayDraftState(yesterday.date,yesterday,{[yesterday.date]:{...yesterday,pages:[{id:'obsolete'}]}});
  assert.deepEqual(result.draft,yesterday);assert.deepEqual(result.backlog,{});
  assert.deepEqual(pendingDayDrafts({...yesterday,pages:[]},{[yesterday.date]:yesterday}),[]);
});
test('validation ou abandon de la session active ne retire pas les journées en attente',()=>{
  const backlog={[yesterday.date]:yesterday};
  assert.deepEqual(pendingDayDrafts(null,backlog),[yesterday]);
  assert.deepEqual(switchDayDraftState(yesterday.date,null,backlog).draft,yesterday);
  assert.throws(()=>switchDayDraftState('2026-02-31',null,backlog),/valide/);
});
test('recommencer une date inclut ses photos en attente dans la garde de concurrence',()=>{
  const orders=[{id:'one',date:yesterday.date,number:'000001234',total:3}],active={date:'2026-10-27',pages:[{id:'new'}]},backlog={[yesterday.date]:yesterday};
  const a=restartDayPlan(yesterday.date,orders,[],active,backlog);
  assert.equal(a.photos,1);assert.equal(a.otherDraft,true);
  assert.notEqual(a.signature,restartDayPlan(yesterday.date,orders,[],active,{...backlog,[yesterday.date]:{...yesterday,pages:[]}}).signature);
});
test('les photos des journées en attente sont protégées contre le retrait local',()=>{
  assert.equal(protectedFiles([{id:'photo-old'}],[],[{key:'day-capture-backlog',value:{[yesterday.date]:yesterday}}]).has('photo-old'),true);
});

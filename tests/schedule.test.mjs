import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SCHEDULE,scheduleEvents,dueReminders,validateSchedule,zonedParts} from '../site/js/schedule-core.js';
import {SHEETS,SHEET_TABS,HEADERS,rowForEvent,eventFromRow} from '../site/js/core.js';
test('Les six transitions respectent exactement les durées et les huit minutes de préavis',()=>{
 assert.deepEqual(scheduleEvents().map(e=>[e.time,e.reminder]),[['08:00','07:52'],['10:15','10:07'],['10:30','10:22'],['12:30','12:22'],['13:15','13:07'],['16:00','15:52']]);
 const changed=scheduleEvents({...DEFAULT_SCHEDULE,breakMinutes:20,lunchMinutes:60});assert.equal(changed[2].time,'10:35');assert.equal(changed[4].reminder,'13:22');
});
test('Paris été/hiver, jours non travaillés et week-end explicite',()=>{
 assert.equal(dueReminders(DEFAULT_SCHEDULE,new Date('2026-10-23T05:52:00Z'))[0].id,'start');
 assert.equal(dueReminders(DEFAULT_SCHEDULE,new Date('2026-10-26T06:52:00Z'))[0].id,'start');
 assert.deepEqual(dueReminders(DEFAULT_SCHEDULE,new Date('2026-10-25T06:52:00Z')),[]);
 assert.equal(dueReminders({...DEFAULT_SCHEDULE,days:[0]},new Date('2026-10-25T06:52:00Z'))[0].id,'start');
 assert.equal(zonedParts(new Date('2026-12-31T23:30:00Z')).date,'2027-01-01');
});
test('Un rappel acquitté ne revient pas ; un retour dans la fenêtre rattrape le rappel sans alerte périmée',()=>{
 const now=new Date('2026-10-26T06:56:00Z');const event=dueReminders(DEFAULT_SCHEDULE,now)[0];assert.equal(event.key,'2026-10-26:start');
 assert.deepEqual(dueReminders(DEFAULT_SCHEDULE,now,{[event.key]:'ack'}),[]);
 assert.deepEqual(dueReminders(DEFAULT_SCHEDULE,new Date('2026-10-26T07:00:00Z')),[]);
 assert.deepEqual(dueReminders({...DEFAULT_SCHEDULE,enabled:false},now),[]);
 assert.deepEqual(dueReminders(DEFAULT_SCHEDULE,new Date('2026-10-26T06:51:59Z')),[]);
});
test('Horaires chevauchants, durées invalides et aucun jour actif sont refusés',()=>{
 for(const input of [{breakStart:'14:00'},{breakMinutes:0},{lunchMinutes:300},{days:[]},{start:'25:00'},{end:'12:40'}])assert.throws(()=>validateSchedule(input));
 assert.equal(validateSchedule({enabled:false,days:[]}).days.length,0);
});
test('Quatre onglets seulement et reconstruction des types mêlés sans perdre les zéros ni les révisions',()=>{
 assert.deepEqual(SHEET_TABS,['produit','manquant','objectif picking','historique']);assert.equal(HEADERS.length,12);
 for(const [type,tab] of Object.entries(SHEETS)){
  assert.ok(SHEET_TABS.includes(tab));const event={id:'event-'+type,type,updatedAt:'2026-10-25T01:00:00Z',record:{id:'record-'+type,sku:'001234',location:'PAC001-A'},schema:1};
  assert.equal(eventFromRow(rowForEvent(event)).type,type);assert.equal(eventFromRow(rowForEvent(event)).record.sku,'001234');
 }
 assert.equal(eventFromRow(['id','','2026-10-25T01:00:00Z','','','','','','','','{"type":"voice","record":{"id":"memo"}}']),null);
});

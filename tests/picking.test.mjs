import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyStats,rowForEvent,eventFromRow} from '../site/js/core.js';
import {validPickingDate,pickingDayRecord,pickingSeries,pickingSummary,pickingHistory,latestPickingDay} from '../site/js/picking-core.js';
import {weeklySummary} from '../site/js/ops-core.js';

test('manual manager totals replace legacy calculations and support corrections including zero',()=>{
  const orders=[{id:'old',date:'2026-10-26',status:'completed',number:'001',total:100,calculationStatus:'estimated'}];
  const first=pickingDayRecord({date:'2026-10-26',manualTotal:'1400',manualCommands:'17',manualParcels:'0',manualWeightKg:'125,5'});
  const s=dailyStats(first.date,orders,[first]);assert.equal(s.total,1400);assert.equal(s.calculated,100);assert.equal(s.commands,17);assert.equal(s.parcels,0);assert.equal(s.pallets,null);assert.equal(s.weightKg,125.5);assert.equal(s.status,'manual');
  const corrected=pickingDayRecord({date:first.date,manualTotal:'0'},first);assert.equal(dailyStats(first.date,orders,[corrected]).total,0);assert.equal(dailyStats(first.date,orders,[corrected]).hasData,true);assert.equal(corrected.manualCommands,null);assert.equal(orders[0].total,100);
});
test('unknown optional counts stay empty even when archived orders exist',()=>{
  const record=pickingDayRecord({date:'2026-10-26',manualTotal:'7'}),stats=dailyStats(record.date,[{date:record.date,number:'OLD',status:'completed',total:99}],[record]);
  assert.equal(stats.commands,null);assert.equal(stats.parcels,null);assert.equal(stats.pallets,null);assert.equal(stats.weightKg,null);
});
test('manual figures reject missing, negative, fractional counts and invalid dates',()=>{
  for(const bad of ['',null,'-1','1.5','NaN','Infinity','1000000001'])assert.throws(()=>pickingDayRecord({date:'2026-10-26',manualTotal:bad}));
  for(const key of ['manualCommands','manualParcels','manualPallets'])assert.throws(()=>pickingDayRecord({date:'2026-10-26',manualTotal:'0',[key]:'1.5'}));
  assert.throws(()=>pickingDayRecord({date:'2026-10-26',manualTotal:'0',manualWeightKg:'-1'}));
  for(const date of ['2026-02-30','2026-13-01','26-10-26','',null,'2026-04-31'])assert.equal(validPickingDate(date),false);
  assert.equal(validPickingDate('2024-02-29'),true);assert.equal(validPickingDate('2026-02-29'),false);
});
test('chart periods include saved zero, exclude missing data and end on selected date',()=>{
  const days=[{date:'2026-10-25',manualTotal:0,manualCommands:0},{date:'2026-10-26',manualTotal:100,manualCommands:null}];
  const s=pickingSeries('2026-10-27',7,[],days);assert.equal(s.length,7);assert.equal(s[0].date,'2026-10-21');assert.equal(s.at(-1).date,'2026-10-27');
  assert.deepEqual(pickingSummary(s),{total:100,average:50,best:100,days:2});assert.equal(pickingSummary(s,'parcels').days,0);
  assert.deepEqual(pickingSummary(pickingSeries('2026-10-27',14,[],[])),{total:null,average:null,best:null,days:0});
  for(const n of [7,14,30,90])assert.equal(pickingSeries('2026-10-27',n,[],[]).length,n);
});
test('history uses the latest live record per date, includes old corrections and skips deleted dates',()=>{
  const days=[{id:'a',date:'2026-10-26',manualTotal:5,updatedAt:'1'},{id:'b',date:'2026-10-26',manualTotal:7,updatedAt:'2'},{id:'c',date:'2026-10-27',manualTotal:9,deleted:true}];
  assert.equal(latestPickingDay('2026-10-26',days).id,'b');assert.equal(pickingHistory([],days).length,1);assert.equal(pickingHistory([],days)[0].total,7);assert.equal(pickingHistory([],days)[0].status,'corrected');
});
test('daily manager data survives the existing Google event-row format',()=>{
  const record={id:'manager-day',...pickingDayRecord({date:'2026-10-26',manualTotal:'1800',manualCommands:'12',manualParcels:'5',manualPallets:'1',manualWeightKg:'20,25',reason:'Manager',notes:'À vérifier'})};
  const event={id:'event',type:'days',record,action:'Chiffres enregistrés',updatedAt:'2026-10-27T10:00:00Z',deviceId:'test',actor:'Test',schema:1};
  assert.deepEqual(eventFromRow(rowForEvent(event)).record,record);assert.equal(rowForEvent(event)[5],record.date);assert.equal(rowForEvent(event)[9],1800);
});

test('weekly journal uses manager quantities and distinguishes unknown command totals',()=>{
 const a=pickingDayRecord({date:'2026-10-26',manualTotal:'100'}),b=pickingDayRecord({date:'2026-10-27',manualTotal:'200',manualCommands:'3'});
 assert.equal(weeklySummary('2026-10-27',[],[a],[],[]).commands,null);const result=weeklySummary('2026-10-27',[],[a,b],[],[]);assert.equal(result.total,300);assert.equal(result.commands,3);assert.equal(result.commandsPartial,true);
});

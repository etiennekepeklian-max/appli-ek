import test from 'node:test';
import assert from 'node:assert/strict';
import {businessActivity} from '../site/js/activity-core.js';
import {validActivity,serverLabel,ingest} from '../backend/pikeo-api/activity-service.mjs';
const id=()=>crypto.randomUUID();
const event=()=>({id:id(),type:'pending',updatedAt:new Date().toISOString(),record:{id:id(),notes:'private text',photo:'secret'}});
test('audit extracts metadata only and excludes private data and preferences',()=>{
 const source=event(),rows=businessActivity([source,{...event(),type:'preferences'},{...event(),type:'journal'},{...event(),type:'voice'}]);
 assert.equal(rows.length,1);assert.equal(validActivity(rows[0]),true);assert.ok(!JSON.stringify(rows).includes('private'));assert.ok(!JSON.stringify(rows).includes('secret'));
 assert.equal(businessActivity([{...source,baseEventId:id()}])[0].action,'update');
 assert.equal(businessActivity([{...source,record:{id:id(),deleted:true}}])[0].action,'delete');
});
test('client cannot declare a server login or arbitrary private resource',()=>{
 const e=businessActivity([event()])[0];for(const altered of [{...e,action:'login'},{...e,resourceType:'voice'},{...e,eventId:'bad'},{...e,occurredAt:'bad'},{...e,resourceId:''},{...e,resourceId:'a'.repeat(161)}])assert.equal(validActivity(altered),false);
 assert.equal(serverLabel('user-pin-unlock',true),'login-denied');assert.equal(serverLabel('user-pin-enroll',false),'login-enroll');
});
test('ingestion attributes events to verified caller and never passes caller identity or payload',async()=>{
 const writes=[],sql=(parts,...values)=>{writes.push({query:parts.join('?'),values});return Promise.resolve([]);};
 const e={...businessActivity([event()])[0],deviceId:'forged',profileId:'forged',pin:'1234',details:'private'};
 await ingest(sql,{profile_id:'actual-profile',id:'actual-device'},[e]);
 assert.equal(writes[0].values[1],'actual-profile');assert.equal(writes[0].values[2],'actual-device');assert.ok(!JSON.stringify(writes).includes('forged'));assert.ok(!JSON.stringify(writes).includes('1234'));assert.match(writes[0].query,/on conflict\(device_id,event_id\) do nothing/);
});

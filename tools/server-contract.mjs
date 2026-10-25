import assert from 'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';
import{createDeviceKeys,publicJWK,signedRequest,encryptMessage,decryptMessage}from'../site/js/session-crypto.js';
const endpoint='https://wcmuffmyozjolaaahhff.supabase.co/functions/v1/pikeo-api',ids=[],suffix=crypto.randomUUID().slice(0,8);
async function api(user,action,values={},request){const payload={action,deviceId:user.id,timestamp:Date.now(),nonce:crypto.randomUUID(),...values},body=request||await signedRequest(payload,user.keys.signing.privateKey),r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),body};}
async function device(name,secret){const user={id:crypto.randomUUID(),keys:await createDeviceKeys()};const r=await api(user,'register',{name,signingKey:await publicJWK(user.keys.signing.publicKey),encryptionKey:await publicJWK(user.keys.encryption.publicKey),...(secret?{ownerSecret:secret}:{})});assert.equal(r.status,200,JSON.stringify(r.data));user.session=r.data.session;ids.push({device:user.id,profile:user.session.profileId,name:user.session.name});return user;}
try{
 const access=JSON.parse(await readFile(process.env.PIKEO_OWNER_ACCESS_FILE,'utf8'));
 const alice=await device('Test Alice '+suffix),bob=await device('Test Bob '+suffix),namesake=await device('Étienne'),owner=await device('Étienne',access.secret);
 assert.equal(namesake.session.role,'operator');assert.equal(owner.session.owner,true);
 assert.equal((await api(alice,'config-put',{version:0,data:{records:[]}})).status,403);
 const s=await api(alice,'session');assert.equal(s.status,200);assert.equal((await api(alice,'session',{},s.body)).status,409);
 const bad={...s.body,payload:{...s.body.payload,action:'config-put'}};assert.equal((await api(alice,'session',{},bad)).status,401);
 const id=crypto.randomUUID(),text='Message privé synthétique '+suffix,envelope=await encryptMessage(text,await publicJWK(bob.keys.encryption.publicKey),id,alice.id,bob.id);
 assert.equal((await api(alice,'send',{messages:[{id,recipientDevice:bob.id,envelope}]})).status,200);
 let inbox=await api(bob,'inbox');assert.equal(inbox.data.messages.length,1);assert.ok(!JSON.stringify(inbox.data).includes(text));assert.equal(await decryptMessage(inbox.data.messages[0].envelope,bob.keys.encryption.privateKey,id,alice.id,bob.id),text);
 await assert.rejects(()=>decryptMessage(envelope,owner.keys.encryption.privateKey,id,alice.id,bob.id));
 await api(alice,'ack',{ids:[id]});assert.equal((await api(bob,'inbox')).data.messages.length,1);await api(bob,'ack',{ids:[id]});assert.equal((await api(bob,'inbox')).data.messages.length,0);
 assert.equal((await api(owner,'set-role',{target:alice.id,role:'admin'})).status,200);assert.equal((await api(alice,'session')).data.session.role,'admin');assert.equal((await api(alice,'set-role',{target:bob.id,role:'admin'})).status,403);
 const config=await api(owner,'config-get');assert.equal((await api(alice,'config-put',{version:config.data.version,data:config.data.data})).status,200);
 assert.equal((await api(owner,'set-role',{target:alice.id,role:'revoked'})).status,200);assert.equal((await api(alice,'session')).status,401);
 await api(bob,'sharing',{enabled:true});await api(bob,'achievement',{category:'entraide'});assert.ok((await api(bob,'team')).data.achievements.some(a=>a.name===bob.session.name));await api(bob,'sharing',{enabled:false});assert.ok(!(await api(owner,'team')).data.achievements.some(a=>a.name===bob.session.name));
 assert.equal((await fetch(endpoint,{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json'},body:'{}'})).status,403);
 console.log('Contrat serveur réel OK : noms sans mot de passe, admin protégé, signatures, anti-rejeu, autorisations, messages chiffrés, accusés et retrait du partage.');
}finally{await writeFile('/tmp/pikeo-test-server-ids.json',JSON.stringify(ids));}

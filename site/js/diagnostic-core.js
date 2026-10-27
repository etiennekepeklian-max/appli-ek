import {refKey,orderKey,estimateLines,dailyStats,latestRecords,makeEvent,rowForEvent,eventFromRow,SHEET_TABS,toCSV,validBarcode} from './core.js';
import {pickingRule,inferFamily} from './catalogue-core.js';
import {parseDayPage,buildDayPlan,dayRecord,restartDayPlan,sheetQuantity} from './day-core.js';
import {catalogueProposal} from './day-catalogue-core.js';
import {locationValue,referenceMatches} from './field-core.js';
import {parseDelimited,parseLocationImport,weeklySummary,isOverdue,quadTransform} from './ops-core.js';
import {pendingDuplicates,preferredLocation,backupPresentation} from './workflow-core.js';
import {parseEnfText,validateEnf,combineEnfLines} from './enf-core.js';
import {scheduleEvents,dueReminders} from './schedule-core.js';
import {handoffText,personalPreferences,dayFeedback,resumeQueue} from './workbench-core.js';
import {createFileArchive,parseFileArchive,protectedFiles} from './archive-core.js';
import {generateRecoveryKey,importRecoveryKey,sealJSON,openJSON,fromBase64} from './secure-core.js';
import {createDeviceKeys,publicJWK,encryptMessage,decryptMessage,localSeal,localOpen,signedRequest} from './session-crypto.js';
import {parsePendingVoice} from './pending-voice-core.js';
import {photoCleanupPlan} from './photo-cleanup-core.js';
import {HELP,jcMessage} from './help-core.js';
import {TOOLS,searchTools} from './navigation-core.js';
import {checkAddress,checkContents} from './training-core.js';

const assert=value=>{if(!value)throw Error('Résultat différent de celui attendu.');};
const same=(a,b)=>assert(JSON.stringify(a)===JSON.stringify(b));
const date='2026-01-05';
const product={id:'test-product',sku:'001234',name:'Carte de test',familyId:'cartes',location:'PAC001-A',unitsPerPick:4};
const sheet=(page,header='Commande 009876543 /001')=>header+'\nPage '+page+'/2\nAdresse;Quantité;Article;Désignation Article;Code alpha\nPAC 001-A;12;001234;Carte de test;CA';
const check=(id,label,run)=>({id,label,run,failure:'Le résultat du test est inattendu. Relancez le contrôle ; si cela persiste, signalez ce contrôle.'});

// All examples are synthetic. These checks never open a user database or call a service.
export function businessChecks(){return [
 check('references','Références et adresses PAC / PAD / RES',()=>{
  same(refKey(' 001234 '),'001234');same(locationValue('PAC001-A','RES'),'RES001-A');same(locationValue('001-A','PAD'),'PAD001-A');
  same(referenceMatches('001234',[product]).exact[0].id,product.id);same(referenceMatches('1234',[product]).status,'unknown');
 }),
 check('rules','Règles par famille et exceptions produit',()=>{
  const families=[{id:'cartes',unitsPerPick:4},{id:'special',parentId:'cartes'}];
  same(pickingRule({familyId:'special'},families).units,4);same(pickingRule({familyId:'special',unitsPerPick:6},families).units,6);
  same(inferFamily({name:'Carte de test'}),'cartes');same(pickingRule({},families).units,null);
 }),
 check('picking','Calcul des pickings et estimations',()=>{
  const known=estimateLines([{sku:'001234',quantity:13,pack:4}]);same(known.total,4);same(known.status,'verified');
  const unknown=estimateLines([{sku:'001234',quantity:13,pack:''}]);same(unknown.status,'estimated');same(unknown.maximum,13);
  same(sheetQuantity('~6~'),6);same(sheetQuantity('(12) manquant'),12);same(sheetQuantity('1O'),null);
 }),
 check('pages','Commandes multipages, numéros et doublons',()=>{
  const sections=[parseDayPage(sheet(1)),parseDayPage(sheet(2,'N° Enreglstrement 009876543001'))];
  const pages=sections.map((s,i)=>({id:'page-'+i,hash:'image-'+i,reviewed:true,sections:s}));
  const plan=buildDayPlan([...pages,{...pages[0],id:'duplicate'}],[],date,()=>product);
  same(plan.orders.length,1);same(plan.orders[0].estimate.total,6);same(plan.duplicatePages,1);
  same(orderKey(plan.orders[0].number),'9876543');same(dayRecord(plan.orders[0],date).total,6);
 }),
 check('restart','Bilan et reprise d’une journée',()=>{
  const orders=[{id:'o',number:'009876543',date,status:'completed',total:6,calculationStatus:'verified'},{id:'other',date:'2026-01-06',status:'completed',total:9}];
  const stats=dailyStats(date,orders,[],10);same(stats.total,6);same(stats.commands,1);
  const plan=restartDayPlan(date,orders,[],null);same(plan.items.map(i=>i.record.id),['o']);same(plan.nextSession.pages,[]);
  same(dailyStats(date,orders,[{date,manualTotal:8}],10).total,8);same(weeklySummary(date,orders,[],[],[],10).total,15);
 }),
 check('catalogue','Mise à jour du catalogue depuis les feuilles',()=>{
  const proposal=catalogueProposal([{lines:[{sku:'001234',location:'RES002',designation:'Nom OCR'},{sku:'005678',location:'PAD003',designation:'Carte test'}]}],[product]);
  same(proposal.created,1);same(proposal.updated,1);const kept=proposal.items.find(i=>i.record.id===product.id).record;
  same(kept.name,product.name);same(kept.unitsPerPick,4);assert(kept.locations.includes('RES002'));same(proposal.items.find(i=>i.record.sku==='005678').record.unitsPerPick,null);
 }),
 check('csv','Import des emplacements et exports CSV',()=>{
  const p=parseLocationImport('\uFEFFreference;emplacement\n001234;PAC001-A\n001234;PAC001-A\n001234;RES002');same(p.links.length,2);same(p.duplicates,1);same(p.links[0].sku,'001234');
  same(parseDelimited('a;b\n"avec;point";"deux"')[1],['avec;point','deux']);
  same(parseDelimited(toCSV(['Référence','Casier'],[['001234','PAC001-A']]))[1],['001234','PAC001-A']);
 }),
 check('pending','Manquants, réassorts et message pour JC',()=>{
  const voice=parsePendingVoice('commande 0000123 référence zéro zéro un deux trois quatre');same(voice.orderNumber,'0000123');same(voice.sku,'001234');
  const rows=[{id:'p',orderNumber:'TEST',sku:'001234',status:'waiting',location:'PAC001-A',createdAt:'2026-01-05T08:00:00Z'}];
  same(pendingDuplicates(rows,{orderNumber:'TEST',sku:'001234'}).length,1);assert(isOverdue(rows[0],Date.parse('2026-01-05T08:31:00Z')));
  assert(jcMessage(rows[0]).includes('PAC001-A'));same(preferredLocation(product),'PAC001-A');same(preferredLocation({...product,locations:['RES002']}),'');
  same(resumeQueue([{...rows[0],status:'received'}]).length,1);
 }),
 check('enf','ENF : lecture, composition et quantités',()=>{
  const p=parseEnfText('ENF TEST-100\n001234;4\n005678;2',[product]);same(p.code,'TEST-100');same(p.lines.length,2);
  same(validateEnf({code:'TEST-100',lines:p.lines}).lines[0].quantity,4);same(combineEnfLines([{sku:'001234',quantity:4},{sku:'001234',quantity:2}])[0].quantity,6);
 }),
 check('history','Historique et format Google à quatre onglets',()=>{
  const event=makeEvent('products',product,'Test','Exemple','test-device');const restored=eventFromRow(rowForEvent(event));same(restored.record.sku,'001234');
  same(latestRecords([event,event]).size,1);same([...SHEET_TABS].sort(),['historique','manquant','objectif picking','produit']);
  same(backupPresentation({configured:true,connected:true,pending:1}).kind,'pending');
 }),
 check('archive','Archives : intégrité et fichiers protégés',async()=>{
  const purge=photoCleanupPlan({files:[{id:'cleanup-test',kind:'day-photo',createdAt:'2026-01-05T12:00:00Z',blob:new Blob(['x'],{type:'image/png'})}],events:[],metadata:[]},[],[date]);same(purge.count,1);
  const file={id:'synthetic',name:'test.txt',kind:'document',blob:new Blob(['Pikeo test'],{type:'text/plain'})};
  const archive=await createFileArchive([file]);const parsed=await parseFileArchive(archive);same(await parsed.rows[0].blob.text(),'Pikeo test');
  same(protectedFiles([{...file,kind:'voice'}],[]).size,1);
 }),
 check('crypto','Anciennes sauvegardes chiffrées',async()=>{
  const key=await importRecoveryKey(await generateRecoveryKey()),data={app:'test',value:'001234'},sealed=await sealJSON(data,key);same(await openJSON(sealed,key),data);
  let blocked=false;try{await openJSON(sealed,key,'other-context');}catch{blocked=true;}assert(blocked);
 }),
 check('messages','Chiffrement des messages et signatures des sessions',async()=>{
  const keys=await createDeviceKeys(),envelope=await encryptMessage('Test local',await publicJWK(keys.encryption.publicKey),'test-message','a','b');
  same(await decryptMessage(envelope,keys.encryption.privateKey,'test-message','a','b'),'Test local');
  same(await localOpen(await localSeal({text:'Test'},keys.local),keys.local),{text:'Test'});
  const p={action:'test'},signed=await signedRequest(p,keys.signing.privateKey);assert(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},keys.signing.publicKey,fromBase64(signed.signature),new TextEncoder().encode(JSON.stringify(p))));
 }),
 check('schedule','Horaires et rappels en heure de Paris',()=>{
  same(scheduleEvents().map(e=>e.reminder),['07:52','10:07','10:22','12:22','13:07','15:52']);
  same(dueReminders({},new Date('2026-01-05T06:53:00Z')).length,1);same(dueReminders({},new Date('2026-01-04T06:53:00Z')).length,0);
 }),
 check('privacy','Préférences et partage volontaire',()=>{
  assert(!handoffText([{orderNumber:'TEST',sku:'001234',notes:'NOTE PRIVEE',status:'waiting'}]).includes('NOTE PRIVEE'));
  same(personalPreferences().shareAchievements,false);same(dayFeedback({hasData:true,total:100,goal:10,status:'estimated'}).celebrate,false);
 }),
 check('photo','Cadrage des photos et formats des codes-barres',()=>{
  const transform=quadTransform([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]);same(transform(.5,.5),{x:50,y:50});
  validBarcode('001234','CODE39');validBarcode('001234','CODE128');
 }),
 check('help','Navigation, aide et exercices',()=>{
  assert(TOOLS.every(t=>t.action||HELP[t.id]));assert(searchTools('diagnostic').some(t=>t.id==='diagnostic'));
  assert(checkAddress('PAC','0102'));assert(checkContents(4,2));
 })
];}

export function summarize(rows){return {passed:rows.filter(r=>r.status==='pass').length,failed:rows.filter(r=>r.status==='fail').length,warnings:rows.filter(r=>r.status==='warn').length,manual:rows.filter(r=>r.status==='manual').length};}
export async function runChecks(checks,{onResult=()=>{},current=()=>true}={}){
 const rows=[];
 for(const item of checks){
  if(!current())return {cancelled:true,rows};
  let result;try{result={id:item.id,label:item.label,status:'pass',detail:'Test réussi.',...await item.run()};}catch{result={id:item.id,label:item.label,status:'fail',detail:item.failure||'Contrôle indisponible. Relancez-le.'};}
  if(!current())return {cancelled:true,rows};
  rows.push(result);await onResult(result,rows.length,checks.length);await new Promise(resolve=>setTimeout(resolve,0));
 }
 return {cancelled:false,rows};
}

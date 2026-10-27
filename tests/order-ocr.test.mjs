import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDayPage,printedIdentity,buildDayPlan} from '../site/js/day-core.js';
import {orderKey} from '../site/js/core.js';
import {layoutText} from '../site/js/ocr-layout-core.js';
import {selectOrderText,needsOrderRetry,identityText} from '../site/js/order-ocr-core.js';

test('enregistrement : variantes OCR du libellé, espaces numériques et suffixe sans modifier les chiffres',()=>{
 for(const label of ['Enregistrement','Enreglstrement','Enregistement','Ervegistrement','Enregistoment']){
  const found=printedIdentity('N° '+label+' : 000 009 123 001 Cde ECR : EXEMPLE');assert.ok(found,label);assert.equal(found.kind,'registration');assert.equal(orderKey(found.number),'9123');
 }
 assert.equal(orderKey(printedIdentity('Commande : 000009123 / 001').number),'9123');
 assert.equal(orderKey(printedIdentity('Commande : 000009123 001').number),'9123');
 assert.equal(parseDayPage('Commande 000009123001\nEnregistrement 000009123001\nRéférence;Quantité préparée\nTEST001;4')[0].number,'000009123');
 assert.equal(printedIdentity('Commande : 0000O9123').number,'0000O9123');
});
test('références client, bon de préparation et mots CDE/GOLD ne deviennent pas des commandes',()=>{
 for(const text of ['Commande : CDE ECR TEST','COMMANDE GOLD N° 123456789','Réf Commande client : ABC123','Réf Commande : ABC123','Bon de préparation N° 123456789'])assert.equal(printedIdentity(text),null,text);
});
test('page et en-tête du tableau avant Commande sont conservés, adresses client exclues des articles',()=>{
 const text='MAGASIN TEST 42\nPage 2\nAdresse;Quantité;Article;Désignation\nCommande : 000009123 /001\nCLIENT-TEST Magasin 9\nPAC A01;12;001234;Carte';
 const sections=parseDayPage(text);assert.equal(sections.length,1);assert.equal(sections[0].pageNumber,2);assert.equal(sections[0].lines.length,1);assert.equal(sections[0].lines[0].sku,'001234');
 assert.equal(parseDayPage('Enregistrement : 000009123001 Page 3\nRéférence;Quantité\nTEST001;4')[0].pageNumber,3);
});
test('commande/enregistrement contradictoires de part et d’autre du tableau : une seule commande à vérifier',()=>{
 const s=parseDayPage('Enregistrement : 000009123001\nAdresse;Quantité;Article\nCommande : 0O0009123/001\nPAC A01;12;001234');assert.equal(s.length,1);assert.equal(s[0].number,'000009123');assert.equal(s[0].identityConflict,true);
 const n=parseDayPage('Enregistrement : 000009124001\nAdresse;Quantité;Article\nCommande : 000009123/001\nPAC A01;12;001234');assert.equal(n.length,1);assert.equal(n[0].number,'000009123');assert.equal(n[0].identityConflict,true);
});
test('bordures et marques autour des lignes : quantité lue, ligne perdue signalée plutôt que supprimée silencieusement',()=>{
 const sections=parseDayPage('Commande TEST001\nPage 1\n— PAC A01 | 12 | 001234 | Carte\n= PAD A02 | ? | 005678 | Carte\nRES A03 quantité masquée article illisible');
 assert.equal(sections[0].lines.length,2);assert.equal(sections[0].lines[0].quantity,12);assert.equal(sections[0].lines[1].quantity,null);assert.equal(sections[0].unreadRows.length,1);assert.equal(sections[0].needsReview,true);
 assert.ok(buildDayPlan([{id:'a',text:'',sections}],[],'2026-01-05',()=>({unitsPerPick:4})).problems.length);
});
test('lignes TSV de hauteurs différentes regroupées sur leur ligne imprimée',()=>{
 const word=(left,top,height,text)=>['5',1,1,1,1,1,left,top,70,height,95,text].join('\t');
 const text=layoutText(['header',word(0,40,24,'PAC A01'),word(120,46,18,'12'),word(215,44,20,'001234'),word(300,61,3,'|'),word(380,40,24,'Carte')].join('\n'));
 assert.equal(text.split('\n').length,1);assert.match(text,/PAC A01.*12.*001234.*Carte/);
});
test('relecture : erreurs/numéros ou lignes absents repris ; corrections manuelles et pages écartées protégées',()=>{
 const good={sections:[{number:'TEST001',lines:[{sku:'001234',quantity:4}]}]};
 assert.equal(needsOrderRetry(good),false);assert.equal(needsOrderRetry({sections:[{number:'',lines:[]}]}),true);assert.equal(needsOrderRetry({...good,error:'Ancienne erreur'}),true);assert.equal(needsOrderRetry({sections:[]}),true);
 assert.equal(needsOrderRetry({error:'Erreur',reviewed:true}),false);assert.equal(needsOrderRetry({excluded:true}),false);assert.equal(needsOrderRetry({sections:[{...good.sections[0],unreadRows:['À relire']}]}),true);
});
test('texte brut et mise en lignes comparés ; aucun regroupement de références entre deux lectures',()=>{
 const raw='Enregistrement : 000009123001\nRéférence;Quantité\nTEST001;12',best=selectOrderText({text:raw,tsv:''});assert.equal(best.identified,1);assert.equal(best.valid,1);
 assert.equal(identityText('N° Enreglstrement :\n000009123001\nRéf Commande client : CLIENT999'),'Enregistrement : 000009123001');
});
test('un numéro compact de douze chiffres est rapproché entre pages par sa preuve Enregistrement exacte',()=>{
 const page=(id,header,n)=>({id,hash:id,text:header+'\nPage '+n+'/2\nRéférence;Quantité préparée\n001234;12'});
 const p=buildDayPlan([page('a','Commande 000009123001',1),page('b','Enregistrement 000009123001',2)],[],'2026-01-05',()=>({unitsPerPick:4}));assert.equal(p.orders.length,1);assert.equal(p.orders[0].number,'000009123');assert.equal(p.orders[0].estimate.total,6);
 const different=buildDayPlan([page('a','Commande 123456789012',1),page('b','Enregistrement 000009123001',2)],[],'2026-01-05',()=>({unitsPerPick:4}));assert.equal(different.orders.length,2);
 const manual=page('a','Commande 000009123001',1);manual.reviewed=true;assert.equal(buildDayPlan([manual,page('b','Enregistrement 000009123001',2)],[],'2026-01-05',()=>({unitsPerPick:4})).orders.length,2);
});
test('zéros de présentation perdus : rapprochement seulement avec un numéro de commande qui confirme le préfixe exact',()=>{
 const text='Commande 000009123 /001\nEnregistrement 9123001\nRéférence;Quantité préparée\n001234;12';
 // A short registration without the known warehouse width stays ambiguous.
 assert.equal(parseDayPage(text)[0].identityConflict,true);
 const sheet=header=>header+'\nRéférence;Quantité préparée\n001234;12';
 const pages=[{id:'a',hash:'a',text:sheet('Commande 001234567 /001')},{id:'b',hash:'b',text:sheet('Enregistrement 1234567001')}];
 assert.equal(buildDayPlan(pages,[],'2026-01-05',()=>({unitsPerPick:4})).orders.length,1);
 assert.equal(parseDayPage('Commande 001234567 /001\nEnregistrement 1234567001\nRéférence;Quantité préparée\n001234;12')[0].identityConflict,undefined);
 assert.equal(printedIdentity('Enregistrement 1234567001').number,'1234567001');
});

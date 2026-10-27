import {assertPermission} from './identity-context.js';
import {escapeHTML as esc,localDate} from './core.js';
import {icon} from './icons.js';
import {enhanceMobileTables} from './mobile.js';
export {esc,icon};
export const state={route:'home',date:localDate(),query:'',filter:'all',page:0,stockTab:'products',chartDays:7,pickingMetric:'total',catalogue:null,baseFamilies:[],baseProducts:[],codeValue:'',codeStars:false,codeFormat:'CODE128',generated:null,scanResult:null,orderLines:[],orderPhotos:[],selectedOrder:null,orderText:'',formRole:'preparer'};
export const fmt=n=>Number(n??0).toLocaleString('fr-FR');
export const dateLabel=(date,options={day:'numeric',month:'long'})=>new Intl.DateTimeFormat('fr-FR',options).format(new Date(date+'T12:00:00'));
export const timestampLabel=s=>new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
export const shortTime=s=>new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date(s));
export const badge=(text,kind='')=>`<span class="badge ${esc(kind)}">${esc(text)}</span>`;
export const btn=(text,action,ico='',kind='',attrs='')=>`<button type="button" class="btn ${kind}" data-action="${action}" ${attrs}>${ico?icon(ico):''}${text}</button>`;
export const nav=(text,route,ico='',kind='')=>`<button type="button" class="btn ${kind}" data-nav="${route}">${ico?icon(ico):''}${text}</button>`;
export function empty(title,text,ico='box',action='',label='Ajouter') {return `<div class="empty"><div class="empty-icon">${icon(ico)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action?btn(label,action,'plus','primary'):''}</div>`;}
export function pageHeading(title,text='',actions='',eyebrow='Votre espace logistique'){return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${text?`<p>${esc(text)}</p>`:''}</div>${actions?`<div class="heading-actions">${actions}</div>`:''}</div>`;}
export function field(name,label,value='',options={}){
  const id=options.id||'f-'+name;let input;
  const attr=`id="${id}" name="${name}" ${options.required?'required':''} ${options.readonly?'readonly':''} ${options.attrs||''}`;
  if(options.select){input=`<select ${attr}>${options.select.map(o=>{const v=typeof o==='string'?o:o.value;const l=typeof o==='string'?o:o.label;return `<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`;}).join('')}</select>`;}
  else if(options.textarea){input=`<textarea ${attr} placeholder="${esc(options.placeholder||'')}" rows="${options.rows||3}">${esc(value)}</textarea>`;}
  else{input=`<input ${attr} type="${options.type||'text'}" value="${esc(value)}" placeholder="${esc(options.placeholder||'')}" ${options.type==='number'?'min="0" step="1" inputmode="numeric"':''} ${options.code?'autocomplete="off" autocapitalize="characters" spellcheck="false"':''}>`;}
  if(options.voice||options.type==='number')input=`<div class="input-voice">${input}<button type="button" class="mic-btn" data-action="dictate" data-target="${id}" data-code="${options.code?'1':'0'}" aria-label="Dicter ${esc(label)}" title="Dicter">${icon('mic')}</button></div>`;
  return `<div class="field ${options.full?'full':''}"><label for="${id}">${esc(label)}${options.required?' <span aria-hidden="true">*</span>':''}</label>${input}${options.hint?`<p class="hint">${options.hint}</p>`:''}</div>`;
}
export const check=(name,label,checked=false,attrs='')=>`<label class="check-label"><input type="checkbox" name="${name}" ${checked?'checked':''} ${attrs}>${label}</label>`;
let toastTimer,closeHooks=[];
export function toast(message,error=false){const el=document.querySelector('#toast');clearTimeout(toastTimer);el.textContent=message;el.classList.toggle('error',error);el.hidden=false;toastTimer=setTimeout(()=>{el.hidden=true;},error?9000:4500);}
export function modal(title,body,wide=false){const d=document.querySelector('#dialog');if(d.open)closeModal();delete d.dataset.helpContext;document.querySelector('#dialog-title').textContent=title;document.querySelector('#dialog-body').innerHTML=body;d.classList.toggle('wide',wide);enhanceMobileTables(document.querySelector('#dialog-body'));d.showModal();document.querySelector('#dialog-body').scrollTop=0;document.querySelector('#dialog-title').focus({preventScroll:true});}
export function closeModal(){document.querySelector('#help-dialog')?.close();const d=document.querySelector('#dialog');for(const fn of closeHooks.splice(0))fn();if(d.open)d.close();}
export function onModalClose(fn){closeHooks.push(fn);}
export function modalForm(name,body,{id='',submit='Enregistrer',intro='',wide=false,title='Nouvelle fiche'}={}){
  modal(title,`${intro?`<p class="dialog-intro">${intro}</p>`:''}<form data-form="${name}" data-id="${esc(id)}"><div class="form-grid mobile-one">${body}</div><div class="error-message" data-form-error role="alert" hidden></div><div class="form-actions">${btn('Annuler','close-dialog','','')}<button class="btn primary" type="submit">${icon('check')}${submit}</button></div></form>`,wide);
}
export function formError(form,error){const el=form.querySelector('[data-form-error]');if(el){el.textContent=error.message||error;el.hidden=false;el.scrollIntoView({block:'nearest'});}else toast(error.message||error,true);}
export function download(blob,name){assertPermission('exports');const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();modal('Votre fichier est prêt',`<p class="dialog-intro">${esc(name)} · ${Math.max(1,Math.round(blob.size/1024))} Ko</p><p class="small muted">Si le téléchargement ne démarre pas automatiquement, utilisez le bouton ci-dessous.</p><div class="form-actions"><a class="btn primary" href="${url}" download="${esc(name)}">${icon('download')}Télécharger le fichier</a>${btn('Fermer','close-dialog')}</div>`);onModalClose(()=>setTimeout(()=>URL.revokeObjectURL(url),3000));}
export function jsonDownload(data,name){download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),name);}
export function searchbox(value='',placeholder='Rechercher…'){return `<div class="search-box">${icon('search')}<label class="sr-only" for="view-search">${esc(placeholder)}</label><input id="view-search" data-filter-search type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off"></div>`;}
export const datePicker=date=>`<div class="date-picker"><button data-action="previous-date" aria-label="Jour précédent">${icon('arrowleft')}</button><input type="date" aria-label="Journée affichée" id="day-select" value="${esc(date)}"><button data-action="next-date" aria-label="Jour suivant">${icon('arrowright')}</button></div>`;
export function pdfReport(title,lines,fileName='rapport-ek.pdf'){
  if(!window.jspdf?.jsPDF)throw Error('Le moteur PDF n’est pas disponible. Réessayez après rechargement.');
  const pdf=new jspdf.jsPDF();const clean=s=>String(s).replace(/[’‘]/g,"'").replace(/[–—]/g,'-').replace(/œ/g,'oe').replace(/→/g,' > ').replace(/\u202f|\u00a0/g,' ');
  let y=22;pdf.setTextColor(23,61,57);pdf.setFont('helvetica','bold');pdf.setFontSize(19);pdf.text(clean(title),17,y);y+=10;pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(105,125,111);pdf.text('Pikéo · '+new Date().toLocaleDateString('fr-FR'),17,y);y+=13;
  for(const l of lines){const str=typeof l==='string'?l:l.text;const heading=typeof l==='object'&&l.heading;pdf.setFont('helvetica',heading?'bold':'normal');pdf.setFontSize(heading?12:10);pdf.setTextColor(heading?23:57,heading?61:74,heading?57:64);const wrapped=pdf.splitTextToSize(clean(str),174);if(heading&&y+22>276){pdf.addPage();y=20;}for(const line of wrapped){if(y+5.3>276){pdf.addPage();y=20;}pdf.text(line,17,y);y+=5.3;}y+=heading?7:4;}
  const pages=pdf.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(125);pdf.text(`${i} / ${pages}`,193,287,{align:'right'});}download(pdf.output('blob'),fileName);
}



export const optionalDetails=(content,{label='Ajouter un détail',open=false,kind=''}={})=>`<details class="${kind} full" ${open?'open':''}><summary>${esc(label)}</summary>${content}</details>`;

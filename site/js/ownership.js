// Required attribution: deliberately independent from account, role and preferences.
export const OWNERSHIP="Pikéo - propriété intellectuelle d'Etienne Képéklian";
export function withOwnership(data){return data&&typeof data==='object'&&!Array.isArray(data)?{...data,pikeoOwnership:OWNERSHIP}:data;}
export function pdfOwnership(pdf){
 const original=pdf.getCurrentPageInfo?.().pageNumber||1;
 for(let page=1;page<=pdf.getNumberOfPages();page++){
  pdf.setPage(page);const size=pdf.internal.pageSize,w=size.getWidth(),h=size.getHeight();
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(45,45,45);
  pdf.text(OWNERSHIP,w/2,h-6,{align:'center',maxWidth:w-16});
 }
 pdf.setPage(original);return pdf;
}
export function barcodeOwnership(svg){
 if(svg.getAttribute('data-pikeo-ownership')===OWNERSHIP)return svg;
 const ns='http://www.w3.org/2000/svg',view=(svg.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);
 const w=parseFloat(svg.getAttribute('width'))||view[2],h=parseFloat(svg.getAttribute('height'))||view[3];
 if(!(w>0&&h>0))throw Error('Dimensions du code-barres invalides.');
 const width=Math.max(w,Math.ceil(OWNERSHIP.length*6.2+32)),height=h+30;
 const group=document.createElementNS(ns,'g');group.setAttribute('transform',`translate(${(width-w)/2} 0)`);while(svg.firstChild)group.append(svg.firstChild);
 const background=document.createElementNS(ns,'rect');background.setAttribute('width',String(width));background.setAttribute('height',String(height));background.setAttribute('fill','#ffffff');
 const text=document.createElementNS(ns,'text');text.setAttribute('x',String(width/2));text.setAttribute('y',String(height-10));text.setAttribute('text-anchor','middle');text.setAttribute('font-family','Arial, sans-serif');text.setAttribute('font-size','10');text.setAttribute('fill','#222222');text.textContent=OWNERSHIP;
 svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('data-pikeo-ownership',OWNERSHIP);svg.append(background,group,text);return svg;
}
export function csvOwnership(source){
 const bom=source.startsWith('\ufeff')?'\ufeff':'';let text=bom?source.slice(1):source,quote=false,row='',rows=[];
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){row+='""';i++;continue;}quote=!quote;}if(c==='\n'&&!quote){if(row.replace(/\r$/,'').length)rows.push(row.replace(/\r$/,''));row='';}else row+=c;}
 if(row.replace(/\r$/,'').length)rows.push(row.replace(/\r$/,''));if(!rows.length)return source;
 const delimiter=rows[0].includes(';')?';':',';
 return bom+rows.map((r,i)=>r+delimiter+'"'+(i===0?'Propriété intellectuelle':OWNERSHIP).replace(/"/g,'""')+'"').join('\r\n');
}
// A modal lives in the browser top layer: put the print footer in that layer
// while printing, then restore it without closing the form or altering its data.
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 let parent,next;
 window.addEventListener('beforeprint',()=>{const footer=document.querySelector('.pikeo-print-footer'),dialog=document.querySelector('dialog[open]');if(!footer||!dialog||parent)return;parent=footer.parentNode;next=footer.nextSibling;dialog.append(footer);});
 window.addEventListener('afterprint',()=>{if(!parent)return;const footer=document.querySelector('.pikeo-print-footer');if(footer)parent.insertBefore(footer,next?.parentNode===parent?next:null);parent=null;next=null;});
}

// Modal dialogs occupy the top layer. Keep the print footer in that layer too.
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 let original;
 window.addEventListener('beforeprint',()=>{const footer=document.querySelector('.pikeo-print-footer'),dialog=document.querySelector('dialog[open]');if(footer&&dialog&&!dialog.contains(footer)){original={node:footer,parent:footer.parentNode,next:footer.nextSibling};dialog.append(footer);}});
 window.addEventListener('afterprint',()=>{if(original){const {node,parent,next}=original;parent.insertBefore(node,next?.parentNode===parent?next:null);original=null;}});
}

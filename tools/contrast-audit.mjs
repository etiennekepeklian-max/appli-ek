// Inspect the actual cascade, including transparent ancestor surfaces. No page mutation.
export function auditContrast(){
 const rgba=value=>{const n=value.match(/[\d.]+/g)?.map(Number);return n?.length>=3?[n[0],n[1],n[2],n[3]??1]:[0,0,0,0];};
 const over=(fg,bg)=>[...fg.slice(0,3).map((c,i)=>c*fg[3]+bg[i]*(1-fg[3])),1];
 const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const background=el=>{const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);return chain.reduce((bg,p)=>over(rgba(getComputedStyle(p).backgroundColor),bg),[255,255,255,1]);};
 const failures=[];let checked=0,min=99;
 for(const el of document.querySelectorAll('body *')){
  if(!el.getClientRects().length||el.closest('[hidden],[aria-hidden=true],:disabled,.sr-only,.skip-link')||el.matches('option,script,style'))continue;
  const s=getComputedStyle(el);if(s.visibility!=='visible'||Number(s.opacity)<.1)continue;
  const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();
  const field=el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea');
  if(!text&&!field)continue;
  const bg=background(el),fg=over(rgba(el instanceof SVGElement?s.fill:s.color),bg),large=parseFloat(s.fontSize)>=24||parseFloat(s.fontSize)>=18.666&&Number(s.fontWeight)>=700,required=large?3:4.5;
  const pairs=[{text:text||el.value||el.placeholder||'champ',fg}];
  if(field&&el.placeholder)pairs.push({text:'placeholder: '+el.placeholder,fg:over(rgba(getComputedStyle(el,'::placeholder').color),bg)});
  for(const pair of pairs){const r=ratio(pair.fg,bg);checked++;min=Math.min(min,r);if(r+.005<required)failures.push({tag:el.tagName,id:el.id,class:el.className?.baseVal??el.className,text:pair.text.slice(0,90),ratio:+r.toFixed(2),required,fg:pair.fg.slice(0,3),bg:bg.slice(0,3)});}
 }
 return {checked,min:+min.toFixed(2),failures};
}

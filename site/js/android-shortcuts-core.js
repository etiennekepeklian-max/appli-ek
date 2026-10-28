// A shared, strictly allow-listed contract for PWA shortcuts and the future Android widget.
// No account, database or business data is sent through a shortcut URL.
export const SHORTCUTS=Object.freeze({
  barcode:Object.freeze({route:'codes',openForm:false}),
  missing:Object.freeze({route:'pending',openForm:true}),
  products:Object.freeze({route:'stock',openForm:false}),
  enf:Object.freeze({route:'enfs',openForm:false})
});
export function readShortcut(rawUrl){
  let url;
  try{url=new URL(rawUrl,'https://pikeo.invalid/');}catch{return null;}
  let id='';
  if(url.protocol==='pikeo:'&&url.hostname==='shortcut'){
    id=url.pathname.replace(/^\/+|\/+$/g,'');
  }else if(['https:','http:'].includes(url.protocol)){
    id=url.searchParams.get('pikeo-shortcut')||'';
  }else return null;
  return Object.hasOwn(SHORTCUTS,id)?Object.freeze({id,...SHORTCUTS[id]}):null;
}

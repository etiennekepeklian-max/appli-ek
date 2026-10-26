// Tesseract's plain text can read a table column by column. Rebuild physical rows
// from word coordinates; wide gaps become explicit cell separators.
export function layoutText(tsv,fallback=''){
  if(typeof tsv!=='string')return fallback;
  const words=[];
  for(const line of tsv.split(/\r?\n/).slice(1,25001)){
    const c=line.split('\t');if(c[0]!=='5')continue;
    const [left,top,width,height,confidence]=c.slice(6,11).map(Number),text=c.slice(11).join('\t').trim();
    if(text&&[left,top,width,height,confidence].every(Number.isFinite)&&height>0&&confidence>=0)words.push({left,top,width,height,text,center:top+height/2});
  }
  if(!words.length)return fallback;
  words.sort((a,b)=>a.center-b.center||a.left-b.left);const rows=[];
  for(const w of words){
    let row=rows.at(-1);
    if(!row||Math.abs(w.center-row.center)>Math.max(3,Math.min(row.height,w.height)*.48)){row={center:w.center,height:w.height,words:[]};rows.push(row);}
    row.words.push(w);row.center=row.words.reduce((n,a)=>n+a.center,0)/row.words.length;row.height=Math.min(row.height,w.height);
  }
  return rows.map(row=>{row.words.sort((a,b)=>a.left-b.left);let out='',end=0;
    for(const w of row.words){const gap=w.left-end;out+=(out?(gap>Math.max(12,row.height*.85)?'  ':' '):'')+w.text;end=w.left+w.width;}return out;
  }).join('\n');
}

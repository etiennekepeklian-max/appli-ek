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
  const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
  words.sort((a,b)=>a.center-b.center||a.left-b.left);const rows=[];
  for(const w of words){
    const bottom=w.top+w.height;
    // Printed letters and digits have different heights on the same baseline.
    // Tiny punctuation and marker fragments must not split a physical line.
    let row=rows.slice(-4).filter(r=>Math.abs(bottom-r.bottom)<=Math.max(4,Math.max(r.height,w.height)*.45)&&Math.abs(w.center-r.center)<Math.max(r.height,w.height)*.85).sort((a,b)=>Math.abs(bottom-a.bottom)-Math.abs(bottom-b.bottom))[0];
    if(!row){row={center:w.center,bottom,height:w.height,words:[]};rows.push(row);}
    row.words.push(w);row.center=median(row.words.map(a=>a.center));row.bottom=median(row.words.map(a=>a.top+a.height));row.height=median(row.words.map(a=>a.height));
  }
  return rows.sort((a,b)=>a.center-b.center).map(row=>{row.words.sort((a,b)=>a.left-b.left);let out='',end=0;
    for(const w of row.words){const gap=w.left-end;out+=(out?(gap>Math.max(12,row.height*.85)?'  ':' '):'')+w.text;end=w.left+w.width;}return out;
  }).join('\n');
}

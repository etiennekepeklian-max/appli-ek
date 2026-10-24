import {quadTransform,validQuad} from './ops-core.js';

const canvasOf=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export async function compressProductPhoto(file){
  if(!file.type.startsWith('image/')||file.size>25e6)throw Error('Choisissez une image de moins de 25 Mo.');
  const bitmap=await createImageBitmap(file),factor=Math.min(1,1280/Math.max(bitmap.width,bitmap.height)),c=canvasOf(Math.round(bitmap.width*factor),Math.round(bitmap.height*factor));
  c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.85));if(!blob)throw Error('Impossible de préparer cette photo.');return new File([blob],'produit-'+Date.now()+'.jpg',{type:'image/jpeg'});
}
export function detectPage(canvas){
  const factor=Math.min(1,450/Math.max(canvas.width,canvas.height)),small=canvasOf(Math.round(canvas.width*factor),Math.round(canvas.height*factor)),ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,small.width,small.height);
  const {data}=ctx.getImageData(0,0,small.width,small.height),w=small.width,h=small.height,points=[];
  // A white document on a darker surface. On uncertain scenes keep the entire image.
  for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(Math.min(r,g,b)>175&&Math.max(r,g,b)-Math.min(r,g,b)<65)points.push({x,y});}
  if(points.length<w*h*.06)return[{x:0,y:0},{x:canvas.width-1,y:0},{x:canvas.width-1,y:canvas.height-1},{x:0,y:canvas.height-1}];
  const corners=[points.reduce((a,b)=>a.x+a.y<b.x+b.y?a:b),points.reduce((a,b)=>a.x-a.y>b.x-b.y?a:b),points.reduce((a,b)=>a.x+a.y>b.x+b.y?a:b),points.reduce((a,b)=>a.x-a.y<b.x-b.y?a:b)].map(p=>({x:p.x/factor,y:p.y/factor}));
  const area=Math.abs(corners.reduce((s,p,i)=>s+p.x*corners[(i+1)%4].y-p.y*corners[(i+1)%4].x,0))/2;
  return validQuad(corners)&&area>canvas.width*canvas.height*.2?corners:[{x:0,y:0},{x:canvas.width-1,y:0},{x:canvas.width-1,y:canvas.height-1},{x:0,y:canvas.height-1}];
}
export async function rectifyPhoto(source,points){
  const transform=quadTransform(points),width=Math.max(30,Math.round(Math.max(length(points[0],points[1]),length(points[3],points[2])))),height=Math.max(30,Math.round(Math.max(length(points[0],points[3]),length(points[1],points[2])))),factor=Math.min(1,2200/Math.max(width,height)),out=canvasOf(Math.round(width*factor),Math.round(height*factor)),ctx=out.getContext('2d'),input=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height),output=ctx.createImageData(out.width,out.height);
  for(let y=0;y<out.height;y++){
    for(let x=0;x<out.width;x++){
      const p=transform(x/Math.max(1,out.width-1),y/Math.max(1,out.height-1)),sx=Math.max(0,Math.min(source.width-1,Math.round(p.x))),sy=Math.max(0,Math.min(source.height-1,Math.round(p.y))),i=(sy*source.width+sx)*4,j=(y*out.width+x)*4;
      output.data[j]=input.data[i];output.data[j+1]=input.data[i+1];output.data[j+2]=input.data[i+2];output.data[j+3]=255;
    }
    if(y%100===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  ctx.putImageData(output,0,0);return out;
}
export async function editDocumentPhoto(file){
  const bitmap=await createImageBitmap(file),factor=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));let source=canvasOf(Math.round(bitmap.width*factor),Math.round(bitmap.height*factor));source.getContext('2d').drawImage(bitmap,0,0,source.width,source.height);bitmap.close();
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='photo-editor';dialog.setAttribute('aria-label','Cadrer et redresser la feuille');
    dialog.innerHTML='<h2>Cadrer la feuille</h2><p>Déplacez les quatre coins sur ceux de la feuille. La perspective sera redressée avant lecture. Vérifiez le cadrage automatique.</p><div class="crop-frame"><canvas class="crop-canvas" aria-label="Aperçu de la feuille"></canvas></div><div class="crop-coordinates"></div><p class="hint crop-status" role="status"></p><div class="actions"><button type="button" class="btn" data-photo="auto">Cadrage auto</button><button type="button" class="btn" data-photo="rotate">Tourner de 90°</button><button type="button" class="btn" data-photo="original">Garder l’original</button><button type="button" class="btn primary" data-photo="apply">Redresser et lire</button><button type="button" class="btn" data-photo="cancel">Annuler la photo</button></div>';
    document.body.append(dialog);const canvas=dialog.querySelector('canvas'),status=dialog.querySelector('.crop-status');let points=detectPage(source),drag=-1,done=false;
    const finish=value=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(value);};
    const draw=()=>{
      canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);ctx.lineWidth=Math.max(3,source.width/150);ctx.strokeStyle='#ffba49';ctx.fillStyle='rgba(255,186,73,.12)';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();points.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,Math.max(18,source.width/38),0,2*Math.PI);ctx.fillStyle='#ffba49';ctx.fill();ctx.fillStyle='#123e3a';ctx.font=`bold ${Math.max(20,source.width/40)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),p.x,p.y);});
    };
    const coordinates=()=>{
      dialog.querySelector('.crop-coordinates').innerHTML='<details><summary>Régler les coins avec des champs</summary>'+points.map((p,i)=>`<div class="crop-point"><span>Coin ${i+1}</span><label>X %<input type="number" aria-label="Coin ${i+1} X en pourcentage" min="0" max="100" data-point="${i}" data-axis="x" value="${Math.round(p.x/source.width*100)}"></label><label>Y %<input type="number" aria-label="Coin ${i+1} Y en pourcentage" min="0" max="100" data-point="${i}" data-axis="y" value="${Math.round(p.y/source.height*100)}"></label></div>`).join('')+'</details>';
    };
    const location=event=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(source.width-1,(event.clientX-r.left)/r.width*source.width)),y:Math.max(0,Math.min(source.height-1,(event.clientY-r.top)/r.height*source.height))};};
    canvas.addEventListener('pointerdown',event=>{const p=location(event);drag=points.reduce((best,q,i)=>length(q,p)<length(points[best],p)?i:best,0);canvas.setPointerCapture(event.pointerId);points[drag]=p;draw();});
    canvas.addEventListener('pointermove',event=>{if(drag<0)return;points[drag]=location(event);draw();});canvas.addEventListener('pointerup',()=>{drag=-1;coordinates();});canvas.addEventListener('pointercancel',()=>{drag=-1;});
    dialog.addEventListener('input',event=>{if(event.target.dataset.point===undefined)return;const {point,axis}=event.target.dataset,n=Number(event.target.value);if(Number.isFinite(n))points[Number(point)][axis]=Math.min(1,Math.max(0,n/100))*(axis==='x'?source.width:source.height);draw();});
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    dialog.addEventListener('click',async event=>{
      const button=event.target.closest('[data-photo]');if(!button)return;event.preventDefault();
      if(button.dataset.photo==='cancel')return finish(null);
      if(button.dataset.photo==='original')return finish(file);
      if(button.dataset.photo==='rotate'){const rotated=canvasOf(source.height,source.width),ctx=rotated.getContext('2d');ctx.translate(rotated.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(source,0,0);source=rotated;points=detectPage(source);draw();coordinates();return;}
      if(button.dataset.photo==='auto'){points=detectPage(source);draw();coordinates();return;}
      if(button.dataset.photo==='apply'){
        for(const b of dialog.querySelectorAll('button'))b.disabled=true;status.textContent='Redressement de la perspective…';
        try{const rectified=await rectifyPhoto(source,points),blob=await new Promise(r=>rectified.toBlob(r,'image/jpeg',.92));if(!blob)throw Error('Image non disponible.');finish(new File([blob],'feuille-redressee-'+Date.now()+'.jpg',{type:'image/jpeg'}));}
        catch(error){status.textContent=error.message;for(const b of dialog.querySelectorAll('button'))b.disabled=false;}
      }
    });
    draw();coordinates();dialog.showModal();
  });
}

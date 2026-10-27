import {selectOrderText,identityText} from './order-ocr-core.js';

function canvasFor(bitmap,angle,header=false){
 const turned=angle===90||angle===270,width=turned?bitmap.height:bitmap.width,height=turned?bitmap.width:bitmap.height;
 const scale=Math.min(3400,Math.max(3000,Math.max(width,height)))/Math.max(width,height),canvas=document.createElement('canvas');
 canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(bitmap,-bitmap.width*scale/2,-bitmap.height*scale/2,bitmap.width*scale,bitmap.height*scale);ctx.resetTransform();
 // Grayscale and bounded contrast improve small print without thresholding away
 // crossed/circled quantities. The stored photograph is never changed.
 const image=ctx.getImageData(0,0,canvas.width,canvas.height),pixels=image.data,histogram=new Uint32Array(256);
 for(let i=0;i<pixels.length;i+=4){const value=Math.round(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114);pixels[i]=pixels[i+1]=pixels[i+2]=value;histogram[value]++;}
 const clip=pixels.length/4*.01;let low=0,high=255,count=0;while(low<254&&count+histogram[low]<clip)count+=histogram[low++];count=0;while(high>low+1&&count+histogram[high]<clip)count+=histogram[high--];
 for(let i=0;i<pixels.length;i+=4){const value=Math.max(0,Math.min(255,(pixels[i]-low)*255/(high-low)));pixels[i]=pixels[i+1]=pixels[i+2]=value;}
 ctx.putImageData(image,0,0);
 if(!header)return canvas;
 const crop=document.createElement('canvas');crop.width=canvas.width;crop.height=Math.round(canvas.height*.43);crop.getContext('2d').drawImage(canvas,0,0);canvas.width=canvas.height=1;return crop;
}
async function imageSource(file){
 if(typeof createImageBitmap==='function'){try{return await createImageBitmap(file);}catch{}}
 const url=URL.createObjectURL(file),image=new Image();
 try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Photo illisible sur cet appareil.'));image.src=url;});image.close=()=>URL.revokeObjectURL(url);return image;}catch(error){URL.revokeObjectURL(url);throw error;}
}
export async function readOrderPhoto(file,recognize,onProgress=()=>{}){
 const bitmap=await imageSource(file);let best,lastError;
 // Wide photos of these portrait forms are usually sideways. Other orientations
 // are tried only when the number or its article lines cannot be recovered.
 const angles=bitmap.width>bitmap.height?[270,90,0,180]:[0,180,90,270];
 try{
  for(const angle of angles){
   onProgress('Lecture de la feuille — orientation '+angle+'°…');const canvas=canvasFor(bitmap,angle);
   try{const {data}=await recognize(canvas,{rotateAuto:true},{text:true,tsv:true}),candidate={...selectOrderText(data),angle};if(!best||candidate.score>best.score)best=candidate;if(candidate.confident)break;}catch(error){lastError=error;}finally{canvas.width=canvas.height=1;}
  }
  if(!best)throw lastError||Error('Aucun texte exploitable sur cette photo.');
  if(!best.identified){
   const canvas=canvasFor(bitmap,best.angle,true);
   try{onProgress('Relecture du numéro de commande ou d’enregistrement…');const {data}=await recognize(canvas,{rotateAuto:true,tessedit_pageseg_mode:'6'},{text:true,tsv:true});const header=identityText(data.text)+'\n'+identityText(selectOrderText(data).text);if(header.trim()){const candidate=selectOrderText({text:header+'\n'+best.text});if(candidate.score>best.score)best={...candidate,angle:best.angle};}}finally{canvas.width=canvas.height=1;}
  }
  return best.text;
 }finally{bitmap.close();}
}

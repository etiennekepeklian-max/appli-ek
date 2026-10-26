import {CameraSession} from './camera.js';

// A document session keeps one stream open until the operator finishes the batch.
export class DocumentCamera{
  constructor({mediaDevices=globalThis.navigator?.mediaDevices,recall=()=>'',remember=()=>{},canvas=()=>document.createElement('canvas'),ImageCapture=globalThis.ImageCapture,bitmap=globalThis.createImageBitmap}={}){
    if(!mediaDevices?.getUserMedia)throw Error('La caméra directe est indisponible. Utilisez l’appareil photo du téléphone ou la galerie.');
    this.session=new CameraSession({mediaDevices,recall,remember});this.canvas=canvas;this.ImageCapture=ImageCapture;this.bitmap=bitmap;this.video=null;this.revision=0;this.count=0;
  }
  async open(video){
    this.stop();const revision=this.revision;this.video=video;
    const result=await this.session.open();
    if(!result||revision!==this.revision)return false;
    if(video.isConnected===false){this.stop();return false;}
    video.srcObject=result.stream;await video.play();
    if(revision!==this.revision)return false;return true;
  }
  stop(){
    this.revision++;this.session.stop();if(this.video){this.video.pause?.();this.video.srcObject=null;}this.video=null;
  }
  async capture(){
    const revision=this.revision,video=this.video,track=this.session.stream?.getVideoTracks()[0];
    const guard=()=>{if(revision!==this.revision||video!==this.video||!track||track.readyState==='ended'||video?.isConnected===false)throw Error('La caméra est fermée. Rouvrez-la pour prendre une photo.');};guard();
    let source=video,decoded;
    // takePhoto can provide a sharper still than the preview. Video is a fallback.
    if(this.ImageCapture&&this.bitmap)try{
      const blob=await new this.ImageCapture(track).takePhoto();decoded=await this.bitmap(blob);source=decoded;
    }catch{source=video;}
    try{
      guard();const width=source===video?video.videoWidth:source.width,height=source===video?video.videoHeight:source.height;
      if(!width||!height)throw Error('Le cadrage se prépare. Attendez que la feuille apparaisse, puis photographiez.');
      const factor=Math.min(1,3400/Math.max(width,height)),c=this.canvas();c.width=Math.round(width*factor);c.height=Math.round(height*factor);
      const ctx=c.getContext('2d');if(!ctx)throw Error('La capture est indisponible. Utilisez la galerie.');ctx.drawImage(source,0,0,c.width,c.height);
      const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Photo non enregistrée. Réessayez.')),'image/jpeg',.95));guard();
      return new File([blob],'feuille-'+Date.now()+'-'+(++this.count)+'.jpg',{type:'image/jpeg'});
    }finally{decoded?.close();}
  }
}

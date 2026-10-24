const release=stream=>stream?.getTracks().forEach(track=>track.stop());
const unavailable=error=>['NotFoundError','OverconstrainedError','NotReadableError'].includes(error?.name);

export function cameraErrorMessage(error){
  if(['NotAllowedError','SecurityError'].includes(error?.name))return 'Autorisez la caméra dans les réglages du navigateur, puis réessayez.';
  if(error?.name==='NotFoundError')return 'Aucune caméra disponible. Vous pouvez choisir une photo ou saisir le code.';
  if(error?.name==='NotReadableError')return 'La caméra est déjà utilisée ou indisponible. Fermez les autres applications photo puis réessayez.';
  return 'Impossible d’ouvrir cette caméra. Réessayez, choisissez une photo ou saisissez le code.';
}

// Capture is independent of the barcode decoder: both the native detector and
// ZXing receive this exact stream. Serial requests avoid locking mobile lenses.
export class CameraSession {
  constructor({mediaDevices,recall=()=>'',remember=()=>{}}){
    this.mediaDevices=mediaDevices;this.recall=recall;this.remember=remember;
    this.stream=null;this.deviceId='';this.cameras=[];this.revision=0;this.pending=Promise.resolve();
  }
  stop(){this.revision++;release(this.stream);this.stream=null;}
  capabilities(){try{return this.stream?.getVideoTracks()[0]?.getCapabilities?.()||{};}catch{return {};}}
  async control(name,value){
    const track=this.stream?.getVideoTracks()[0],caps=this.capabilities();
    if(!track?.applyConstraints||!caps[name])throw Error('Ce réglage n’est pas disponible avec cet objectif.');
    if(name==='zoom'){const range=caps.zoom;if(!Number.isFinite(value)||value<range.min||value>range.max)throw Error('Zoom hors limites.');}
    if(!['torch','zoom'].includes(name))throw Error('Réglage inconnu.');
    await track.applyConstraints({advanced:[{[name]:value}]});return track.getSettings?.()[name]??value;
  }
  open(deviceId=this.recall()){
    const revision=++this.revision;
    release(this.stream);this.stream=null;
    const task=this.pending.catch(()=>{}).then(()=>this.acquire(deviceId,revision));
    this.pending=task.catch(()=>{});return task;
  }
  async acquire(deviceId,revision){
    if(revision!==this.revision)return null;
    let stream,fallback=false;
    const capture=id=>this.mediaDevices.getUserMedia({audio:false,video:{...(id?{deviceId:{exact:id}}:{facingMode:{ideal:'environment'}}),width:{ideal:1600}}});
    try{stream=await capture(deviceId);}catch(error){
      if(revision!==this.revision)return null;
      if(!deviceId||!unavailable(error))throw error;
      fallback=true;stream=await capture('');
    }
    if(revision!==this.revision){release(stream);return null;}
    this.stream=stream;
    const track=stream.getVideoTracks()[0];
    const activeId=track?.getSettings?.().deviceId||(fallback?'':deviceId)||'';
    let devices=[];
    try{devices=await this.mediaDevices.enumerateDevices?.()||[];}catch{}
    if(revision!==this.revision){release(stream);return null;}
    const unique=new Map();
    for(const device of devices)if(device.kind==='videoinput'&&device.deviceId&&!unique.has(device.deviceId))unique.set(device.deviceId,{deviceId:device.deviceId,label:device.label||`Caméra ${unique.size+1}`});
    if(activeId&&!unique.has(activeId))unique.set(activeId,{deviceId:activeId,label:track?.label||'Caméra actuelle'});
    this.cameras=[...unique.values()];this.deviceId=activeId;
    if(activeId||fallback)try{this.remember(activeId);}catch{}
    return {stream,deviceId:activeId,cameras:this.cameras,fallback};
  }
}

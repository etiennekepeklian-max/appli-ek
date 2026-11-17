// IntroK is packaged locally in Android; a reduced-motion user goes directly to login.
globalThis.PikeoIntroReady=new Promise(resolve=>{
 const el=document.getElementById('pikeo-opening');if(!el){resolve();return;}
 const end=()=>{el.remove();resolve();};
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||document.visibilityState==='hidden'){end();return;}
 if(globalThis.PikeoNative){const image=new Image();image.alt='Pikéo';image.style.cssText='width:100%;height:100%;object-fit:contain;background:#111';image.src='assets/IntroK.gif';image.onerror=end;el.replaceChildren(image);el.style.animation='none';setTimeout(end,4100);return;}
 if(location.hash&&location.hash!=='#home'){end();return;}el.addEventListener('animationend',e=>{if(e.target===el)end();},{once:true});setTimeout(end,2400);
});

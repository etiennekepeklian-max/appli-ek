// IntroK is packaged locally in Android; a reduced-motion user goes directly to login.
globalThis.PikeoIntroReady=new Promise(resolve=>{
 const el=document.getElementById('pikeo-opening');if(!el){resolve();return;}
 const end=()=>{el.remove();resolve();};
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||document.visibilityState==='hidden'){end();return;}
 if(globalThis.PikeoNative){el.classList.add('native-intro');const image=new Image();image.alt='Pikéo';image.style.cssText='width:100%;height:100%;object-fit:contain;object-position:center;display:block;min-height:0;min-width:0;background:#111;position:relative;z-index:1';image.src='assets/IntroK.gif';image.onerror=end;el.replaceChildren(image);el.style.animation='none';image.onload=()=>setTimeout(end,4100);setTimeout(end,6500);return;}
 if(location.hash&&location.hash!=='#home'){end();return;}el.addEventListener('animationend',e=>{if(e.target===el)end();},{once:true});setTimeout(end,2400);
});

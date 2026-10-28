// Opening is decorative: no navigation is ever blocked.
(()=>{const el=document.getElementById('pikeo-opening');if(!el)return;
 const skip=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||
 new URLSearchParams(location.search).has('pikeo-shortcut')||
 (location.hash&&location.hash!=='#home')||document.visibilityState==='hidden';
 if(skip){el.remove();return;}
 const end=()=>el.remove();
 el.addEventListener('animationend',e=>{if(e.target===el)end();},{once:true});
 setTimeout(end,2400);
})();

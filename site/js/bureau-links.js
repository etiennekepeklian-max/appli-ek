import * as API from './session-api.js';
const content='<a href="bureau.html#home">Ouvrir Pikéo Bureau sur ordinateur</a> · <a href="aide-bureau.html">Guide bureau</a>';
export const bureauLinks=()=>'<span data-bureau-links'+(API.bureauAllowed()?'':' hidden')+'>'+(API.bureauAllowed()?content:'')+'</span>';
let installed=false,busy=false;
export function installBureauLinks(){
 if(installed)return;installed=true;
 const draw=()=>{for(const el of document.querySelectorAll('[data-bureau-links]')){el.hidden=!API.bureauAllowed();el.innerHTML=API.bureauAllowed()?content:'';}};
 const refresh=async()=>{if(busy||document.hidden)return;draw();if(!document.querySelector('[data-bureau-links]')||!API.current()||!navigator.onLine)return;busy=true;try{await API.refresh();}catch{}finally{busy=false;draw();}};
 window.addEventListener('pikeo-session',draw);window.addEventListener('offline',draw);
 window.addEventListener('online',refresh);window.addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',refresh);setInterval(refresh,30000);
 draw();
}

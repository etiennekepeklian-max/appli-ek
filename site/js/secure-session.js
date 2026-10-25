import {generateRecoveryKey,importRecoveryKey} from './secure-core.js';
let activeKey;
export const unlocked=()=>!!activeKey;
export function key(){if(!activeKey)throw Error('Chargez votre clé personnelle dans Mon poste → Espace et sauvegardes.');return activeKey;}
export async function create(){const file=await generateRecoveryKey();activeKey=await importRecoveryKey(file);window.dispatchEvent(new CustomEvent('pikeo-key'));return file;}
export async function unlock(file){activeKey=await importRecoveryKey(file);window.dispatchEvent(new CustomEvent('pikeo-key'));}
export function lock(){activeKey=undefined;window.dispatchEvent(new CustomEvent('pikeo-key'));}

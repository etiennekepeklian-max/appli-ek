let current={id:null,name:null,role:'personal',owner:false,scope:'live'};
export const identity=()=>({...current});
export function setIdentity(value){current=value?{id:value.id,name:value.name,role:value.role||'operator',owner:!!value.owner,scope:value.scope||'user-'+value.id}:{id:null,name:null,role:'personal',owner:false,scope:'live'};}
export const canConfigure=()=>['admin','personal'].includes(current.role);
export const scope=(demo=false)=>demo?(current.scope==='live'?'demo':current.scope+'-demo'):current.scope;
export function assertConfigure(){if(!canConfigure())throw Error('Cette modification est réservée aux administrateurs.');}

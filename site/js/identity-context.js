import {hasPermission,permissionForType} from './permissions-core.js';
let current={id:null,name:null,role:'personal',owner:false,scope:'live'};
export const identity=()=>({...current});
export function setIdentity(value){current=value?{id:value.id,name:value.name,role:value.role||'operator',owner:!!value.owner,active:value.active!==false,permissions:value.permissions,scope:value.scope||'user-'+value.id}:{id:null,name:null,role:'personal',owner:false,scope:'live'};}
export const can=key=>hasPermission(current,key);
export const canConfigure=()=>can('configure');
export const scope=(demo=false)=>demo?(current.scope==='live'?'demo':current.scope+'-demo'):current.scope;
export function assertConfigure(){if(!canConfigure())throw Error('Cette modification est réservée aux administrateurs.');}
export function assertPermission(key){if(!can(key))throw Error('Votre accès ne permet pas cette action. Contactez Étienne.');}
export function assertWrite(type){const key=permissionForType(type);if(key)assertPermission(key);}

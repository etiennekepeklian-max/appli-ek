export const PERMISSIONS=Object.freeze({configure:'Produits et paramètres communs',operations:'Manquants et opérations de stock',picking:'Saisie et correction du picking',exports:'Exports et sauvegardes métier',messages:'Envoi de messages',team:'Participation aux défis'});
export const ROLES=Object.freeze({admin:'Administrateur',operator:'Opérateur',viewer:'Consultation'});
const defaults={admin:Object.keys(PERMISSIONS),operator:['operations','picking','exports','messages','team'],viewer:['exports']};
export function validPermissions(value){return Array.isArray(value)&&value.length<=Object.keys(PERMISSIONS).length&&new Set(value).size===value.length&&value.every(p=>Object.hasOwn(PERMISSIONS,p));}
export function permissionsFor(user){if(user?.active===false)return [];if(user?.owner||user?.role==='personal')return [...defaults.admin];return validPermissions(user?.permissions)?[...user.permissions]:[...(defaults[user?.role]||[])];}
export const hasPermission=(user,key)=>key==='users'?!!user?.owner&&user.active!==false:permissionsFor(user).includes(key);
export const rolePermissions=role=>[...(defaults[role]||[])];
export function permissionForType(type){return ['products','enfs','families','packagings','locations','replenishments'].includes(type)?'configure':['orders','days'].includes(type)?'picking':['pending','issues','movements','counts','documents'].includes(type)?'operations':null;}

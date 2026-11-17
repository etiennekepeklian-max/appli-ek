// Only structured business metadata; no free text, private memo or record payload.
const types=new Set(['families','products','enfs','packagings','locations','pending','orders','days','issues','movements','counts','replenishments','documents','codes','unknowns']);
export function businessActivity(events){return events.filter(e=>types.has(e.type)).map(e=>({eventId:e.id,action:e.record.deleted?'delete':e.baseEventId?'update':'create',resourceType:e.type,resourceId:String(e.record.id).slice(0,160),occurredAt:e.updatedAt}));}
export const labels={'login':'Connexion','login-enroll':'Première connexion / code créé','login-denied':'Connexion refusée','logout':'Déconnexion explicite','create':'Création','update':'Modification','delete':'Suppression','screen-open':'Écran consulté'};
export const activityLabel=e=>labels[e.action]||e.action;

export const trackedScreens=new Set(['home','codes','scan','pending','orders','stock','families','locations','movements','inventories','issues','replenishments','history','settings','help','more','users','administration','enfs','enf','journal']);

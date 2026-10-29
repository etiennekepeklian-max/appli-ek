import {esc} from './ui.js';
import {safeProductImageURL} from './product-lookup-core.js';

export function publicProductPhoto(value,name='Produit'){
 const url=safeProductImageURL(value);if(!url)return '';
 return `<figure class="lookup-product-photo" data-public-product-image><img class="product-photo" src="${esc(url)}" alt="Photo de ${esc(name||'ce produit')}" width="220" height="220" loading="lazy" decoding="async" referrerpolicy="no-referrer"><figcaption class="hint" data-product-image-error hidden>Photo indisponible. Les informations du produit restent accessibles.</figcaption></figure>`;
}
globalThis.document?.addEventListener?.('error',event=>{
 const image=event.target;
 if(!image?.matches?.('[data-public-product-image] > img'))return;
 image.hidden=true;
 const note=image.parentElement?.querySelector('[data-product-image-error]');if(note)note.hidden=false;
},true);

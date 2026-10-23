#!/usr/bin/env python3
"""Actualise le catalogue PUBLIC Draeger Paris, sans stock ni conditionnement métier.

Usage : python update_draeger_catalogue.py --output ./catalogue --families ./draeger-families.json
La boutique publique ne remplace pas le référentiel interne de l'entrepôt.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

BASE = 'https://fr.checkout.draegerparis.com'

def request_json(url):
    for attempt in range(2):
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'EK-Catalogue-Update/1.0 (public product reference)'})
            with urllib.request.urlopen(request,timeout=35) as response:return json.load(response)
        except urllib.error.HTTPError as error:
            if attempt == 0 and error.code in (429,500,502,503,504):
                delay=min(10,float(error.headers.get('Retry-After','2')))
                time.sleep(max(1,delay))
                continue
            raise
        except (OSError, ValueError):
            if attempt == 0:
                time.sleep(1)
                continue
            raise

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path('.'))
    parser.add_argument('--families',type=Path,required=True)
    parser.add_argument('--workers',type=int,choices=range(1,7),default=6)
    args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    families=json.loads(args.families.read_text(encoding='utf-8'))
    type_family={ty:family['id'] for family in families['families'] for ty in family.get('sourceProductTypes',[])}
    cache=args.output/'.catalogue-cache'
    cache.mkdir(exist_ok=True)
    all_products=[]
    pages=[]
    for page in range(1,100):
        url=f'{BASE}/products.json?limit=250&page={page}'
        products=request_json(url).get('products',[])
        pages.append({'url':url,'count':len(products)})
        all_products.extend(products)
        if len(products)<250:break
    print(f"Catalogue public : {len(all_products)} fiches, collecte des variantes…",flush=True)

    def fetch_product(p):
        url=f"{BASE}/products/{p['handle']}.js"
        revision=hashlib.sha256(str(p.get('updated_at','')).encode()).hexdigest()[:12]
        cached=cache/(str(p['id'])+'-'+revision+'.json')
        try:
            if cached.exists():detail=json.loads(cached.read_text())
            else:
                detail=request_json(url)
                cached.write_text(json.dumps(detail,ensure_ascii=False),encoding='utf-8')
            return p,detail,None
        except Exception as exc:
            return p,p,str(exc)

    rows=[]
    errors=[]
    successful=0
    seen_ids=set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for index,(p,detail,error) in enumerate(pool.map(fetch_product,all_products),1):
            if error:errors.append({'handle':p['handle'],'dataSourceUrl':f"{BASE}/products/{p['handle']}.js",'error':error})
            else:successful+=1
            for v in detail.get('variants',[]):
                vid=str(v['id'])
                if vid in seen_ids:continue
                seen_ids.add(vid)
                name=v.get('name') or (p['title'] if v['title']=='Default Title' else p['title']+' - '+v['title'])
                rows.append({
                    'id':'draeger-'+vid,
                    'sku':str(v.get('sku') or ''),
                    'barcode':str(v.get('barcode') or ''),
                    'name':name,
                    'familyId':type_family.get(p['product_type'],'a-classer'),
                    'sourceProductType':p['product_type'],
                    'unitsPerPick':None,
                    'sourceUrl':f"{BASE}/products/{p['handle']}",
                    'dataSourceUrl':f"{BASE}/products/{p['handle']}.js",
                })
            if index%50==0:print(f'{index}/{len(all_products)} fiches traitées ; {len(errors)} erreur(s)',flush=True)

    timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    def valid_ean13(value):
        return len(value)==13 and value.isdigit() and (sum(int(c)*(1 if i%2==0 else 3) for i,c in enumerate(value[:12]))+int(value[-1]))%10==0
    meta={
        'publisher':'Draeger Paris',
        'retrievedAt':timestamp,
        'sourceUrl':BASE+'/collections/all',
        'sourcePages':pages,
        'scope':'Catalogue public accessible au moment de la collecte, pas le référentiel interne ni le stock de l’entrepôt. Les produits non publiés ou les présentoirs internes peuvent être absents. Les familles sont des regroupements proposés de types officiels.',
        'publicProductCountObserved':len(all_products),
        'publicVariantCountObserved':sum(len(p['variants']) for p in all_products),
        'productDetailsCollected':successful,
        'variantCountCollected':len(rows),
        'variantsWithSku':sum(bool(p['sku']) for p in rows),
        'variantsWithBarcode':sum(bool(p['barcode']) for p in rows),
        'uniqueSkuCount':len({p['sku'] for p in rows if p['sku']}),
        'uniqueBarcodeCount':len({p['barcode'] for p in rows if p['barcode']}),
        'ean13ChecksumInvalidCount':sum(bool(p['barcode']) and not valid_ean13(p['barcode']) for p in rows),
        'unclassifiedSourceTypes':sorted({p['product_type'] for p in all_products if p['product_type'] and p['product_type'] not in type_family}),
        'packagingNote':'Aucun conditionnement logistique déduit. unitsPerPick reste null : à confirmer par référence dans l’entrepôt.',
        'errors':errors,
    }
    destination=args.output/'draeger-products.json'
    temporary=destination.with_suffix('.json.tmp')
    temporary.write_text(json.dumps({'meta':meta,'products':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    temporary.replace(destination)
    print(json.dumps({k:meta[k] for k in ['publicProductCountObserved','publicVariantCountObserved','productDetailsCollected','variantCountCollected','variantsWithSku','variantsWithBarcode']},ensure_ascii=False),flush=True)
    print(str(destination),flush=True)

if __name__=='__main__':main()

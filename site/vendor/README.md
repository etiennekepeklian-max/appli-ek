# Dépendances locales de l’application

Toutes les bibliothèques sont vendoriées et épinglées. Aucun chargement CDN n’est nécessaire pour les fonctions ci-dessous. Les fichiers sont à servir en HTTP local ou HTTPS, avec le reste du dossier `site` ; l’ouverture directe en `file://` ne permet pas le fonctionnement normal des workers OCR ou de la caméra.

| Fonction | Fichier | Version | Variable globale |
|---|---|---|---|
| Génération de codes | `jsbarcode.min.js` | JsBarcode 3.12.1 | `JsBarcode` |
| Lecture caméra ou photo | `zxing-browser.min.js` | @zxing/browser 0.1.5 | `ZXingBrowser` |
| Export PDF | `jspdf.umd.min.js` | jsPDF 3.0.3 | `jspdf.jsPDF` |
| OCR | `ocr/tesseract.min.js` | Tesseract.js 6.0.1 | `Tesseract` |
| Worker OCR | `ocr/worker.min.js` | Tesseract.js 6.0.1 | worker |
| Moteurs OCR | `ocr/core/` | tesseract.js-core 6.0.0 | chargement automatique |
| Langues OCR | `ocr/lang/` | @tesseract.js-data eng/fra 1.0.0 | modèles LSTM integerisés |

## Génération Code 128

```js
JsBarcode(svgElement, String(reference), {
  format: 'CODE128', width: 2, height: 90,
  margin: 24, displayValue: true
});
```

Conserver les références en chaînes de caractères, pour garder les zéros initiaux. Ajouter des astérisques à une donnée Code 128 encode réellement ces astérisques. JsBarcode gère déjà les symboles de début/fin et la somme de contrôle. Ce n’est pas la convention de balisage d’une police Code 39.

## Scanner un code

```js
const reader = new ZXingBrowser.BrowserMultiFormatReader();
const result = await reader.decodeFromImageUrl(objectUrl);
const text = result.getText();
```

Pour la caméra : `decodeFromVideoDevice(undefined, videoElement, callback)` fournit un contrôleur ; appeler `controls.stop()` pour terminer. Demander l’autorisation caméra au moment de l’action. La lecture ne donne que le texte encodé : le nom du produit doit être recherché séparément dans le catalogue ou une source fiable.

## OCR local français et anglais

```js
const absolute = path => new URL(path, document.baseURI).href;
const worker = await Tesseract.createWorker(['fra', 'eng'], 1, {
  workerPath: absolute('vendor/ocr/worker.min.js'),
  corePath: absolute('vendor/ocr/core'),
  langPath: absolute('vendor/ocr/lang'),
  workerBlobURL: false,
  gzip: true,
  logger: message => { /* afficher la progression */ }
});
await worker.setParameters({ preserve_interword_spaces: '1' });
const { data } = await worker.recognize(imageOrFile);
const text = data.text;
await worker.terminate();
```

Le deuxième argument de `createWorker` est bien `1` (moteur LSTM). Les options viennent en troisième argument. L’OCR renvoie du texte, pas un calcul de pickings garanti. L’utilisateur doit confirmer les références, quantités, conditionnements et résultats estimés.

Le répertoire `ocr/core` contient les quatre variantes de moteur : classique, SIMD, LSTM, SIMD LSTM. Les `.wasm.js` sont des distributions embarquant le WebAssembly, sélectionnées par le worker. Les `.js` et `.wasm` correspondants sont également fournis pour une distribution locale complète.

Pour une installation hors ligne, mettre en cache les fichiers OCR à la demande (ou proposer un téléchargement explicite du module), plutôt que de bloquer l’ouverture initiale sur tous les moteurs.

## PDF

```js
const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
pdf.text('Rapport', 16, 20);
pdf.save('rapport.pdf');
```

L’écriture de texte et l’ajout d’images ne nécessitent pas html2canvas. Le module facultatif `html()` n’est pas fourni : utiliser le dessin PDF et le texte directement, ou l’impression du navigateur.

## Provenance et licences

`manifest.json` contient les URL exactes et SHA-256. Les licences redistribuées se trouvent dans `licenses/`. Les paquets de données déclarent MIT dans leurs métadonnées NPM ; leur dépôt de modèles source `naptha/tessdata` publie les données sous Apache-2.0, également inclus. ZXing Browser est MIT et embarque ZXing Library sous Apache-2.0. Les versions sont conservées telles que distribuées, sans modification.

Sources primaires :
- https://github.com/lindell/JsBarcode
- https://github.com/zxing-js/browser
- https://github.com/parallax/jsPDF
- https://github.com/naptha/tesseract.js/blob/v6.0.1/docs/api.md
- https://github.com/naptha/tessdata/tree/gh-pages

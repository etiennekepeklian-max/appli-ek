// Tesseract 6 selects one of these four self-contained builds. Keep every CPU fallback.
export const OCR_ASSETS=[
 'vendor/ocr/tesseract.min.js','vendor/ocr/worker.min.js',
 ...['','-simd','-lstm','-simd-lstm'].map(s=>'vendor/ocr/core/tesseract-core'+s+'.wasm.js'),
 'vendor/ocr/lang/fra.traineddata.gz','vendor/ocr/lang/eng.traineddata.gz'
];
// The separate binary/wrapper pairs duplicate the embedded builds above.
export const redundantOCRAsset=path=>/^vendor\/ocr\/core\/tesseract-core(?:-simd)?(?:-lstm)?\.(?:wasm|js)$/.test(path);

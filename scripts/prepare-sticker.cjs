const fs = require('node:fs');
const path = require('node:path');
const target = path.resolve(__dirname, '../public/sticker');
fs.mkdirSync(target, {recursive:true});
for (const file of ['ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']) {
  fs.copyFileSync(path.resolve(__dirname,'../node_modules/onnxruntime-web/dist', file), path.join(target,file));
}
fs.copyFileSync(path.resolve(__dirname,'../models/u2netp.onnx'),path.join(target,'u2netp.onnx'));

fs.copyFileSync(path.resolve(__dirname,'../server/studio/coffee.png'),path.join(target,'coffee.png'));

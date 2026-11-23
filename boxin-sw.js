
const name="boxin-storage-shell-57866b308e1753d8";
const files=["/index.html","/metadata.json","/sticker/coffee.png","/sticker/ort-wasm-simd-threaded.mjs","/sticker/ort-wasm-simd-threaded.wasm","/sticker/ort.wasm.min.js","/sticker/u2netp.onnx","/assets/server/studio/coffee.f24210802e8d0690e0c1c2302f907cc4.png","/_expo/static/js/web/AppEntry-5dc08ff7c32c5e8738a5e4196b2a1e5b.js"];
const assets=files.map(file=>'/boxin-storage'+file);self.addEventListener('install',e=>e.waitUntil(caches.open(name).then(c=>c.addAll(assets)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('boxin-storage-shell-')&&k!==name).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==location.origin)return;
 const key=url.pathname==='/boxin-storage/'?'/boxin-storage/index.html':url.pathname;
 if(assets.includes(key))e.respondWith(caches.open(name).then(c=>c.match(key)).then(r=>r||fetch(e.request)));
});
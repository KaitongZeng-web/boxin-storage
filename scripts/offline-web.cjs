const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = path.resolve(__dirname, '../dist');
const files = fs.readdirSync(dir,{recursive:true}).filter(file=>
  fs.statSync(path.join(dir,file)).isFile() && file !== 'boxin-sw.js'
).map(file=>'/'+file.replaceAll('\\','/'));
const hash = crypto.createHash('sha256');
for(const file of files)hash.update(fs.readFileSync(path.join(dir,file)));
const cache = 'boxin-shell-'+hash.digest('hex').slice(0,16);
fs.writeFileSync(path.join(dir,'boxin-sw.js'),`
const name=${JSON.stringify(cache)};
const assets=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(name).then(c=>c.addAll(assets)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('boxin-shell-')&&k!==name).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==location.origin)return;
 const key=url.pathname==='/'?'/index.html':url.pathname;
 if(assets.includes(key))e.respondWith(caches.open(name).then(c=>c.match(key)).then(r=>r||fetch(e.request)));
});`);
const html=path.join(dir,'index.html');
fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace('</body>',"<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('/boxin-sw.js').catch(console.warn)</script></body>"));

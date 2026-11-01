import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = dir + "/" + item.name;
    if (item.isDirectory()) await walk(path);
    else if (
      /\.(html|js|css|svg|webmanifest)$/.test(path) &&
      !path.endsWith("/sw.js")
    )
      files.push(path.slice("dist/".length));
  }
}
await walk("dist");
files.sort();
const hash = createHash("sha256");
for (const path of files) hash.update(await readFile("dist/" + path));
const version = hash.digest("hex").slice(0, 20);
const worker = `// Generated from this build's static assets. Personal records are never cached here.
const PREFIX='roster-pocket:'+self.registration.scope+':';
const CACHE=PREFIX+${JSON.stringify(version)};
const ASSETS=${JSON.stringify(["./", ...files.map((p) => "./" + p)])};
const URLS=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(p=>new Request(new URL(p,self.registration.scope),{cache:'reload'}))))));
// Updates wait for existing tabs to close; there is no forced reload or schema reset.
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const r=event.request;if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;if(URLS.has(r.url)||r.mode==='navigate')event.respondWith((async()=>{const cache=await caches.open(CACHE);const match=await cache.match(r);if(match)return match;if(r.mode==='navigate')return cache.match(new URL('./',self.registration.scope));return fetch(r);})());});
`;
await writeFile("dist/sw.js", worker);
console.log(
  "Offline shell generated for " + files.length + " assets; build " + version,
);

// Served as plain browser JavaScript; keep independent of React and native code.
export function startupClient(config) {
  const started = performance.now();
  const status = document.getElementById('startup-status');
  const report = text => { if (status) status.textContent = text; };
  const cacheName = 'iphone-resources-v1';
  async function resource(url) {
    let cache;
    try { cache = await caches.open(cacheName); const hit = await cache.match(url); if (hit) return hit.json(); } catch {}
    const response = await fetch(url);
    if (!response.ok) throw new Error('资源下载失败，请检查网络后重试');
    const value = await response.clone().json();
    try { if (cache) await cache.put(url, response); } catch {}
    return value;
  }
  window.__iphoneLoad = async () => {
    try {
      report('正在载入阅读内容…');
      const [meta, ...books] = await Promise.all(config.files.map(resource));
      window.__iphoneData = { ...meta, demoLessons: books.flat() };
      window.__iphoneTiming = { dataReadyMs: Math.round(performance.now() - started) };
      performance.mark('iphone-data-ready');
    } catch (error) {
      report(error.message || '加载失败，请重试');
      document.getElementById('startup-retry').hidden = false;
      throw error;
    }
  };
  window.__iphoneError = () => {
    report('加载暂未完成，请检查网络后重试');
    document.getElementById('startup-retry').hidden = false;
  };
  window.__iphoneReady = window.__iphoneLoad();
  window.__iphoneReady.catch(() => {});
  setTimeout(() => {
    if (document.getElementById('startup')) window.__iphoneError();
  }, 20000);
  new MutationObserver((_, observer) => {
    if (document.getElementById('root')?.childElementCount) {
      document.getElementById('startup')?.remove();
      window.__iphoneTiming = { ...window.__iphoneTiming, renderedMs: Math.round(performance.now() - started) };
      performance.mark('iphone-rendered');
      observer.disconnect();
    }
  }).observe(document.getElementById('root'), { childList: true });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
}

export function serviceWorker(version, shell) {
  return `const SHELL=${JSON.stringify(shell)}, VERSION=${JSON.stringify(version)};
const CACHE='iphone-shell-'+VERSION, ASSETS='iphone-resources-v1';
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(SHELL);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  const names=(await caches.keys()).filter(name=>name.startsWith('iphone-shell-'));
  for(const name of names.slice(0,-2)) if(name!==CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin) return;
  if(request.mode==='navigate') {
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE), saved=await cache.match('/');
      if(saved) return saved;
      return fetch(request);
    })());
    return;
  }
  if(!/^(\\/reading-data\\/|\\/_expo\\/|\\/assets\\/)/.test(url.pathname)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(ASSETS), saved=await cache.match(request);
    if(saved) return saved;
    const response=await fetch(request);
    if(response.ok) { try {await cache.put(request,response.clone());}catch{} }
    return response;
  })());
});`;
}

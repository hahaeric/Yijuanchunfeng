import { readFile, writeFile, copyFile, unlink, access, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { startupClient, serviceWorker } from './iphone-startup.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function prepareHtml(html, files = []) {
  return html.replace('<html lang="en">', '<html lang="zh-CN">')
    .replace('initial-scale=1, shrink-to-fit=no', 'initial-scale=1, viewport-fit=cover')
    .replace('</head>', `<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="一卷春风">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#315440">
<style>html,body,#root{height:100%;height:100dvh}body{padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}input,textarea{font-size:16px!important}</style>
</head>`)
    .replace('<div id="root"></div>', `<div id="startup" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#F4F2EA;color:#315440;font:18px system-ui;z-index:9999" role="status"><h1>一卷春风</h1><p id="startup-status">正在打开…</p><button id="startup-retry" hidden onclick="location.reload()" style="font:inherit;padding:12px 24px">重新加载</button></div><div id="root"></div><script>(${startupClient.toString()})(${JSON.stringify({ files })});</script>`)
    .replace(/(<script src="[^"]+")/g, '$1 onerror="window.__iphoneError()"');
}

export function compileModel(source, model) {
  // Keep exactly the existing runtime helpers; evaluate edition transforms only at build time.
  const helpers = source.slice(source.indexOf('const lessonsByBook ='))
    .replace('legacyLessons: correctedLessons', 'legacyLessons')
    .replace('contentRevision: `${suppliedEdition.contentRevision}:${fourBooks.contentRevision}:${guliang.contentRevision}`', 'contentRevision')
    .replace('projectPinyinCorrectionCount: correctionKeys.size', 'projectPinyinCorrectionCount');
  return `const { demoBooks, demoLessons, legacyLessons, contentRevision, projectPinyinCorrectionCount } = globalThis.__iphoneData;
const corpus = { books: demoBooks, lessons: demoLessons };
for(const lesson of demoLessons) if(lesson.editionSourceIndex !== undefined) {
 lesson.editionSource=globalThis.__iphoneData.editions[lesson.editionSourceIndex]; delete lesson.editionSourceIndex;
}
${helpers}`;
}

export function packReadingData(model) {
  const editions = [], byEdition = new Map();
  const books = model.demoBooks.map(book => model.demoLessons.filter(l => l.bookId === book.id).map(lesson => {
    const next = { ...lesson };
    if(next.editionSource) {
      const key=JSON.stringify(next.editionSource);
      if(!byEdition.has(key)) { byEdition.set(key, editions.length); editions.push(next.editionSource); }
      next.editionSourceIndex=byEdition.get(key); delete next.editionSource;
    }
    return next;
  }));
  return { books, meta: { demoBooks: model.demoBooks, editions,
    legacyLessons: model.legacyLessons.map(({id,text}) => ({id,text})),
    contentRevision: model.contentRevision, projectPinyinCorrectionCount: model.projectPinyinCorrectionCount } };
}

export const manifest = {
  id: '/', name: '一卷春风', short_name: '一卷春风', lang: 'zh-CN',
  start_url: '/', scope: '/', display: 'standalone',
  background_color: '#F4F2EA', theme_color: '#315440',
  icons: [{ src: '/apple-touch-icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }]
};

export function prepareApp(source) {
  return source.replace('async function checkForAppUpdates({ silent = false } = {}) {',
    'async function checkForAppUpdates({ silent = false } = {}) { window.location.reload(); return;')
    .replace('>应用更新</Text>', '>网页更新</Text>')
    .replace('当前版本 {Application.nativeApplicationVersion || "开发预览"}', '刷新页面获取最新版本')
    .replace('>检查更新</Text>', '>刷新页面</Text>')
    .replace(/webStage: \{[^\n]+/, 'webStage: { flex: 1, minHeight: 0, alignItems: "center", backgroundColor: "#F4F2EA" },')
    .replace(/webFrame: \{[\s\S]*?\n  \},/, 'webFrame: { flex: 1, width: "100%", maxWidth: 600, minHeight: 0, overflow: "hidden" },');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const webApp = path.join(cwd, 'App.web.js');
  const reader = path.join(cwd, 'App.iphone.js');
  const webModel = path.join(cwd, 'src/model.web.js');
  for(const file of [webApp, reader, webModel]) {
    let exists = false; try { await access(file); exists = true; } catch {}
    if(exists) throw new Error(`${file} already exists; refusing to overwrite`);
  }
  const require = createRequire(import.meta.url);
  const model = require('../src/model.js');
  const packed = packReadingData(model);
  let result;
  try {
    await writeFile(reader, prepareApp(await readFile(path.join(cwd, 'App.js'), 'utf8')));
    await writeFile(webModel, compileModel(await readFile(path.join(cwd, 'src/model.js'), 'utf8'), model));
    await writeFile(webApp, `import React, {useEffect,useState} from 'react';
export default function Startup(){const [Reader,setReader]=useState(null);
useEffect(()=>{let active=true;window.__iphoneReady.then(()=>{const App=require('./App.iphone').default;if(active)setReader(()=>App);}).catch(()=>window.__iphoneError());return()=>{active=false;};},[]);
return Reader ? React.createElement(Reader) : null;}`);
    result = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', 'web-dist'], { cwd, stdio: 'inherit' });
  } finally { await Promise.all([webApp, reader, webModel].map(file=>unlink(file).catch(()=>{}))); }
  if (result.status !== 0) process.exit(result.status || 1);
  const output = path.join(cwd, 'web-dist');
  await mkdir(path.join(output, 'reading-data'), {recursive:true});
  const files=[];
  for(const [name, value] of [['meta',packed.meta], ...packed.books.map((book,i)=>[model.demoBooks[i].id,book])]) {
    const json=JSON.stringify(value), hash=createHash('sha256').update(json).digest('hex').slice(0,16);
    const url=`/reading-data/${name}-${hash}.json`;
    await writeFile(path.join(output,url),json); files.push(url);
  }
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const finalHtml=prepareHtml(html, files);
  await writeFile(path.join(output, 'index.html'), finalHtml);
  const version=createHash('sha256').update(finalHtml).digest('hex').slice(0,16);
  const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(match=>match[1]);
  await writeFile(path.join(output,'sw.js'),serviceWorker(version,['/',...scripts]));
  await writeFile(path.join(output, 'manifest.webmanifest'), JSON.stringify(manifest));
  await copyFile(path.join(cwd, 'assets/icon.png'), path.join(output, 'apple-touch-icon.png'));
  await writeFile(path.join(output, '_headers'), '/\n  Cache-Control: no-cache\n/sw.js\n  Cache-Control: no-cache\n');
}

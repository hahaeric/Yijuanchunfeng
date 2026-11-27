import { readFile, writeFile, copyFile, unlink, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function prepareHtml(html) {
  return html.replace('<html lang="en">', '<html lang="zh-CN">')
    .replace('initial-scale=1, shrink-to-fit=no', 'initial-scale=1, viewport-fit=cover')
    .replace('</head>', `<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="一卷春风">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#315440">
<style>html,body,#root{height:100%;height:100dvh}body{padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}input,textarea{font-size:16px!important}</style>
</head>`);
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
  let exists = false;
  try { await access(webApp); exists = true; } catch {}
  if (exists) throw new Error('App.web.js already exists; refusing to overwrite');
  let result;
  try {
    await writeFile(webApp, prepareApp(await readFile(path.join(cwd, 'App.js'), 'utf8')));
    result = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', 'web-dist'], { cwd, stdio: 'inherit' });
  } finally { await unlink(webApp); }
  if (result.status !== 0) process.exit(result.status || 1);
  const output = path.join(cwd, 'web-dist');
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  await writeFile(path.join(output, 'index.html'), prepareHtml(html));
  await writeFile(path.join(output, 'manifest.webmanifest'), JSON.stringify(manifest));
  await copyFile(path.join(cwd, 'assets/icon.png'), path.join(output, 'apple-touch-icon.png'));
  // No service worker: navigation fetches current HTML; hashed assets remain cacheable.
  await writeFile(path.join(output, '_headers'), '/*\n  Cache-Control: no-cache\n');
}

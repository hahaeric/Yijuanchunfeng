import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareHtml, prepareApp, manifest } from '../mobile/scripts/build-iphone-web.mjs';
import { readFileSync } from 'node:fs';

test('web-only adaptation removes desktop frame and uses browser refresh', () => {
  const source = readFileSync(new URL('../mobile/App.js', import.meta.url), 'utf8');
  const web = prepareApp(source);
  assert.match(web, /window.location.reload\(\); return;/);
  assert.match(web, /网页更新/);
  assert.doesNotMatch(web, /height: 820/);
  assert.doesNotMatch(web, /minHeight: 760/);
  assert.match(web, /maxWidth: 600/);
});

test('iPhone export provides standalone installation and safe area without disabling zoom', () => {
  const html = prepareHtml('<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"></head></html>');
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.doesNotMatch(html, /user-scalable=no/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
});

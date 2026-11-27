import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareHtml, manifest } from '../mobile/scripts/build-iphone-web.mjs';

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

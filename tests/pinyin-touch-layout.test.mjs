import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { getPinyinTouchLayout } = require('../mobile/src/pinyin-touch-layout');
test('Android pinyin has a real finger-sized target at every supported font size', () => {
  for (let size = 20; size <= 48; size += 2) {
    const height = Math.max(12, Math.round(size * .48));
    const target = getPinyinTouchLayout('android', size, height);
    assert.ok(target.height >= 36);
    assert.ok(target.minWidth >= 32 && target.minWidth >= size);
    for (const platform of ['ios', 'web']) {
      assert.deepEqual(getPinyinTouchLayout(platform, size, height), { height });
    }
  }
});
test('horizontal parent contains enlarged target and vertical rows reserve its actual height', () => {
  const source = readFileSync(new URL('../mobile/App.js', import.meta.url), 'utf8');
  assert.match(source, /rubyPinyinSlot, \{ height: pinyinTouchLayout.height, minWidth: pinyinTouchLayout.minWidth \}/);
  assert.equal(source.split('style={[styles.pinyinTouchTarget, pinyinTouchLayout]}').length - 1, 2);
  assert.match(source, /columnHeight = characterLineHeight \+ \(showPinyin \? pinyinTouchLayout.height : 0\)/);
  assert.equal(source.split('getPinyinTouchLayout(Platform.OS, fontSize, pinyinHeight)').length - 1, 2);
});

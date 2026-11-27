import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../mobile/App.js', import.meta.url), 'utf8');
test('pinyin editor focuses after native modal is shown and selects existing syllable', () => {
  assert.match(source, /const pinyinInputRef = useRef\(null\)/);
  const modal = source.slice(source.indexOf('<Modal visible={Boolean(pinyinEditorTarget)}'));
  assert.match(modal, /onShow={\(\) => pinyinInputRef.current\?\.focus\(\)}/);
  assert.match(modal, /<TextInput\s+ref={pinyinInputRef}\s+selectTextOnFocus\s+value={pinyinEditorDraft}/);
});
test('both horizontal and vertical pinyin targets open editor with a single press', () => {
  assert.match(source, /onPress={\(\) => onEditPinyin\?\.\(group.characterIndex, group.character, group.pinyin\)}/);
  assert.match(source, /onPress={\(\) => onEditPinyin\?\.\(sourceCharacterIndex, character, pinyin\)}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../mobile/App.js', import.meta.url), 'utf8');
for (const target of ['textEditor', 'pinyinEditorTarget']) {
  test(`${target} keeps its scrollable editor above the native keyboard`, () => {
    const start = source.indexOf(`<Modal visible={Boolean(${target})}`);
    const modal = source.slice(start, source.indexOf('</Modal>', start));
    assert.match(modal, /<KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" \? "padding" : "height"}>/);
    assert.match(modal, /<ScrollView[^>]*keyboardShouldPersistTaps="handled"/);
    assert.match(modal, /<\/KeyboardAvoidingView>/);
  });
}
test('pinyin sheet can shrink and scroll when keyboard leaves little space', () => {
  assert.match(source, /keyboardEditorSheet: \{ flexGrow: 0, maxHeight: "88%" \}/);
  assert.match(source, /<ScrollView style={styles.keyboardEditorSheet} contentContainerStyle={styles.pinyinEditorSheet}/);
});

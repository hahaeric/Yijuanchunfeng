import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getStoredValueWithMigration } = require("../mobile/src/storage-migration.js");

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  const reads = [];
  return {
    values,
    reads,
    async getItem(key) {
      reads.push(key);
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    }
  };
}

test("migrates existing reading data to the new branded storage key", async () => {
  const savedReadingState = JSON.stringify({ currentIndex: 12, favorites: ["analects-1"] });
  const storage = createStorage({ "jingri-mobile-full-corpus-v2": savedReadingState });

  const value = await getStoredValueWithMigration(
    storage,
    "yijuan-chunfeng-mobile-full-corpus-v2",
    ["jingri-mobile-full-corpus-v2"]
  );

  assert.equal(value, savedReadingState);
  assert.equal(storage.values.get("yijuan-chunfeng-mobile-full-corpus-v2"), savedReadingState);
  assert.equal(storage.values.has("jingri-mobile-full-corpus-v2"), false);
});

test("prefers the active storage value without touching legacy keys", async () => {
  const storage = createStorage({
    "yijuan-chunfeng-mobile-full-corpus-v2": "current",
    "jingri-mobile-full-corpus-v2": "legacy"
  });

  const value = await getStoredValueWithMigration(
    storage,
    "yijuan-chunfeng-mobile-full-corpus-v2",
    ["jingri-mobile-full-corpus-v2"]
  );

  assert.equal(value, "current");
  assert.deepEqual(storage.reads, ["yijuan-chunfeng-mobile-full-corpus-v2"]);
  assert.equal(storage.values.get("jingri-mobile-full-corpus-v2"), "legacy");
});

test("returns null when neither active nor legacy state exists", async () => {
  const storage = createStorage();
  const value = await getStoredValueWithMigration(storage, "new-key", ["old-key"]);

  assert.equal(value, null);
});

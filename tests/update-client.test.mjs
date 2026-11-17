import test from "node:test";
import assert from "node:assert/strict";
import updateClient from "../mobile/src/update-client.js";

const { ANDROID_UPDATE_MANIFEST_URL, fetchAndroidUpdateOffer, getAndroidUpdateOffer } = updateClient;

const validManifest = {
  platform: "android",
  version: "0.1.1",
  androidVersionCode: 3,
  apkParts: [
    "https://yijuanchunfeng-updates--update-feed.expo.app/releases/v0.1.1-3/part-000.bin",
    "https://yijuanchunfeng-updates--update-feed.expo.app/releases/v0.1.1-3/part-001.bin"
  ],
  apkPartSizes: [4, 4],
  apkSizeBytes: 8,
  apkMd5: "0123456789abcdef0123456789abcdef",
  releaseNotes: "加入客户端更新"
};

test("returns a native update offer only when the manifest has a newer signed APK build", () => {
  assert.deepEqual(getAndroidUpdateOffer(validManifest, "2"), {
    kind: "native",
    version: "0.1.1",
    versionCode: 3,
    apkParts: validManifest.apkParts,
    apkPartSizes: [4, 4],
    apkSizeBytes: 8,
    apkMd5: "0123456789abcdef0123456789abcdef",
    releaseNotes: "加入客户端更新"
  });
  assert.equal(getAndroidUpdateOffer(validManifest, "3"), null);
  assert.equal(getAndroidUpdateOffer(validManifest, "4"), null);
});

test("rejects malformed or non-Expo APK chunk URLs and incomplete files", () => {
  assert.equal(getAndroidUpdateOffer({ ...validManifest, apkParts: ["http://yijuanchunfeng-updates--update-feed.expo.app/releases/v1/part-000.bin"] }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, apkParts: ["https://example.com/app.apk"] }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, apkParts: ["https://yijuanchunfeng-updates--update-feed.expo.app/releases/v1/part-0.bin"] }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, apkPartSizes: [4] }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, apkSizeBytes: 9 }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, apkPartSizes: [4, 30 * 1024 * 1024], apkSizeBytes: 30 * 1024 * 1024 + 4 }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, apkMd5: "not-a-hash" }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, platform: "ios" }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, androidVersionCode: "3" }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, androidVersionCode: "3.2" }, 2), null);
  assert.equal(getAndroidUpdateOffer({ ...validManifest, version: "" }, 2), null);
});

test("fetches the configured manifest and returns an available Android update", async () => {
  const offer = await fetchAndroidUpdateOffer(ANDROID_UPDATE_MANIFEST_URL, 2, async (url, options) => {
    assert.equal(url, ANDROID_UPDATE_MANIFEST_URL);
    assert.equal(options.headers.Accept, "application/json");
    return { ok: true, json: async () => validManifest };
  });
  assert.equal(offer.versionCode, 3);
});

test("does not accept an unconfigured update feed URL", async () => {
  await assert.rejects(fetchAndroidUpdateOffer("http://localhost/latest.json", 2, async () => ({ ok: true })), /未配置/u);
});

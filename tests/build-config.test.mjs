import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const easConfig = JSON.parse(readFileSync(new URL("../mobile/eas.json", import.meta.url), "utf8"));
const appConfig = JSON.parse(readFileSync(new URL("../mobile/app.json", import.meta.url), "utf8"));

test("EAS preview profile creates an internally distributable Android APK", () => {
  assert.equal(easConfig.build.preview.distribution, "internal");
  assert.equal(easConfig.build.preview.android.buildType, "apk");
});

test("Expo project is configured under the provided team account", () => {
  assert.equal(appConfig.expo.owner, "a114324s-team");
  assert.match(appConfig.expo.extra.eas.projectId, /^[0-9a-f-]{36}$/u);
});

test("Expo branding uses 一卷春风 while preserving installed app identity", () => {
  assert.equal(appConfig.expo.name, "一卷春风");
  assert.equal(appConfig.expo.slug, "yijuan-chunfeng");
  assert.equal(appConfig.expo.scheme, "yijuanchunfeng");
  assert.equal(appConfig.expo.ios.bundleIdentifier, "com.jingri.classics");
  assert.equal(appConfig.expo.android.package, "com.jingri.classics");
});

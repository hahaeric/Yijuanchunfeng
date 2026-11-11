import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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
  assert.equal(appConfig.expo.slug, "jingri-classics");
  assert.equal(appConfig.expo.scheme, "yijuanchunfeng");
  assert.equal(appConfig.expo.ios.bundleIdentifier, "com.jingri.classics");
  assert.equal(appConfig.expo.android.package, "com.jingri.classics");
});

test("Expo uses the supplied logo for web, app, and Android adaptive icons", () => {
  assert.equal(appConfig.expo.icon, "./assets/icon.png");
  assert.equal(appConfig.expo.web.favicon, "./assets/favicon.png");

  const adaptiveIcon = appConfig.expo.android.adaptiveIcon;
  assert.equal(adaptiveIcon.backgroundColor, "#AD3A2F");
  assert.equal(adaptiveIcon.foregroundImage, "./assets/android-icon-foreground.png");
  assert.equal(adaptiveIcon.backgroundImage, "./assets/android-icon-background.png");
  assert.equal(adaptiveIcon.monochromeImage, "./assets/android-icon-monochrome.png");

  const logoAssets = [
    "../mobile/assets/brand-logo.png",
    "../mobile/assets/icon.png",
    "../mobile/assets/android-icon-foreground.png",
    "../mobile/assets/android-icon-background.png",
    "../mobile/assets/android-icon-monochrome.png",
  ];

  for (const assetPath of logoAssets) {
    const assetUrl = new URL(assetPath, import.meta.url);
    assert.equal(existsSync(assetUrl), true, `${assetPath} should exist`);
    const png = readFileSync(assetUrl);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 1024, `${assetPath} should be 1024 pixels wide`);
    assert.equal(png.readUInt32BE(20), 1024, `${assetPath} should be 1024 pixels tall`);
  }

  const favicon = readFileSync(new URL("../mobile/assets/favicon.png", import.meta.url));
  assert.equal(favicon.readUInt32BE(16), 64, "favicon should be 64 pixels wide");
  assert.equal(favicon.readUInt32BE(20), 64, "favicon should be 64 pixels tall");
});

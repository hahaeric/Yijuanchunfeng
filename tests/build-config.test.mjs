import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import updateClient from "../mobile/src/update-client.js";

const easConfig = JSON.parse(readFileSync(new URL("../mobile/eas.json", import.meta.url), "utf8"));
const appConfig = JSON.parse(readFileSync(new URL("../mobile/app.json", import.meta.url), "utf8"));
const mobilePackage = JSON.parse(readFileSync(new URL("../mobile/package.json", import.meta.url), "utf8"));
const androidUpdateFeed = JSON.parse(readFileSync(new URL("../mobile/public/latest.json", import.meta.url), "utf8"));

test("EAS preview profile creates an internally distributable Android APK", () => {
  assert.equal(easConfig.build.preview.distribution, "internal");
  assert.equal(easConfig.build.preview.android.buildType, "apk");
  assert.equal(easConfig.build.preview.channel, "preview");
});

test("release APK is configured for prompted Expo updates and Android package updates", () => {
  assert.equal(appConfig.expo.version, "0.1.2");
  assert.equal(appConfig.expo.android.versionCode, 4);
  assert.equal(appConfig.expo.runtimeVersion.policy, "appVersion");
  assert.equal(appConfig.expo.updates.url, `https://u.expo.dev/${appConfig.expo.extra.eas.projectId}`);
  assert.equal(appConfig.expo.updates.checkAutomatically, "NEVER");
  assert.ok(appConfig.expo.android.permissions.includes("android.permission.REQUEST_INSTALL_PACKAGES"));
  assert.equal(appConfig.expo.extra.androidUpdateManifestUrl, updateClient.ANDROID_UPDATE_MANIFEST_URL);
  assert.equal(mobilePackage.dependencies.expo, "~57.0.33");
  assert.equal(mobilePackage.dependencies["expo-updates"], "~57.0.28");
  assert.equal(mobilePackage.dependencies["expo-application"], "~57.0.3");
  assert.equal(mobilePackage.dependencies["expo-file-system"], "~57.0.7");
  assert.equal(mobilePackage.dependencies["expo-intent-launcher"], "~57.0.1");
});

test("native APK update feed stays on the installed-or-older version until a build is published", () => {
  assert.equal(androidUpdateFeed.platform, "android");
  assert.ok(Number.isSafeInteger(androidUpdateFeed.androidVersionCode));
  assert.ok(androidUpdateFeed.androidVersionCode <= appConfig.expo.android.versionCode);
  if (androidUpdateFeed.androidVersionCode === appConfig.expo.android.versionCode) {
    assert.ok(androidUpdateFeed.apkParts.length > 0);
    assert.equal(androidUpdateFeed.apkPartSizes.length, androidUpdateFeed.apkParts.length);
    assert.equal(androidUpdateFeed.apkPartSizes.reduce((total, size) => total + size, 0), androidUpdateFeed.apkSizeBytes);
    assert.match(androidUpdateFeed.apkMd5, /^[a-f0-9]{32}$/u);
  }
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

test("account sessions use secure native storage and its config plugin", () => {
  assert.ok(mobilePackage.dependencies["expo-secure-store"]);
  assert.ok(appConfig.expo.plugins.includes("expo-secure-store"));
});

test("preview APK includes the configured Supabase public project without privileged secrets", () => {
  const env = easConfig.build.preview.env;
  assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, "https://tzjuggunuelhprcxdrwv.supabase.co");
  assert.match(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_[A-Za-z0-9_-]+$/);
  assert.ok(!Object.keys(env).some(key => /SERVICE_ROLE|SECRET|PASSWORD/i.test(key)));
});

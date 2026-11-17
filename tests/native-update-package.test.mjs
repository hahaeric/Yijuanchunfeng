import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  UPDATE_FEED_BASE_URL,
  prepareNativeUpdate
} from "../mobile/scripts/prepare-native-update.mjs";

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "yijuan-update-test-"));
  const mobileDirectory = path.join(root, "mobile");
  await mkdir(mobileDirectory, { recursive: true });
  await writeFile(path.join(mobileDirectory, "app.json"), JSON.stringify({
    expo: { version: "1.2.3", android: { versionCode: 7 } }
  }));
  return { root, mobileDirectory };
}

test("APK preparation splits and hashes the signed package into a deployable manifest", async (context) => {
  const fixture = await makeFixture();
  context.after(() => rm(fixture.root, { recursive: true, force: true }));
  const apkPath = path.join(fixture.root, "app.apk");
  const apkBytes = Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.from("1234567890abcdef")]);
  await writeFile(apkPath, apkBytes);

  const { manifest, releaseDirectory } = await prepareNativeUpdate({
    apkPath,
    mobileDirectory: fixture.mobileDirectory,
    releaseNotes: `  ${"更".repeat(700)}  `,
    chunkSizeLimit: 8,
    now: () => 12345
  });

  assert.equal(manifest.platform, "android");
  assert.equal(manifest.version, "1.2.3");
  assert.equal(manifest.androidVersionCode, 7);
  assert.deepEqual(manifest.apkPartSizes, [8, 8, 4]);
  assert.equal(manifest.apkSizeBytes, apkBytes.length);
  assert.equal(manifest.apkMd5, createHash("md5").update(apkBytes).digest("hex"));
  assert.equal(manifest.releaseNotes.length, 600);
  assert.deepEqual(manifest.apkParts, [0, 1, 2].map((index) =>
    `${UPDATE_FEED_BASE_URL}/releases/v1.2.3-7-12345/part-${String(index).padStart(3, "0")}.bin`));

  const reconstructed = Buffer.concat(await Promise.all([0, 1, 2].map((index) =>
    readFile(path.join(releaseDirectory, `part-${String(index).padStart(3, "0")}.bin`)))));
  assert.deepEqual(reconstructed, apkBytes);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(fixture.mobileDirectory, "public", "latest.json"), "utf8")),
    manifest
  );
});

test("APK preparation rejects files that are not APK/ZIP archives", async (context) => {
  const fixture = await makeFixture();
  context.after(() => rm(fixture.root, { recursive: true, force: true }));
  const apkPath = path.join(fixture.root, "not-an-apk.bin");
  await writeFile(apkPath, "not an apk");

  await assert.rejects(
    prepareNativeUpdate({ apkPath, mobileDirectory: fixture.mobileDirectory }),
    /不是有效的 APK/u
  );
});

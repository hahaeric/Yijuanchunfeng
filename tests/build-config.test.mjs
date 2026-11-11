import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const easConfig = JSON.parse(readFileSync(new URL("../mobile/eas.json", import.meta.url), "utf8"));

test("EAS preview profile creates an internally distributable Android APK", () => {
  assert.equal(easConfig.build.preview.distribution, "internal");
  assert.equal(easConfig.build.preview.android.buildType, "apk");
});

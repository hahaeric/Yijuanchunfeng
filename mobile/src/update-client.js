const ANDROID_UPDATE_MANIFEST_URL = "https://yijuanchunfeng-updates--update-feed.expo.app/latest.json";

const APK_PART_URL_PATTERN = /^https:\/\/yijuanchunfeng-updates--update-feed\.expo\.app\/releases\/[A-Za-z0-9._-]+\/part-\d{3}\.bin$/u;
const MAX_APK_PART_SIZE = 24 * 1024 * 1024;

function getAndroidUpdateOffer(manifest, installedVersionCode) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return null;

  const currentCode = Number(installedVersionCode);
  const nextCode = manifest.androidVersionCode;
  if (!Number.isSafeInteger(currentCode) || currentCode < 0) return null;
  if (!Number.isSafeInteger(nextCode) || nextCode <= currentCode) return null;
  if (manifest.platform !== "android") return null;
  if (typeof manifest.version !== "string" || !manifest.version.trim()) return null;
  if (!Array.isArray(manifest.apkParts) || manifest.apkParts.length < 1 || manifest.apkParts.length > 10) return null;
  if (!Array.isArray(manifest.apkPartSizes) || manifest.apkPartSizes.length !== manifest.apkParts.length) return null;
  if (!manifest.apkParts.every((url) => typeof url === "string" && APK_PART_URL_PATTERN.test(url))) return null;
  if (!manifest.apkPartSizes.every((size) => Number.isSafeInteger(size) && size > 0 && size <= MAX_APK_PART_SIZE)) return null;
  if (!Number.isSafeInteger(manifest.apkSizeBytes) || manifest.apkSizeBytes <= 0) return null;
  if (manifest.apkPartSizes.reduce((total, size) => total + size, 0) !== manifest.apkSizeBytes) return null;
  if (typeof manifest.apkMd5 !== "string" || !/^[a-f0-9]{32}$/iu.test(manifest.apkMd5)) return null;

  return {
    kind: "native",
    version: manifest.version.trim(),
    versionCode: nextCode,
    apkParts: manifest.apkParts,
    apkPartSizes: manifest.apkPartSizes,
    apkSizeBytes: manifest.apkSizeBytes,
    apkMd5: manifest.apkMd5.toLowerCase(),
    releaseNotes: typeof manifest.releaseNotes === "string" ? manifest.releaseNotes.slice(0, 600) : ""
  };
}

async function fetchAndroidUpdateOffer(manifestUrl, installedVersionCode, fetchImpl = fetch) {
  if (manifestUrl !== ANDROID_UPDATE_MANIFEST_URL) {
    throw new Error("Android 更新地址未配置。");
  }

  const response = await fetchImpl(manifestUrl, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`更新服务器暂时不可用（${response.status}）。`);

  const manifest = await response.json();
  return getAndroidUpdateOffer(manifest, installedVersionCode);
}

module.exports = {
  ANDROID_UPDATE_MANIFEST_URL,
  fetchAndroidUpdateOffer,
  getAndroidUpdateOffer
};

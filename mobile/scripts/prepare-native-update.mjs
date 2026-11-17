import { createReadStream } from "node:fs";
import { mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultMobileDirectory = path.resolve(scriptDirectory, "..");
export const UPDATE_FEED_BASE_URL = "https://yijuanchunfeng-updates--update-feed.expo.app";

export async function prepareNativeUpdate({
  apkPath,
  releaseNotes = "",
  mobileDirectory = defaultMobileDirectory,
  chunkSizeLimit = 20 * 1024 * 1024,
  now = Date.now
}) {
  const resolvedApkPath = path.resolve(apkPath || "");
  const apkStats = await stat(resolvedApkPath);
  if (!apkStats.isFile() || apkStats.size < 8) {
    throw new Error("请提供 EAS 生成的 APK 文件路径。");
  }
  if (!Number.isSafeInteger(chunkSizeLimit) || chunkSizeLimit < 4) {
    throw new Error("APK 分片大小无效。");
  }

  const apkHeader = Buffer.alloc(4);
  const apkHeaderFile = await open(resolvedApkPath, "r");
  try {
    await apkHeaderFile.read(apkHeader, 0, apkHeader.length, 0);
  } finally {
    await apkHeaderFile.close();
  }
  if (apkHeader.toString("ascii") !== "PK\u0003\u0004") {
    throw new Error("文件不是有效的 APK/ZIP 安装包。");
  }

  const appConfig = JSON.parse(await readFile(path.join(mobileDirectory, "app.json"), "utf8"));
  const appVersion = appConfig.expo?.version;
  const versionCode = appConfig.expo?.android?.versionCode;
  if (typeof appVersion !== "string" || !appVersion.trim() || !Number.isSafeInteger(versionCode)) {
    throw new Error("app.json 缺少有效的 Android 版本号。");
  }

  const releaseId = `v${appVersion}-${versionCode}-${now()}`;
  const releaseDirectory = path.join(mobileDirectory, "public", "releases", releaseId);
  await mkdir(releaseDirectory, { recursive: true });

  const apkHash = createHash("md5");
  const apkParts = [];
  const apkPartSizes = [];
  let bufferedChunks = [];
  let bufferedBytes = 0;
  let totalBytes = 0;

  async function flushPart() {
    if (bufferedBytes === 0) return;
    const partIndex = apkParts.length;
    const partName = `part-${String(partIndex).padStart(3, "0")}.bin`;
    await writeFile(path.join(releaseDirectory, partName), Buffer.concat(bufferedChunks, bufferedBytes));
    apkParts.push(`${UPDATE_FEED_BASE_URL}/releases/${releaseId}/${partName}`);
    apkPartSizes.push(bufferedBytes);
    bufferedChunks = [];
    bufferedBytes = 0;
  }

  for await (const sourceChunk of createReadStream(resolvedApkPath)) {
    apkHash.update(sourceChunk);
    totalBytes += sourceChunk.length;
    let offset = 0;
    while (offset < sourceChunk.length) {
      const remainingCapacity = chunkSizeLimit - bufferedBytes;
      const length = Math.min(remainingCapacity, sourceChunk.length - offset);
      bufferedChunks.push(sourceChunk.subarray(offset, offset + length));
      bufferedBytes += length;
      offset += length;
      if (bufferedBytes === chunkSizeLimit) await flushPart();
    }
  }
  await flushPart();

  if (totalBytes !== apkStats.size || apkParts.length === 0 || apkParts.length > 10) {
    throw new Error("APK 分片结果校验失败。");
  }

  const manifest = {
    platform: "android",
    version: appVersion.trim(),
    androidVersionCode: versionCode,
    apkParts,
    apkPartSizes,
    apkSizeBytes: totalBytes,
    apkMd5: apkHash.digest("hex"),
    releaseNotes: String(releaseNotes).trim().slice(0, 600)
  };
  await writeFile(path.join(mobileDirectory, "public", "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, releaseDirectory };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = await prepareNativeUpdate({
    apkPath: process.argv[2],
    releaseNotes: process.argv.slice(3).join(" ")
  });
  console.log(`已准备 ${result.manifest.apkParts.length} 个安装包分片（${result.manifest.apkSizeBytes} bytes）。`);
  console.log(`Android 版本：${result.manifest.version}（versionCode ${result.manifest.androidVersionCode}）`);
  console.log("下一步运行 npm run deploy:update-feed 发布更新清单和安装包分片。");
}

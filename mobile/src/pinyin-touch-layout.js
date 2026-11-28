// Use real layout bounds: native hitSlop cannot extend beyond the parent.
function getPinyinTouchLayout(platform, fontSize, pinyinHeight) {
  return platform === "android"
    ? { minWidth: Math.max(32, fontSize), height: Math.max(36, pinyinHeight) }
    : { height: pinyinHeight };
}
module.exports = { getPinyinTouchLayout };

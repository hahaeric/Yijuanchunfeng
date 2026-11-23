# 一卷春风：四书五经移动阅读 App

这是一个以 Expo / React Native 编写的手机阅读 App。原文和拼音打包在本地，阅读位置、收藏、笔记、今日阅读记录和设置保存在设备本地；应用更新使用 Expo Update，原生 APK 版本清单托管在 Expo Hosting。

## 阅读内容

本地收录四书五经九部文本，共 5,041 条可连续阅读的章句、诗章或经文段落：

- 四书：《大学》11 个目录条目、17 段（含单独标明的朱熹格物致知补文），《中庸》33 章、《论语》20 篇、《孟子》14 章句。
- 五经：《诗经》305 篇、《尚书》58 篇、《礼记》49 篇、《周易》64 卦与《易传》十翼、《春秋》十二公经文。

《礼记》保留《大学》《中庸》原篇，所以与四书单独收录时会重复出现。当前界面展示原文和逐字对齐的自动拼音；《论语》按说话人分段，同一轮问答仍作为一则内容。拼音不是邓启铜注音版，古汉语异读可能需要校订。

《论语》《大学》《中庸》全文通过 `mobile/src/data/supplied-edition-text.json` 接入用户提供的邓启铜注释本 PDF / Word 的整理版本；来源文件名、SHA-256 和每条内容的 PDF 页码随数据保存。《大学》按该版本重排，补文独立标注；《中庸》补齐章名。《孟子》《诗经》《尚书》《周易》另通过 `four-books.json` 接入扫描 PDF 整理版本；《礼记》《春秋》保留原语料。整理方法和校订边界见 [版本整理记录](docs/supplied-edition.md)。这次采用扫描识别、原语料对齐及候选差异人工核对，不能等同于全书逐字人工校定。

## 桌面预览

在项目根目录运行 `npm run web`，浏览器会显示手机尺寸的界面。

## 在手机上体验

在项目根目录运行 `npm start`，用手机上的 Expo Go 扫描终端显示的二维码。手机和开发电脑需要能够互相访问。

## Android APK 与应用更新

- 当前已安装的旧版还没有应用内更新能力，需要先手动安装一次包含更新模块的新 APK；此后普通内容、文字、界面和 JavaScript 功能更新都可在应用内提示并完成。
- EAS 内部分发 APK：`npx eas-cli@latest build --profile preview --platform android`。
- 拼音、内容和界面更新：`npx eas-cli@latest update --channel preview --message "更新说明" --platform android`。客户端启动时检查，也可在“阅读设置 → 应用更新”手动检查；确认后下载并自动重启。
- 原生依赖或权限变更：构建新的 APK，并增加 `mobile/app.json` 中的 `version` 与 `android.versionCode`。把 EAS 产物下载到本地后，运行 `npm --prefix mobile run prepare:native-update -- <APK路径> "更新说明"`，再运行 `npm --prefix mobile run deploy:update-feed`。客户端会提示更新、自动下载并合并安装包分片，再打开 Android 系统安装确认；用户无需自行寻找 APK。
- 原生更新清单固定在 `https://yijuanchunfeng-updates--update-feed.expo.app/latest.json`。保留 `com.jingri.classics` 包名及 EAS Android 签名密钥，系统安装时可覆盖更新并保留应用本地数据。

## 内容导入与维护

`npm --prefix mobile run build:data` 会从来源仓库下载原始文本到 `mobile/.data-source/`，整理成离线语料并生成拼音。语料文件夹在 Git 中忽略；已生成的 `mobile/src/data/classics.json` 随 App 提交。

用户版本正文单独维护，不会被 `build:data` 覆盖。修改 `supplied-edition-text.json` 后运行 `npm --prefix mobile run build:supplied-edition`，生成离线简繁文本和自动拼音。再运行 `npm test` 验证发布数据与正文一致。

## 验证

在项目根目录运行 `npm test`。项目没有配置 Android SDK 或 iOS 模拟器；手机真机可使用 Expo Go 预览。

### 四书 PDF 正文更新

《孟子》《诗经》《尚书》《周易》已接入用户提供的邓启铜注释本扫描PDF整理数据，补入26条篇序/笙诗说明，保留所有旧阅读ID，全库5067条。正文采用OCR辅助差异核对，拼音仍为程序自动注音。来源及维护说明见 `docs/four-books-import.md`。

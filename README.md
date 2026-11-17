# 一卷春风：四书五经移动阅读 App

这是一个以 Expo / React Native 编写的手机阅读 App。原文和拼音打包在本地，阅读位置、收藏、笔记、今日阅读记录和设置保存在设备本地；应用更新使用 Expo Update，原生 APK 版本清单托管在 Expo Hosting。

## 阅读内容

本地收录四书五经九部文本，共 5,039 条可连续阅读的章句、诗章或经文段落：

- 四书：《大学》16 段、《中庸》33 章、《论语》20 篇、《孟子》14 章句。
- 五经：《诗经》305 篇、《尚书》58 篇、《礼记》49 篇、《周易》64 卦与《易传》十翼、《春秋》十二公经文。

《礼记》保留《大学》《中庸》原篇，所以与四书单独收录时会重复出现。当前界面展示原文和逐字对齐的自动拼音；《论语》按说话人分段，同一轮问答仍作为一则内容。拼音不是邓启铜注音版，古汉语异读可能需要校订。九部书的来源和整理说明保存在 `mobile/src/data/classics.json`，汇总见产品设计文档。

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

## 验证

在项目根目录运行 `node --test tests/model.test.mjs`。项目没有配置 Android SDK 或 iOS 模拟器；手机真机可使用 Expo Go 预览。

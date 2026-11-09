# 经日：四书五经手机 App Demo

这是一个以 Expo / React Native 编写的手机 App 交互原型，页面使用原生移动组件，按竖屏和单手操作设计。没有后端；阅读位置、收藏、笔记和设置保存在设备本地。演示正文目前只包含《论语·学而》的部分顺序样例，译文与注释为模拟内容。

## 桌面快速预览

首次运行先在项目根目录运行 npm --prefix mobile install。之后运行 npm run web，浏览器会显示同一套 React Native 界面，使用手机尺寸的预览框。

## 在手机上体验

在项目根目录运行 npm start，然后用手机上的 Expo Go 扫描终端显示的二维码。手机和开发电脑需要能够互相访问。

## 测试

在项目根目录运行 npm test。

当前开发环境没有 Android SDK 或 iOS 模拟器；移动端源码与应用配置已就绪，后续可以用 Expo Go 在实体设备上预览，或在配置 Android Studio / Xcode 后生成安装包。

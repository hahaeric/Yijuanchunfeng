# iPhone 网页版

独立构建：在 mobile 目录运行 `node scripts/build-iphone-web.mjs`。
输出到忽略的 `web-dist/`，不修改 Android 源码、配置或 OTA 频道。

发布：在 mobile 目录运行 `npx eas-cli@latest deploy --export-dir web-dist --alias iphone --non-interactive`。
沿用已有 Expo Hosting 项目，独立 iphone 别名，不覆盖 Android update-feed 别名。

Safari 打开发布地址，通过“分享 → 添加到主屏幕”安装入口。
使用现有 Supabase 项目和阅读编号，登录同一账号同步进度和每日统计。
笔记、收藏、设置保留在本机；沿用现有网页账户策略，刷新需要重新登录。

不注册离线 Service Worker，重新打开或刷新加载新 HTML 和带哈希的资源。
已打开页面不会自动强制重载，以免中断阅读和同步。
网页独立构建时使用临时 App.web.js 适配全屏和“刷新页面”按钮，完成后删除，不改变原生 App.js。
部署后须验证 HTTPS 首页、manifest 和图标可访问；iPhone 真机安装与双设备同步需实机验收。

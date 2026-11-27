# iPhone 网页版

独立构建：在 mobile 目录运行 `node scripts/build-iphone-web.mjs`。
输出到忽略的 `web-dist/`，不修改 Android 源码、配置或 OTA 频道。

发布：在 mobile 目录运行 `npx eas-cli@latest deploy --export-dir web-dist --alias iphone --non-interactive`。
沿用已有 Expo Hosting 项目，独立 iphone 别名，不覆盖 Android update-feed 别名。

Safari 打开发布地址，通过“分享 → 添加到主屏幕”安装入口。
使用现有 Supabase 项目和阅读编号，登录同一账号同步进度和每日统计。
笔记、收藏、设置保留在本机；沿用现有网页账户策略，刷新需要重新登录。

启动先显示加载提示，失败或超过20秒提供重试。构建时提前完成版本合并与拼音校订，避免手机启动重复整理语料。
正文从 JavaScript 中分离为九部书籍的哈希 JSON 资源，来源信息去重。
首次并行加载全部书籍以保证全文搜索、收藏和历史进度迁移完整；后续优先使用 Cache Storage。
JavaScript 启动包由约17.1MB降至707KB；正文和迁移数据另约9.79MB（均为未压缩体积），首次仍需下载。
Service Worker 缓存首页和脚本，可离线重开；只缓存本站静态资源，不缓存账号请求。
资源使用内容哈希，新旧数据隔离。打开时后台检查新版 Worker，安装成功后供后续打开使用；不强制中断正在阅读的页面。
缓存不可用或空间不足时退回网络；首次未完成下载时仍需联网。
网页独立构建时使用临时 App.web.js、App.iphone.js、src/model.web.js，完成后删除，不改变原生 App.js 和 model.js。
启动诊断可在浏览器开发工具查看 window.__iphoneTiming，包含数据准备及首次显示耗时。
部署后须验证 HTTPS 首页、manifest 和图标可访问；iPhone 真机安装与双设备同步需实机验收。

本机 Edge 已验证首次进入、缓存重开、断网重开以及阅读位置保留。该结果不等于 iPhone 实机耗时；账号/数据库未改，真实双设备登录同步未在此轮实测。

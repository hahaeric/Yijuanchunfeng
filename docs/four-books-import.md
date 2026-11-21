# 四部经典 PDF 更新记录

状态：来源检查和正文识别进行中，尚未修改客户端阅读内容，尚未发布这四本的更新。

本轮已完成四书正文范围的初识、复识与旧文比对，并将 454 处原页复核修改记入 `docs/edition-review/`（孟子 98、诗经 203、尚书 76、易经 77）。这只是待导入的差异记录，不代表客户端已更新，也不是全文逐字人工校勘的声明。页码匹配低覆盖项仍需人工复核，尤其《尚书》旧文中《尧典》末三段与《舜典》开头重复的问题；去重必须同时维护旧 ID 的定位兼容。

`render-edition-differences.py` 可按差异索引裁切原 PDF，核验源文件哈希及逐字位置，保留相邻正文与黑底通假提示供人工区分。新增测试验证裁切边界、识别空白差异、454 处修改的原文位置、源文件摘要与重复覆盖；扫描图片和核对拼图仍只保存在本机忽略目录。

本次范围为用户提供的《孟子》《诗经》《尚书》《易经》四份扫描 PDF，分别为 397、353、415、226 页。原文件只读，逐页识别缓存保存在 Git 忽略的 `mobile/.data-source/four-books/`，不提交扫描文件、依赖包或本机绝对路径。

已核对版权页：《孟子》《尚书》为东南大学出版社 2015 年 10 月第 2 版，邓启铜注释、陈红映审读；《诗经》《易经》为南京大学出版社 2014 年 5 月第 1 版的国学经典大字注音全本。各书会分别记录出版信息、原文件 SHA-256 和正文页码，不能共用上次三本书的版本来源。

维护工具 `mobile/scripts/ocr-supplied-editions.py` 读取本机清单，对页面保存带源文件摘要的 OCR 证据；支持指定页码、续跑和重新识别，来源文件变化或缓存不完整时不复用错误证据。`mobile/scripts/edition_evidence.py` 按字框高度和阅读顺序提取待核对的正文行，保留生僻字、标点和原始位置，不直接生成发布正文。小字拼音、页下注释、书侧标签和重叠字框均有独立测试。

识别清单格式为 `[{"id":"mengzi","path":"本机PDF路径","bodyStart":12}]`；清单应置于忽略目录。运行示例：

```powershell
python mobile/scripts/ocr-supplied-editions.py --manifest mobile/.data-source/four-books/manifest.json --book mengzi --output mobile/.data-source/four-books/ocr --body-min-height 0.02
python tests/ocr-evidence.test.py
python tests/edition-evidence.test.py
```

初识结果保留不覆盖，`mobile/scripts/rerecognize-edition-rows.py` 可将同一正文行里分散的单字框合并裁切，用 PP-OCRv5 server 模型复识，保存逐字坐标、置信度和初识对照。这一步尤其用于旧模型易混淆的“曰 / 日”、手写体和生僻字。复识结果仍是核对材料，不自动等同于发布正文。维护依赖使用 `pypdf`、`rapidocr_onnxruntime==1.4.4`、`rapidocr==3.10.0` 和 ONNX Runtime，均与手机应用依赖隔离。

计划保留原阅读条目 ID，并核对全文、目录及各书首尾。《诗经》按篇、诗章核对；《易经》扫描本将《彖》《象》《文言》穿插在卦文中，需要逐条对应应用原有内容，避免漏段和重复。后续完成差异核对、数据生成、阅读数据兼容及全部测试后，才能提交正文并发布客户端内容更新。未核实的 OCR 结果不标为已校订全文。

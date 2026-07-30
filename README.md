# 数据安全题库模拟练习

这是一个静态网页题库练习工具。项目从随仓库附带的 PDF 文件 `./48dfbf7cad45d0f4.pdf` 提取题目，生成可检索的 `./questions.json`，并提供浏览器端模拟答题、即时判分、交卷统计和历史趋势展示。

## 功能

- 按单选题、多选题、判断题分区练习。
- 每个题型可选择抽题数量，包括 10、20、50、100 或全部。
- 每题提交后立即显示是否正确和正确答案。
- 需要全部题目提交后才能交卷查看成绩。
- 交卷后显示总正确率和分题型正确率。
- 浏览器会保存练习历史，并展示最近 12 次正确率趋势。

## 文件结构

- `./index.html`：网页入口。
- `./styles.css`：页面样式。
- `./app.js`：抽题、判分、成绩统计和历史记录逻辑。
- `./48dfbf7cad45d0f4.pdf`：题库来源 PDF。
- `./questions.json`：结构化题库数据。
- `./questions-data.js`：用于直接打开网页时加载题库。
- `./history.json`：历史记录初始文件。
- `./parse-report.json`：题库解析报告。
- `./tools/extract_questions.py`：从 PDF 重新生成题库的脚本。

## 使用方式

直接打开 `./index.html` 即可使用。页面默认读取 `./questions-data.js`，通常不需要启动本地服务。

如果需要通过 `./questions.json` 调试数据加载，可以在项目根目录启动一个静态服务：

```powershell
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

## 练习历史

网页会把交卷记录保存到当前浏览器的 `localStorage` 中。`./history.json` 只是初始文件；纯静态网页不能直接把新的练习历史写回磁盘文件。

如果更换浏览器、清理浏览器数据或使用无痕模式，历史记录可能不会保留。

## 题库统计

当前解析结果：

- 总题数：1806
- 单选题：1036
- 多选题：428
- 判断题：342
- 解析异常：0

## 重新生成题库

在项目根目录运行：

```powershell
python .\tools\extract_questions.py
```

脚本会读取 `./48dfbf7cad45d0f4.pdf`，并覆盖生成：

- `./questions.json`
- `./questions-data.js`
- `./parse-report.json`

题库 JSON 字段包括：

- `id`：题号。
- `type`：题型，取值为 `single`、`multi` 或 `judge`。
- `question`：题干。
- `options`：选项。
- `answer`：正确答案。
- `sourcePage`：来源 PDF 页码。

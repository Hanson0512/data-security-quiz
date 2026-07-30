# 数据安全题库模拟练习

这个项目从当前目录下的 `48dfbf7cad45d0f4.pdf` 提取题目，生成可检索的 `questions.json`，并提供一个静态网页版模拟答题小程序。

## 文件结构

- `index.html`：答题网页入口。
- `styles.css`：页面样式。
- `app.js`：随机抽题、答题判分、成绩统计逻辑。
- `48dfbf7cad45d0f4.pdf`：题库来源 PDF，已复制到当前项目目录。
- `questions.json`：结构化题库，共 1806 题。
- `questions-data.js`：给网页直接双击打开时使用的内嵌题库数据。
- `history.json`：历史记录初始文件，默认是空数组。
- `parse-report.json`：PDF 解析报告，记录题型数量和异常。
- `tools/extract_questions.py`：从 PDF 重新生成题库的脚本。

## 使用方式

优先直接双击打开 `index.html`。页面会读取 `questions-data.js`，因此通常不需要启动服务。

网页的练习历史会自动保存在当前浏览器的 `localStorage` 中，并在页面下方展示最近 12 次交卷趋势。`history.json` 是本地初始文件；纯静态网页不能直接把新历史写回磁盘文件。

如果你想用 `questions.json` 的方式调试，或浏览器环境有额外限制，请在本目录运行一个静态服务：

```powershell
cd "D:\ccs\CTF\数据安全\数据安全题库模拟练习"
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

如果系统默认 `python` 不可用，也可以使用 Codex bundled Python：

```powershell
& "C:\Users\杨皓森\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 8000
```

## 题库统计

当前解析结果：

- 总题数：1806
- 单选题：1036
- 多选题：428
- 判断题：342
- 解析异常：0

## 重新生成题库

在本目录运行：

```powershell
& "C:\Users\杨皓森\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" ".\tools\extract_questions.py"
```

脚本会覆盖生成：

- `questions.json`
- `questions-data.js`
- `parse-report.json`

题库 JSON 字段包括：

- `id`：题号。
- `type`：题型，`single` / `multi` / `judge`。
- `question`：题干。
- `options`：选项。
- `answer`：正确答案。
- `sourcePage`：来源 PDF 页码。

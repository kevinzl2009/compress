# 图片压缩工具

在浏览器里压缩图片，图片不会上传到任何服务器。

在线使用：https://kevinzl2009.github.io/compress/

## 功能

- 拖放、点击选择或直接粘贴（Ctrl+V）图片，可一次处理多张
- 可调压缩质量（10%–100%）
- 输出格式：JPG / WebP / 保持原格式
- 可限制最大宽度（4K、1920、1280、800），大图自动等比缩小
- 显示压缩前后大小和节省比例；压完反而变大的小图会自动保留原图
- 单张下载或全部下载，文件名自动加 `-compressed` 和正确的扩展名

## 网站结构

推送到 `master` 后，GitHub Actions（`.github/workflows/deploy-pages.yml`）自动发布：

- `/compress/` → 图片压缩工具（`index.html`、`script.js`、`styles.css`）
- `/compress/racing-game/` → 赛车游戏（`racing-game/`）

## 技术栈

纯 HTML + CSS + JavaScript，无依赖。本地直接双击 `index.html` 即可使用。

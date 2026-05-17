# ClearMatte Studio

[English](./README.md)

ClearMatte Studio 是一个静态网页应用，用于在浏览器中完成图片背景移除。应用基于 Transformers.js 和 `studioludens/birefnet-lite-512` ONNX 模型运行，图片和推理都留在本地浏览器内处理。

![ClearMatte Studio 演示截图](./imgs/Crystal-demo.png)

## 功能

- 支持上传 PNG、JPEG、WebP 图片。
- 在浏览器本地运行 alpha matting，无需应用服务器。
- 支持网格、白色、深色、自定义颜色背景预览。
- 可调整边缘阈值、柔和度和清理强度。
- 可导出透明 PNG，或导出带纯色背景的 PNG。

## 本地运行

```bash
python3 -m http.server 5173
```

然后打开 `http://localhost:5173`。

WebGPU 需要安全上下文；现代浏览器会接受 `localhost`。如果 WebGPU 不可用，应用会自动回退到 WASM。

## 模型下载

模型文件默认从 Hugging Face Hub 下载。中国大陆访问会根据浏览器时区或语言自动切换到 `hf-mirror.com` 镜像。

测试时可以手动覆盖：

- `?mirror=1` 强制使用中国区镜像。
- `?mirror=0` 强制使用 Hugging Face Hub。

## 部署

将本仓库作为静态文件部署到 HTTPS 环境即可，无需构建步骤，也不需要服务端运行时。

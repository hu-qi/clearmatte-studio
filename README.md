# ClearMatte Studio

ClearMatte Studio is a static browser app for commercial-friendly background removal. It runs client-side with Transformers.js and the MIT-licensed `studioludens/birefnet-lite-512` ONNX model.

## Run locally

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

WebGPU requires a secure context; `localhost` is accepted by modern browsers. If WebGPU is unavailable, the app falls back to WASM.

## Product scope

- Upload PNG, JPEG, or WebP images.
- Run client-side alpha matting with no application server.
- Preview on grid, white, dark, or custom color backgrounds.
- Adjust cutoff, softness, and cleanup.
- Export transparent PNG or a flattened color-background PNG.

## Demo

Below is a quick demo of a background removal result using the app (source image: `imgs/Crystal.png`):

![ClearMatte demo](imgs/Crystal-demo.png)

---

## 中文说明

ClearMatte Studio 是一个静态浏览器端应用，用于去除图片背景（支持商业使用）。它在浏览器中运行，使用 Transformers.js 加载 MIT 许可的 `studioludens/birefnet-lite-512` ONNX 模型完成 alpha matting（前景抠像）。

运行方法（本地）：

```bash
python3 -m http.server 5173
```

然后打开 `http://localhost:5173`。

要点：
- 支持上传 PNG、JPEG、WebP。
- 在浏览器端进行推理，无需后端服务。
- 支持网格、白色、深色或自定义颜色背景预览。
- 可调节 cutoff、softness、clean 参数以微调抠图效果。
- 导出透明 PNG 或平铺背景的 PNG。

部署说明：

将 `index.html`、`styles.css`、`app.js`、`vercel.json`、`THIRD_PARTY_NOTICES.md` 等静态文件放到支持 HTTPS 的静态主机上即可。WebGPU 在非 localhost 环境下需要 HTTPS。

建议使用 Vercel：无需构建步骤、默认启用 HTTPS，并且支持 GitHub Preview 部署，适合本项目。


The default model is suitable for a commercial product because the model repository declares `license: mit`. Keep the third-party notices with any distribution, and re-check upstream model licenses before changing models.

## Deployment

This app can be deployed as static files. Host `index.html`, `styles.css`, `app.js`, `vercel.json`, and `THIRD_PARTY_NOTICES.md` behind HTTPS so WebGPU can run outside localhost.

### Vercel

Vercel is a good fit for this project:

- It serves static files without a build step.
- HTTPS is enabled by default, which is required for WebGPU outside localhost.
- GitHub integration gives preview deployments for every branch or pull request.
- The app has no server-side runtime cost because inference runs in the browser.

Suggested Vercel settings:

- Framework Preset: `Other`
- Build Command: leave empty
- Output Directory: `.`
- Install Command: leave empty

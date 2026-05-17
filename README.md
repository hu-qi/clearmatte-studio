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

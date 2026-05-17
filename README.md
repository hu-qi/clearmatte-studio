# ClearMatte Studio

[中文说明](./README-zh.md)

ClearMatte Studio is a static browser app for background removal. It runs client-side with Transformers.js and the `studioludens/birefnet-lite-512` ONNX model.

![ClearMatte Studio demo](./imgs/Crystal-demo.png)

## Features

- Upload PNG, JPEG, or WebP images.
- Run alpha matting locally in the browser.
- Preview transparent results on grid, white, dark, or custom backgrounds.
- Adjust cutoff, softness, and cleanup before export.
- Export transparent PNG or a flattened color-background PNG.

## Run Locally

```bash
python3 -m http.server 5173
```

Open `http://localhost:5173`.

WebGPU requires a secure context. `localhost` works in modern browsers; unsupported browsers fall back to WASM.

## Model Downloads

The app first tries to load the model from this same-origin local directory:

```text
models/studioludens/birefnet-lite-512/
```

Download the Hugging Face repo `studioludens/birefnet-lite-512` into that directory to serve the model from your own site. This avoids Hugging Face or mirror access from the browser and bypasses third-party CORS limits. The local model directory is ignored by Git; upload it as static large files or object-storage assets when deploying.

If the local directory is not available, the app falls back to the Hugging Face Hub. Mainland China visitors are automatically routed to the local model directory first, treating your same-origin hosted files as the mirror.

Testing overrides:

- `?model=local` forces local-only model loading.
- `?model=remote` skips local loading and uses the Hugging Face Hub.
- `?model=hub` forces the Hugging Face Hub.
- `?model=mirror` forces the local model mirror.
- `?mirror=1` forces the local model mirror.
- `?mirror=0` forces the Hugging Face Hub.

## Deploy

Deploy the repository as static files behind HTTPS. No build step or server runtime is required.

import { AutoModel, AutoProcessor, RawImage, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

const MODEL_ID = "studioludens/birefnet-lite-512";
const MODEL_REVISION = "4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7";
const LOCAL_MODEL_ROOT = "./models/";
const MAX_CANVAS_EDGE = 4096;
const MODEL_HOSTS = {
  local: {
    key: "local",
    label: "Local model",
  },
  hub: {
    key: "hub",
    host: "https://huggingface.co/",
    label: "HF Hub",
  },
};
const MIRROR_QUERY_PARAM = "mirror";
const MODEL_QUERY_PARAM = "model";

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  canvasFrame: document.querySelector("#canvasFrame"),
  canvas: document.querySelector("#previewCanvas"),
  emptyState: document.querySelector("#emptyState"),
  processButton: document.querySelector("#processButton"),
  exportButton: document.querySelector("#exportButton"),
  resetButton: document.querySelector("#resetButton"),
  compareButton: document.querySelector("#compareButton"),
  compareHandle: document.querySelector("#compareHandle"),
  applyAdjustmentsButton: document.querySelector("#applyAdjustmentsButton"),
  statusText: document.querySelector("#statusText"),
  statusDetail: document.querySelector("#statusDetail"),
  progressFill: document.querySelector("#progressFill"),
  runtimePill: document.querySelector("#runtimePill"),
  runtimeDetail: document.querySelector("#runtimeDetail"),
  backgroundColor: document.querySelector("#backgroundColor"),
  transparentToggle: document.querySelector("#transparentToggle"),
  maxEdgeSelect: document.querySelector("#maxEdgeSelect"),
  cutoffRange: document.querySelector("#cutoffRange"),
  softnessRange: document.querySelector("#softnessRange"),
  cleanRange: document.querySelector("#cleanRange"),
  cutoffValue: document.querySelector("#cutoffValue"),
  softnessValue: document.querySelector("#softnessValue"),
  cleanValue: document.querySelector("#cleanValue"),
};

const ctx = els.canvas.getContext("2d", { alpha: true, willReadFrequently: true });

const state = {
  sourceImage: null,
  sourceUrl: "",
  fileName: "clearmatte",
  displayScale: 1,
  outputCanvas: null,
  originalCanvas: null,
  rawMask: null,
  model: null,
  processor: null,
  device: "auto",
  modelHostLabel: MODEL_HOSTS.hub.label,
  isProcessing: false,
  compare: false,
  compareX: 0.5,
};

configureRuntime();
bindEvents();
resizeStage();
setRangeOutputs();
setStatus("Waiting for an image", 0);

function configureRuntime() {
  env.localModelPath = LOCAL_MODEL_ROOT;
  const modelHost = chooseInitialModelHost();
  applyModelHost(modelHost);
  els.runtimeDetail.textContent = `Auto · ${state.modelHostLabel}`;
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 4);
  }
}

function applyModelHost(modelHost) {
  state.modelHostLabel = modelHost.label;
  if (modelHost.key === "local") {
    env.localModelPath = LOCAL_MODEL_ROOT;
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    return;
  }

  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.remoteHost = modelHost.host;
}

function chooseInitialModelHost() {
  const override = getModelOverride();
  if (override === "local") return MODEL_HOSTS.local;
  if (override === "hub") return MODEL_HOSTS.hub;
  if (override === "mirror") return MODEL_HOSTS.local;
  return MODEL_HOSTS.local;
}

function chooseRemoteModelHost() {
  const override = getMirrorOverride();
  if (override === "hub") return MODEL_HOSTS.hub;
  return MODEL_HOSTS.hub;
}

function getModelOverride() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(MODEL_QUERY_PARAM);
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (["local", "offline", "bundled"].includes(normalized)) return "local";
  if (["remote", "online", "auto"].includes(normalized)) return "remote";
  if (["hub", "huggingface", "hf"].includes(normalized)) return "hub";
  if (["mirror", "cn", "china", "hf-mirror"].includes(normalized)) return "mirror";
  return null;
}

function getMirrorOverride() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(MIRROR_QUERY_PARAM);
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "cn", "china", "mirror", "hf-mirror"].includes(normalized)) {
    return "mirror";
  }
  if (["0", "false", "no", "global", "hub", "huggingface"].includes(normalized)) {
    return "hub";
  }
  return null;
}

function isLikelyMainlandChinaUser() {
  const timeZone = getBrowserTimeZone();
  if (["Asia/Shanghai", "Asia/Chongqing", "Asia/Harbin", "Asia/Urumqi"].includes(timeZone)) {
    return true;
  }

  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => {
    if (typeof language !== "string") return false;
    const normalized = language.toLowerCase();
    return normalized === "zh-cn" || normalized === "zh-hans" || normalized.startsWith("zh-hans-");
  });
}

function getBrowserTimeZone() {
  try {
    return globalThis.Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function bindEvents() {
  els.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) loadFile(file);
  });

  for (const eventName of ["dragenter", "dragover"]) {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.canvasFrame.classList.add("drag-over");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.canvasFrame.classList.remove("drag-over");
    });
  }

  els.dropZone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files || [];
    if (file) loadFile(file);
  });

  els.processButton.addEventListener("click", runMatting);
  els.exportButton.addEventListener("click", exportImage);
  els.resetButton.addEventListener("click", resetWorkspace);
  els.compareButton.addEventListener("click", () => {
    state.compare = !state.compare;
    els.compareButton.classList.toggle("active", state.compare);
    drawPreview();
  });

  for (const input of [els.cutoffRange, els.softnessRange, els.cleanRange]) {
    input.addEventListener("input", () => {
      setRangeOutputs();
      if (state.rawMask) {
        els.applyAdjustmentsButton.disabled = false;
      }
    });
  }

  els.applyAdjustmentsButton.addEventListener("click", () => {
    if (!state.rawMask || !state.sourceImage) return;
    buildOutputFromMask();
    els.applyAdjustmentsButton.disabled = true;
    setStatus("Matte updated", 100);
  });

  document.querySelectorAll("[data-bg]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-bg]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      els.canvasFrame.classList.remove("checker", "white", "charcoal", "color");
      els.canvasFrame.classList.add(button.dataset.bg);
    });
  });

  els.backgroundColor.addEventListener("input", () => {
    els.canvasFrame.style.setProperty("--preview-color", els.backgroundColor.value);
  });

  els.transparentToggle.addEventListener("change", () => {
    if (state.rawMask) buildOutputFromMask();
  });

  els.maxEdgeSelect.addEventListener("change", () => {
    if (state.sourceImage) {
      prepareCanvases(state.sourceImage);
      if (state.rawMask) buildOutputFromMask();
      drawPreview();
    }
  });

  els.canvas.addEventListener("pointerdown", startCompareDrag);
  window.addEventListener("resize", resizeStage);
}

async function loadFile(file) {
  if (!file.type.startsWith("image/")) {
    setStatus("Unsupported file", 0, true);
    return;
  }

  if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
  state.sourceUrl = URL.createObjectURL(file);
  state.fileName = slugify(file.name.replace(/\.[^.]+$/, "")) || "clearmatte";
  state.sourceImage = await loadImage(state.sourceUrl);
  state.rawMask = null;
  state.outputCanvas = null;
  state.compare = false;
  state.compareX = 0.5;

  prepareCanvases(state.sourceImage);
  resizeStage();
  drawPreview();

  els.emptyState.classList.add("hidden");
  els.processButton.disabled = false;
  els.resetButton.disabled = false;
  els.compareButton.disabled = true;
  els.exportButton.disabled = true;
  els.applyAdjustmentsButton.disabled = true;
  setStatus("Image ready", 0);
}

async function runMatting() {
  if (!state.sourceImage || state.isProcessing) return;
  state.isProcessing = true;
  setButtonsBusy(true);
  setStatus("Loading model", 3);

  try {
    await ensureModel();
    setStatus("Preparing pixels", 62);

    const rawImage = await RawImage.read(state.sourceUrl);
    const { pixel_values: pixelValues } = await state.processor(rawImage);

    setStatus("Running model", 74);
    const outputs = await state.model({ input_image: pixelValues });
    const logits = outputs.logits || outputs.output || Object.values(outputs)[0];
    if (!logits?.data) {
      throw new Error("Model output did not include logits.");
    }

    state.rawMask = Float32Array.from(logits.data, sigmoid);
    buildOutputFromMask();
    els.compareButton.disabled = false;
    els.exportButton.disabled = false;
    els.applyAdjustmentsButton.disabled = true;
    setStatus("Ready to export", 100);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Processing failed", 0, true);
  } finally {
    state.isProcessing = false;
    setButtonsBusy(false);
  }
}

async function ensureModel() {
  if (state.model && state.processor) return;

  const wantsWebGpu = Boolean(navigator.gpu);
  const runtimeAttempts = wantsWebGpu
    ? [
        { device: "webgpu", dtype: "fp16" },
        { device: "wasm", dtype: "fp32" },
      ]
    : [{ device: "wasm", dtype: "fp32" }];
  const hostAttempts = getModelHostAttempts();

  let lastError;

  for (const modelHost of hostAttempts) {
    applyModelHost(modelHost);
    for (const attempt of runtimeAttempts) {
      try {
        state.device = attempt.device;
        updateRuntime(attempt.device, attempt.dtype);
        const loadOptions = {
          device: attempt.device,
          dtype: attempt.dtype,
          progress_callback: reportModelProgress,
        };
        const processorOptions = {};
        if (modelHost.key !== "local") {
          loadOptions.revision = MODEL_REVISION;
          processorOptions.revision = MODEL_REVISION;
        }
        const [model, processor] = await Promise.all([
          AutoModel.from_pretrained(MODEL_ID, loadOptions),
          AutoProcessor.from_pretrained(MODEL_ID, processorOptions),
        ]);
        state.model = model;
        state.processor = processor;
        return;
      } catch (error) {
        lastError = error;
        state.model = null;
        state.processor = null;
      }
    }
  }

  throw lastError || new Error("Model failed to load.");
}

function getModelHostAttempts() {
  const modelOverride = getModelOverride();
  if (modelOverride === "local") return [MODEL_HOSTS.local];
  if (modelOverride === "hub") return [MODEL_HOSTS.hub];
  if (modelOverride === "mirror") return [MODEL_HOSTS.local];

  const override = getMirrorOverride();
  if (override === "mirror") return [MODEL_HOSTS.local];
  if (override === "hub") return [MODEL_HOSTS.hub];

  if (isLikelyMainlandChinaUser()) return [MODEL_HOSTS.local, MODEL_HOSTS.hub];

  const remoteAttempts = [chooseRemoteModelHost()];
  return modelOverride === "remote" ? remoteAttempts : [MODEL_HOSTS.local, ...remoteAttempts];
}

function reportModelProgress(progress) {
  if (!progress) return;
  if (progress.status === "progress" && progress.total) {
    const ratio = Math.min(1, progress.loaded / progress.total);
    setStatus("Loading model", Math.round(8 + ratio * 48));
    return;
  }
  if (progress.status === "ready") {
    setStatus("Model ready", 60);
  }
}

function prepareCanvases(image) {
  const edgeLimit = getOutputEdgeLimit();
  const scale = Math.min(1, edgeLimit / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  state.originalCanvas = document.createElement("canvas");
  state.originalCanvas.width = width;
  state.originalCanvas.height = height;
  state.originalCanvas.getContext("2d").drawImage(image, 0, 0, width, height);

  state.outputCanvas = null;
}

function buildOutputFromMask() {
  const width = state.originalCanvas.width;
  const height = state.originalCanvas.height;
  const transparent = els.transparentToggle.checked;
  const adjustedMask = createAdjustedMask(state.rawMask);
  const maskCanvas = maskToCanvas(adjustedMask, 512, 512);
  const scaledMask = document.createElement("canvas");
  scaledMask.width = width;
  scaledMask.height = height;
  const scaledMaskCtx = scaledMask.getContext("2d", { willReadFrequently: true });
  scaledMaskCtx.imageSmoothingEnabled = true;
  scaledMaskCtx.imageSmoothingQuality = "high";
  scaledMaskCtx.drawImage(maskCanvas, 0, 0, width, height);

  const sourceImageData = state.originalCanvas
    .getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, width, height);
  const maskData = scaledMaskCtx.getImageData(0, 0, width, height).data;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const outCtx = out.getContext("2d", { willReadFrequently: true });
  const pixels = sourceImageData.data;

  if (!transparent) {
    const [r, g, b] = hexToRgb(els.backgroundColor.value);
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = maskData[i] / 255;
      pixels[i] = Math.round(pixels[i] * alpha + r * (1 - alpha));
      pixels[i + 1] = Math.round(pixels[i + 1] * alpha + g * (1 - alpha));
      pixels[i + 2] = Math.round(pixels[i + 2] * alpha + b * (1 - alpha));
      pixels[i + 3] = 255;
    }
  } else {
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i + 3] = maskData[i];
    }
  }

  outCtx.putImageData(sourceImageData, 0, 0);
  state.outputCanvas = out;
  drawPreview();
}

function createAdjustedMask(mask) {
  const cutoff = Number(els.cutoffRange.value) / 100;
  const softness = Number(els.softnessRange.value) / 100;
  const clean = Number(els.cleanRange.value) / 100;
  const low = Math.max(0, cutoff - softness * 0.5);
  const high = Math.min(1, cutoff + softness * 0.5);
  const range = Math.max(0.001, high - low);
  const adjusted = new Float32Array(mask.length);

  for (let i = 0; i < mask.length; i += 1) {
    let value = (mask[i] - low) / range;
    value = Math.max(0, Math.min(1, value));
    value = value * value * (3 - 2 * value);
    if (clean > 0) {
      const boost = 1 + clean * 0.85;
      value = Math.max(0, Math.min(1, (value - 0.5) * boost + 0.5));
    }
    adjusted[i] = value;
  }

  return adjusted;
}

function maskToCanvas(mask, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(width, height);
  const pixels = imageData.data;

  for (let i = 0; i < mask.length; i += 1) {
    const value = Math.round(mask[i] * 255);
    const offset = i * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function resizeStage() {
  const frame = els.canvasFrame;
  const rect = frame.getBoundingClientRect();
  const width = Math.max(360, Math.floor(rect.width));
  const height = Math.max(360, Math.floor(rect.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  els.canvas.width = Math.floor(width * dpr);
  els.canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPreview();
}

function drawPreview() {
  const width = els.canvas.width / Math.min(2, window.devicePixelRatio || 1);
  const height = els.canvas.height / Math.min(2, window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, width, height);

  const currentCanvas = state.outputCanvas || state.originalCanvas;
  if (!currentCanvas) return;

  const imageRect = containRect(currentCanvas.width, currentCanvas.height, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (state.compare && state.outputCanvas && state.originalCanvas) {
    ctx.drawImage(state.outputCanvas, imageRect.x, imageRect.y, imageRect.w, imageRect.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(imageRect.x, imageRect.y, imageRect.w * state.compareX, imageRect.h);
    ctx.clip();
    ctx.drawImage(state.originalCanvas, imageRect.x, imageRect.y, imageRect.w, imageRect.h);
    ctx.restore();
    els.compareHandle.classList.remove("hidden");
    els.compareHandle.style.left = `${imageRect.x + imageRect.w * state.compareX}px`;
  } else {
    ctx.drawImage(currentCanvas, imageRect.x, imageRect.y, imageRect.w, imageRect.h);
    els.compareHandle.classList.add("hidden");
  }
}

function startCompareDrag(event) {
  if (!state.outputCanvas || !state.originalCanvas) return;
  state.compare = true;
  els.compareButton.classList.add("active");
  els.canvas.setPointerCapture(event.pointerId);
  updateCompare(event);

  const move = (moveEvent) => updateCompare(moveEvent);
  const up = () => {
    els.canvas.removeEventListener("pointermove", move);
    els.canvas.removeEventListener("pointerup", up);
  };
  els.canvas.addEventListener("pointermove", move);
  els.canvas.addEventListener("pointerup", up, { once: true });
}

function updateCompare(event) {
  const rect = els.canvas.getBoundingClientRect();
  const width = els.canvas.width / Math.min(2, window.devicePixelRatio || 1);
  const height = els.canvas.height / Math.min(2, window.devicePixelRatio || 1);
  const currentCanvas = state.outputCanvas || state.originalCanvas;
  const imageRect = containRect(currentCanvas.width, currentCanvas.height, width, height);
  const pointerX = event.clientX - rect.left;
  state.compareX = Math.max(0, Math.min(1, (pointerX - imageRect.x) / imageRect.w));
  drawPreview();
}

function exportImage() {
  if (!state.outputCanvas) return;
  state.outputCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.fileName}-transparent.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function resetWorkspace() {
  if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
  state.sourceImage = null;
  state.sourceUrl = "";
  state.rawMask = null;
  state.outputCanvas = null;
  state.originalCanvas = null;
  state.compare = false;
  els.fileInput.value = "";
  els.emptyState.classList.remove("hidden");
  els.processButton.disabled = true;
  els.exportButton.disabled = true;
  els.resetButton.disabled = true;
  els.compareButton.disabled = true;
  els.applyAdjustmentsButton.disabled = true;
  setStatus("Waiting for an image", 0);
  drawPreview();
}

function setButtonsBusy(isBusy) {
  els.processButton.disabled = isBusy || !state.sourceImage;
  els.fileInput.disabled = isBusy;
  els.resetButton.disabled = isBusy || !state.sourceImage;
}

function setStatus(message, progress, isError = false) {
  els.statusText.textContent = message;
  els.statusDetail.textContent = `${Math.max(0, Math.min(100, Math.round(progress)))}%`;
  els.progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  els.runtimePill.textContent = isError ? "Check" : state.device === "webgpu" ? "WebGPU" : state.device === "wasm" ? "WASM" : "Ready";
  els.runtimePill.style.color = isError ? "var(--danger)" : "";
}

function updateRuntime(device, dtype) {
  els.runtimeDetail.textContent = `${device.toUpperCase()} ${dtype.toUpperCase()} · ${state.modelHostLabel}`;
  els.runtimePill.textContent = device === "webgpu" ? "WebGPU" : "WASM";
}

function setRangeOutputs() {
  els.cutoffValue.textContent = els.cutoffRange.value;
  els.softnessValue.textContent = els.softnessRange.value;
  els.cleanValue.textContent = els.cleanRange.value;
}

function getOutputEdgeLimit() {
  return Math.min(Number(els.maxEdgeSelect.value), MAX_CANVAS_EDGE);
}

function containRect(imageWidth, imageHeight, frameWidth, frameHeight) {
  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  const w = imageWidth * scale;
  const h = imageHeight * scale;
  return {
    x: (frameWidth - w) / 2,
    y: (frameHeight - h) / 2,
    w,
    h,
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = url;
  });
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      console.log("Service worker registered.");
    } catch (error) {
      console.warn("Service worker registration failed:", error);
    }
  });
}

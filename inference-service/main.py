"""
Paint Visualizer – AI Inference Service

FastAPI service providing:
  - /health       – health check + model status
  - /segment      – click-point → segmentation mask (SAM)
  - /segment/multi – multi-point → segmentation mask (SAM)
  - /inpaint      – image + mask → cleaned image (LaMa)

Models run locally on GPU. No external API calls.
"""

import base64
import io
import os
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Model globals (loaded at startup)
# ---------------------------------------------------------------------------
sam_predictor = None
lama_model = None
device = None
models_loaded = False
gpu_available = False


def load_models():
    global sam_predictor, lama_model, device, models_loaded, gpu_available

    gpu_available = torch.cuda.is_available()
    device = torch.device("cuda" if gpu_available else "cpu")
    print(f"[inference] Device: {device}")
    print(f"[inference] GPU available: {gpu_available}")

    try:
        from segment_anything import sam_model_registry, SamPredictor

        sam_checkpoint = os.environ.get("SAM_CHECKPOINT", "sam_vit_b_01ec64.pth")
        sam_model_type = os.environ.get("SAM_MODEL_TYPE", "vit_b")

        if not os.path.exists(sam_checkpoint):
            print(f"[inference] WARNING: SAM checkpoint not found at {sam_checkpoint}")
            print("[inference] SAM model will not be available until checkpoint is downloaded.")
            return

        sam = sam_model_registry[sam_model_type](checkpoint=sam_checkpoint)
        sam.to(device)
        sam_predictor = SamPredictor(sam)
        print("[inference] SAM model loaded successfully")
    except Exception as e:
        print(f"[inference] WARNING: Failed to load SAM: {e}")

    # LaMa / inpainting model loading
    try:
        from lama_wrapper import InpaintingModel

        lama_model = InpaintingModel(device=device)
        print(f"[inference] Inpainting method: {lama_model.method}")
    except Exception as e:
        print(f"[inference] WARNING: Failed to load inpainting model: {e}")

    models_loaded = sam_predictor is not None or lama_model is not None


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    yield


app = FastAPI(title="Paint Visualizer Inference Service", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def decode_image(data_url: str) -> np.ndarray:
    """Decode a data-URL or raw base64 string to a BGR numpy array."""
    if data_url.startswith("data:"):
        _, b64 = data_url.split(",", 1)
    else:
        b64 = data_url
    raw = base64.b64decode(b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def encode_image_b64(img: np.ndarray) -> str:
    """Encode a BGR numpy array to a base64 data-URL PNG."""
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def mask_to_rle(mask: np.ndarray) -> dict:
    """Run-length encode a binary mask for compact transmission."""
    pixels = mask.flatten()
    pixels = np.concatenate([[0], pixels, [0]])
    runs = np.where(pixels[1:] != pixels[:-1])[0] + 1
    runs[1::2] -= runs[::2]
    return {"counts": runs.tolist(), "size": list(mask.shape)}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class SegmentRequest(BaseModel):
    image: str  # data-URL or base64
    point: list[int]  # [x, y]


class SegmentMultiRequest(BaseModel):
    image: str
    points: list[list[int]]  # [[x,y], ...]


class InpaintRequest(BaseModel):
    image: str  # data-URL or base64
    mask: str   # data-URL or base64 (binary mask, white = remove)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "modelsLoaded": models_loaded,
        "gpuAvailable": gpu_available,
        "device": str(device),
    }


@app.post("/segment")
async def segment(req: SegmentRequest):
    if sam_predictor is None:
        raise HTTPException(status_code=503, detail="SAM model not loaded")

    try:
        image_bgr = decode_image(req.image)
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

        sam_predictor.set_image(image_rgb)

        point_coords = np.array([req.point])
        point_labels = np.array([1])  # 1 = foreground

        masks, scores, _ = sam_predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True,
        )

        # Pick the mask with highest score
        best_idx = np.argmax(scores)
        mask = masks[best_idx].astype(np.uint8) * 255

        mask_b64 = encode_image_b64(mask)
        return {"mask": mask_b64}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/segment/multi")
async def segment_multi(req: SegmentMultiRequest):
    if sam_predictor is None:
        raise HTTPException(status_code=503, detail="SAM model not loaded")

    try:
        image_bgr = decode_image(req.image)
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

        sam_predictor.set_image(image_rgb)

        point_coords = np.array(req.points)
        point_labels = np.ones(len(req.points), dtype=int)

        masks, scores, _ = sam_predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=False,
        )

        # Union of all returned masks
        combined = np.zeros_like(masks[0], dtype=np.uint8)
        for m in masks:
            combined = np.logical_or(combined, m)
        mask = combined.astype(np.uint8) * 255

        mask_b64 = encode_image_b64(mask)
        return {"mask": mask_b64}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/inpaint")
async def inpaint(req: InpaintRequest):
    try:
        image_bgr = decode_image(req.image)
        mask_raw = decode_image(req.mask)

        # Convert mask to binary (single channel)
        if len(mask_raw.shape) == 3:
            mask_gray = cv2.cvtColor(mask_raw, cv2.COLOR_BGR2GRAY)
        else:
            mask_gray = mask_raw
        _, mask_bin = cv2.threshold(mask_gray, 127, 255, cv2.THRESH_BINARY)

        h, w = image_bgr.shape[:2]
        mask_bin = cv2.resize(mask_bin, (w, h))

        if lama_model is not None:
            result_bgr = lama_model(image_bgr, mask_bin)
        else:
            # Fallback: OpenCV Telea inpainting (lower quality but functional)
            result_bgr = cv2.inpaint(image_bgr, mask_bin, inpaintRadius=7, flags=cv2.INPAINT_TELEA)

        result_b64 = encode_image_b64(result_bgr)
        return {"result": result_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

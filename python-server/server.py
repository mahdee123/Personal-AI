"""
Mahdee AI — Image Generation Sidecar
Runs LCM_Dreamshaper_v7 via HuggingFace diffusers.

Model: SimianLuo/LCM_Dreamshaper_v7 (0.9B params)
- 3x smaller than SDXL-Turbo (3B params)
- ~8-15 seconds per image on CPU (vs 20-60s for SDXL-Turbo)
- Uses Latent Consistency Model distillation for 1-4 step generation
- MIT license, no HuggingFace login required

Optimizations applied:
- Tiny AutoEncoder (madebyollin/taesd) for ~30% faster VAE decode
- torch.float32 on CPU (mandatory, CPU doesn't support float16)
- 4 inference steps (LCM sweet spot)
"""

import base64
import io
import os
import sys
import time

import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Mahdee AI Image Generation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_ID = "SimianLuo/LCM_Dreamshaper_v7"
NATIVE_RESOLUTION = 512

pipe = None
device = "cpu"


class GenerateRequest(BaseModel):
    prompt: str
    width: int = NATIVE_RESOLUTION
    height: int = NATIVE_RESOLUTION


class GenerateResponse(BaseModel):
    image: str


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    message: str


def load_model():
    global pipe, device
    if pipe is not None:
        return

    print("=" * 50)
    print("  Mahdee AI — Image Generation Server")
    print("=" * 50)
    print()
    print(f"Loading {MODEL_ID}...")
    print("First run will download ~2GB of model weights.")
    print()

    try:
        from diffusers import AutoPipelineForText2Image, AutoencoderTiny

        device = "cuda" if torch.cuda.is_available() else "cpu"

        # Load the main pipeline.
        pipe = AutoPipelineForText2Image.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float32,
        )

        # Swap in Tiny AutoEncoder for ~30% faster VAE decode.
        print("Loading Tiny AutoEncoder for faster decoding...")
        pipe.vae = AutoencoderTiny.from_pretrained(
            "madebyollin/taesd",
            torch_dtype=torch.float32,
        )

        if device == "cuda":
            print("CUDA GPU detected. Using GPU acceleration.")
            pipe.to("cuda")
        else:
            print("No CUDA GPU detected. Running on CPU.")
            print("Each image will take roughly 8-15 seconds to generate.")
            pipe.to("cpu")

        print(f"Model loaded successfully on {device.upper()}")
        print()

    except ImportError as e:
        print(f"ERROR: Missing dependency: {e}")
        print("Run: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Failed to load model: {e}")
        print()
        print("Possible fixes:")
        print("  1. Check your internet connection (model needs to download)")
        print("  2. Ensure you have enough disk space (~3GB free)")
        print("  3. Try: pip install --upgrade diffusers transformers")
        sys.exit(1)


@app.on_event("startup")
async def startup():
    load_model()


@app.get("/health", response_model=HealthResponse)
async def health():
    if pipe is None:
        return HealthResponse(
            status="loading",
            model=MODEL_ID,
            device="unknown",
            message="Model is still loading...",
        )

    msg = "Ready" if device == "cuda" else "Ready (CPU mode, ~8-15s per image)"
    return HealthResponse(
        status="ready",
        model=MODEL_ID,
        device=device,
        message=msg,
    )


def round_to_multiple_of_8(value: int) -> int:
    return max(8, round(value / 8) * 8)


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    if pipe is None:
        return GenerateResponse(image="")

    start_time = time.time()
    print(f"Generating image: \"{request.prompt[:60]}...\"")

    try:
        # LCM uses guidance_scale > 0 (unlike SDXL-Turbo which uses 0).
        # 4 inference steps is the sweet spot for LCM quality vs speed.
        image = pipe(
            prompt=request.prompt,
            width=round_to_multiple_of_8(min(request.width, 768)),
            height=round_to_multiple_of_8(min(request.height, 768)),
            num_inference_steps=4,
            guidance_scale=8.0,
        ).images[0]

        # Convert to JPEG for faster base64 encoding and smaller payload.
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=90)
        b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        elapsed = time.time() - start_time
        print(f"Image generated in {elapsed:.1f}s")
        return GenerateResponse(image=b64)

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"Generation failed after {elapsed:.1f}s: {e}")
        return GenerateResponse(image="")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print(f"Starting server on http://localhost:{port}")
    print()
    uvicorn.run(app, host="0.0.0.0", port=port)

"""
Mahdee AI — Image Generation Sidecar
Runs a local FLUX.1-schnell model via HuggingFace diffusers.
Start with: python server.py  (or use start.bat on Windows)

CPU mode: Works but is slow (~3-8 minutes per image).
GPU mode: Fast (~5-10 seconds per image).
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

pipe = None
device = "cpu"


class GenerateRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024


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
    print("Loading FLUX.1-schnell model...")
    print("First run will download ~24GB of model weights.")
    print("This may take several minutes depending on your connection.")
    print()

    try:
        from diffusers import FluxPipeline

        device = "cuda" if torch.cuda.is_available() else "cpu"

        if device == "cuda":
            print("CUDA GPU detected. Using GPU acceleration.")
            pipe = FluxPipeline.from_pretrained(
                "black-forest-labs/FLUX.1-schnell",
                torch_dtype=torch.float16,
            )
            pipe.to("cuda")
        else:
            print("No CUDA GPU detected. Running on CPU (slow mode).")
            print("Each image will take ~3-8 minutes to generate.")
            print()
            pipe = FluxPipeline.from_pretrained(
                "black-forest-labs/FLUX.1-schnell",
                torch_dtype=torch.float32,
            )
            pipe.enable_model_cpu_offload()

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
        print("  2. Ensure you have enough disk space (~24GB free)")
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
            model="FLUX.1-schnell",
            device="unknown",
            message="Model is still loading...",
        )

    msg = "Ready" if device == "cuda" else "Ready (CPU mode — slow)"
    return HealthResponse(
        status="ready",
        model="FLUX.1-schnell",
        device=device,
        message=msg,
    )


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    if pipe is None:
        return GenerateResponse(image="")

    start_time = time.time()
    print(f"Generating image: \"{request.prompt[:60]}...\"")

    try:
        # FLUX.1-schnell uses 4 inference steps for fast generation.
        # On CPU this is still slow but keeps output reasonable.
        image = pipe(
            request.prompt,
            width=min(request.width, 768),  # Cap resolution on CPU for speed
            height=min(request.height, 768),
            num_inference_steps=4,
        ).images[0]

        # Convert to base64 PNG.
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
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

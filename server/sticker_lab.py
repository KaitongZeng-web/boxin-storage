"""Standalone sticker workbench. Run with uvicorn sticker_lab:lab --app-dir server."""
import base64
import io
import os
import sys
from functools import lru_cache
from pathlib import Path
from threading import Lock

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps

from app import health, recognize

lab = FastAPI(title="Boxin收纳盒 · 贴纸工坊")
lab.get("/health")(health)
lab.post("/api/v1/recognize")(recognize)
inference_lock = Lock()


@lru_cache(maxsize=1)
def session():
    path = Path(os.getenv("STICKER_MODEL", Path(sys.prefix) / "models/u2netp.onnx"))
    if not path.is_file():
        raise HTTPException(503, "请按 README 下载 u2netp.onnx 后重试")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    return ort.InferenceSession(str(path), options, providers=["CPUExecutionProvider"])


def foreground(photo):
    pixels = np.asarray(photo.resize((320, 320), Image.Resampling.LANCZOS), dtype=np.float32)
    pixels /= max(float(pixels.max()), 1)
    pixels -= [0.485, 0.456, 0.406]
    pixels /= [0.229, 0.224, 0.225]
    with inference_lock:
        model = session()
        output = model.run([model.get_outputs()[0].name], {
            model.get_inputs()[0].name: pixels.transpose(2, 0, 1)[None]
        })[0].squeeze()
    mask = (output - output.min()) / max(float(np.ptp(output)), 1e-6)
    return Image.fromarray((mask * 255).astype("uint8")).resize(photo.size, Image.Resampling.BILINEAR)


def sticker(photo, mask, point=None):
    alpha = np.asarray(mask)
    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 16).astype("uint8"))
    if count < 2:
        raise HTTPException(422, "未找到主体，请换一张主体更清晰的照片")
    if point is None:
        target = 1 + stats[1:, cv2.CC_STAT_AREA].argmax()
    else:
        x, y = point
        target = labels[min(int(y * photo.height), photo.height - 1),
                        min(int(x * photo.width), photo.width - 1)]
        if target == 0:
            raise HTTPException(422, "这个位置没有检测到物品，请点在物品内部")
    photo = photo.convert("RGBA")
    photo.putalpha(Image.fromarray(np.where(labels == target, alpha, 0).astype("uint8")))
    photo = photo.crop(photo.getbbox())
    return decorate(photo)


def decorate(photo):
    border = max(1, max(photo.size) * 0.011)
    pad = int(np.ceil(border)) + 2
    layer = ImageOps.expand(photo, border=pad, fill=(0, 0, 0, 0))
    alpha = np.asarray(layer.getchannel("A"))
    outside = (alpha < 96).astype(np.uint8)
    distance = cv2.distanceTransform(outside, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    stroke = np.clip(border + 1 - distance, 0, 1)
    white = Image.new("RGBA", layer.size, "white")
    white.putalpha(Image.fromarray(np.rint(stroke * 255).astype(np.uint8)))
    white.alpha_composite(layer)
    return white


def read_foreground(image):
    content = image.file.read(10 * 1024**2 + 1)
    if len(content) > 10 * 1024**2:
        raise HTTPException(413, "图片不能超过 10 MB")
    try:
        with Image.open(io.BytesIO(content)) as original:
            if original.format not in ("JPEG", "PNG", "WEBP") or original.width * original.height > 25_000_000:
                raise ValueError()
            photo = ImageOps.exif_transpose(original).convert("RGBA")
    except (OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(415, "请选择有效的 JPG、PNG 或 WebP 图片（最多 2500 万像素）")
    photo.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
    alpha = photo.getchannel("A")
    mask = alpha if alpha.getextrema()[0] == 0 else foreground(photo.convert("RGB"))
    return photo, mask


@lab.post("/api/v1/cutout")
def cutout(image: UploadFile = File(...), x: float | None = Form(None, ge=0, le=1),
           y: float | None = Form(None, ge=0, le=1)):
    if (x is None) != (y is None):
        raise HTTPException(422, "请选择完整的坐标")
    photo, mask = read_foreground(image)
    result = sticker(photo, mask, None if x is None else (x, y))
    out = io.BytesIO()
    result.save(out, "PNG")
    return Response(out.getvalue(), media_type="image/png")


@lab.post("/api/v1/cutouts")
def cutouts(image: UploadFile = File(...)):
    photo, mask = read_foreground(image)
    alpha = np.asarray(mask)
    _, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 16).astype("uint8"))
    min_area = max(12, round(alpha.size * 0.0004))
    regions = [(y, x, w, h, index) for index, (x, y, w, h, area)
               in enumerate(stats[1:], 1) if area >= min_area]
    if not regions:
        raise HTTPException(422, "没有检测到清晰物品，请将物品分开放置并重新拍照")
    if len(regions) > 40:
        raise HTTPException(422, "画面中的区域过多，请分组拍照或使用简洁背景")
    items = []
    for y, x, w, h, index in sorted(regions):
        region = np.s_[y:y+h, x:x+w]
        crop = photo.crop((x, y, x+w, y+h))
        crop.putalpha(Image.fromarray(np.where(labels[region] == index, alpha[region], 0).astype("uint8")))
        out = io.BytesIO()
        decorate(crop).save(out, "PNG")
        items.append("data:image/png;base64," + base64.b64encode(out.getvalue()).decode("ascii"))
    return {"stickers": items}


lab.mount("/", StaticFiles(directory=Path(__file__).with_name("studio"), html=True))

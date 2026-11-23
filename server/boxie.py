"""Serve the built Boxin收纳盒 app and its local-only cutout API."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sticker_lab import cutout, cutouts

app = FastAPI(title="Boxin收纳盒")
app.add_middleware(CORSMiddleware, allow_origins=[
    f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (8081, 8082)
], allow_methods=["POST"], allow_headers=["*"])
app.post("/api/v1/cutout")(cutout)
app.post("/api/v1/cutouts")(cutouts)
dist = Path(__file__).resolve().parents[1] / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True))

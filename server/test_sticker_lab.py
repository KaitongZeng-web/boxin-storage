import base64
import io
import unittest
from unittest.mock import patch
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

try:
    from sticker_lab import lab
except ModuleNotFoundError as error:
    if error.name not in {"onnxruntime", "cv2", "numpy"}:
        raise
    lab = None


@unittest.skipIf(lab is None, "install server/requirements-studio.txt for workbench tests")
class StickerTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(lab)
        photo = Image.new("RGBA", (100, 80))
        draw = ImageDraw.Draw(photo)
        draw.rectangle((10, 10, 40, 60), fill="blue")
        draw.rectangle((70, 20, 85, 35), fill="red")
        out = io.BytesIO()
        photo.save(out, "PNG")
        self.files = {"image": ("objects.png", out.getvalue(), "image/png")}

    def test_selection_and_transparent_padding(self):
        for point, color in [({}, (0, 0, 255)), ({"x": 0.75, "y": 0.3}, (255, 0, 0))]:
            response = self.client.post("/api/v1/cutout", files=self.files, data=point)
            self.assertEqual(response.status_code, 200)
            image = Image.open(io.BytesIO(response.content))
            self.assertEqual(image.getpixel((image.width//2, image.height//2))[:3], color)
            self.assertEqual(image.getpixel((0, 0))[3], 0)

    def test_batch_returns_separate_transparent_stickers(self):
        response = self.client.post("/api/v1/cutouts", files=self.files)
        self.assertEqual(response.status_code, 200)
        stickers = response.json()["stickers"]
        self.assertEqual(len(stickers), 2)
        for uri, expected in zip(stickers, [(0, 0, 255), (255, 0, 0)]):
            prefix, encoded = uri.split(",")
            self.assertEqual(prefix, "data:image/png;base64")
            image = Image.open(io.BytesIO(base64.b64decode(encoded)))
            self.assertEqual(image.getpixel((0, 0))[3], 0)
            self.assertEqual(image.getpixel((image.width//2, image.height//2))[:3], expected)

    def test_outline_preserves_large_object_and_outer_margin(self):
        original = Image.new("RGBA", (960, 180), (55, 30, 90, 255))
        ImageDraw.Draw(original).rectangle((400, 50, 530, 130), fill=(0, 0, 0, 0))
        encoded = io.BytesIO()
        original.save(encoded, "PNG")
        response = self.client.post("/api/v1/cutout", files={
            "image": ("ring.png", encoded.getvalue(), "image/png")
        })
        self.assertEqual(response.status_code, 200)
        sticker = Image.open(io.BytesIO(response.content))
        padding = (sticker.width - original.width) // 2
        self.assertGreater(padding, 0)
        self.assertEqual(sticker.getpixel((0, 90))[3], 0)
        self.assertEqual(sticker.getpixel((padding - 2, 90)), (255, 255, 255, 255))
        self.assertEqual(sticker.getpixel((padding, 90)), (55, 30, 90, 255))
        self.assertEqual(sticker.getpixel((padding + 460, padding + 90))[3], 0)

    def test_batch_rejects_empty_foreground(self):
        out = io.BytesIO()
        Image.new("RGBA", (80, 80)).save(out, "PNG")
        response = self.client.post("/api/v1/cutouts", files={"image": ("empty.png", out.getvalue())})
        self.assertEqual(response.status_code, 422)

    def test_invalid_input(self):
        for point in [{"x": 0}, {"x": 0, "y": 0}, {"x": 2, "y": 0}]:
            self.assertEqual(self.client.post("/api/v1/cutout", files=self.files, data=point).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/cutout", files={"image": ("bad", b"bad")}).status_code, 415)

    def test_workbench_assets(self):
        for path in ["/", "/studio.css", "/studio.js", "/coffee.png"]:
            self.assertEqual(self.client.get(path).status_code, 200)

    @patch("sticker_lab.foreground", return_value=Image.new("L", (600, 400)))
    def test_empty_detection(self, infer):
        sample = self.client.get("/coffee.png").content
        response = self.client.post("/api/v1/cutout", files={"image": ("coffee.png", sample)})
        self.assertEqual(response.status_code, 422)
        infer.assert_called_once()

import io
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image
from app import app

class ServiceTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health(self):
        self.assertEqual(self.client.get('/health').status_code, 200)

    @patch.dict('os.environ', {'AI_PROVIDER': 'mock'})
    def test_mock(self):
        photo = io.BytesIO()
        Image.new('RGB', (10, 10)).save(photo, format='JPEG')
        response = self.client.post('/api/v1/recognize', files={'image': ('photo.jpg', photo.getvalue(), 'image/jpeg')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['mode'], 'mock')
        self.assertEqual(len(response.json()['items']), 6)

    def test_invalid_photo(self):
        self.assertEqual(self.client.post('/api/v1/recognize', files={'image': ('fake.jpg', b'not an image', 'image/jpeg')}).status_code, 415)

    def test_missing_photo(self):
        self.assertEqual(self.client.post('/api/v1/recognize').status_code, 422)

if __name__ == '__main__':
    unittest.main()

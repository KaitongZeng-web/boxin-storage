"""Replaceable vision service. Never persists uploaded photos or credentials."""
import base64
import io
import json
import os
import uuid

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

app = FastAPI(title='Boxin收纳盒 Recognition')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:8081', 'http://localhost:8082'], allow_methods=['POST', 'GET'], allow_headers=['*'])

class DetectedItem(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = '其他'
    confidence: float = Field(default=0.5, ge=0, le=1)

class Detection(BaseModel):
    items: list[DetectedItem] = Field(max_length=100)

def mock_result():
    return Detection(items=[DetectedItem(name=n, category='日常物品', confidence=0.9) for n in ['数据线', '充电头', 'U 盘', 'SD 卡', '电池', '剪刀']])

@app.get('/health')
def health():
    return {'status': 'ok', 'mode': 'mock' if not os.getenv('AI_API_KEY') or os.getenv('AI_PROVIDER', 'mock') == 'mock' else 'vision'}

@app.post('/api/v1/recognize')
async def recognize(image: UploadFile = File(...)):
    content = await image.read(10 * 1024 * 1024 + 1)
    await image.close()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, '图片不能超过 10MB')
    try:
        picture = Image.open(io.BytesIO(content))
        if picture.format not in ['JPEG', 'PNG', 'WEBP'] or picture.width * picture.height > 25_000_000:
            raise ValueError('Unsupported image')
        picture.verify()
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
        raise HTTPException(415, '请使用有效的 JPEG、PNG 或 WebP 照片')
    mode = health()['mode']
    if mode == 'mock':
        result = mock_result()
    else:
        if not os.getenv('AI_MODEL'):
            raise HTTPException(503, '请在服务端配置 AI_MODEL')
        mime = Image.MIME[picture.format]
        prompt = '识别图片中清楚可见的独立物品，不猜测品牌、型号、价格。不确定时名称为待确认物品、置信度降低。只返回 JSON: {"items":[{"name":"物品中文名","category":"分类","confidence":0.8}]}。不要输出边界框。'
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                response = await client.post(os.getenv('AI_BASE_URL', 'https://api.openai.com/v1').rstrip('/') + '/chat/completions', headers={'Authorization': 'Bearer ' + os.environ['AI_API_KEY']}, json={'model': os.environ['AI_MODEL'], 'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': prompt}, {'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,' + base64.b64encode(content).decode()}}]}], 'response_format': {'type': 'json_object'}})
                response.raise_for_status()
                result = Detection.model_validate(json.loads(response.json()['choices'][0]['message']['content']))
        except httpx.TimeoutException:
            raise HTTPException(504, '识别超时，请重试')
        except Exception:
            raise HTTPException(502, '识别服务返回异常，请重试或使用手动录入')
    return {'success': True, 'mode': mode, 'items': [i.model_dump() for i in result.items], 'warnings': ['演示数据，并非真实识别'] if mode == 'mock' else [], 'request_id': str(uuid.uuid4())}

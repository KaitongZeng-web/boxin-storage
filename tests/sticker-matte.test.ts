import { test } from 'node:test';
import assert from 'node:assert/strict';
import {outlineSticker} from '../src/stickerBorder.ts';
import {applyStickerMatte} from '../src/stickerMatte.ts';

test('细化对齐原图斜边和内孔，保留纹理与原始透明度',()=>{
  const size=24, width=192, height=144;
  const inside=(x:number,y:number)=>x>.16+y*.24 && Math.hypot(x-.65,y-.55)>.14;
  const mask=new Uint8Array(size*size), guide=new Uint8ClampedArray(size*size*4);
  for(let i=0;i<mask.length;i++){
    const on=inside((i%size+.5)/size,(Math.floor(i/size)+.5)/size);
    mask[i]=on?255:0;
    guide.fill(on?180:25,i*4,i*4+3);
  }
  const rgba=new Uint8ClampedArray(width*height*4);
  let coarseError=0;
  for(let i=0;i<width*height;i++){
    const x=(i%width+.5)/width,y=(Math.floor(i/width)+.5)/height;
    const on=inside(x,y);
    rgba.fill((on?180:25)+(i%5),i*4,i*4+3);
    rgba[i*4+3]=i%19===0?128:255;
    coarseError+=Math.abs(mask[Math.floor(y*size)*size+Math.floor(x*size)]/255-Number(on));
  }
  const before=rgba.slice();
  applyStickerMatte(rgba,width,height,guide,mask,size,0,0,size,size);
  let refinedError=0;
  for(let i=0;i<width*height;i++){
    assert.equal(rgba[i*4],before[i*4]);
    assert.ok(rgba[i*4+3]<=before[i*4+3]);
    refinedError+=Math.abs(rgba[i*4+3]/before[i*4+3]-Number(inside((i%width+.5)/width,(Math.floor(i/width)+.5)/height)));
  }
  assert.ok(refinedError<coarseError*.35, `refined ${refinedError}, coarse ${coarseError}`);
});

test('白色描边写入透明像素，贴边物件、内部孔洞和原色都可保留',()=>{
  const width=300, height=50;
  const source=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(x>=100&&x<150&&y>=10&&y<40)continue;
    source.set([60,24,96,255],(width*y+x)*4);
  }
  const sticker=outlineSticker(source,width,height);
  const pad=(sticker.width-width)/2;
  const pixel=(x:number,y:number)=>Array.from(sticker.rgba.slice((sticker.width*y+x)*4,(sticker.width*y+x)*4+4));
  assert.equal(pixel(0,pad+20)[3],0);
  assert.deepEqual(pixel(pad-2,pad+20),[255,255,255,255]);
  assert.deepEqual(pixel(pad,pad+20),[60,24,96,255]);
  assert.deepEqual(pixel(pad+101,pad+25),[255,255,255,255]);
  assert.equal(pixel(pad+128,pad+25)[3],0);
  assert.ok(pixel(pad-4,pad+20)[3]>0 && pixel(pad-4,pad+20)[3]<255);
});

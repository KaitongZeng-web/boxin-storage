import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identifyPhoto} from '../src/onlineVision.ts';
import jpeg from 'jpeg-js';
import {refineOutline} from '../src/refineOutline.ts';

test('照片直达指定视觉服务，使用本次输入的密钥', async () => {
  const photo=jpeg.encode({width:40,height:40,data:Buffer.alloc(40*40*4,255)}).data.toString('base64');
  const result = await identifyPhoto(photo,' demo ',async (url, options) => {
    assert.equal(url,'https://api.deepseek.com/chat/completions');
    assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer demo');
    assert.ok(String(options?.body).includes('data:image/jpeg;base64,'+photo));
    return Response.json({id:"example-response",model:"example-model",usage:{total_tokens:123},choices:[{message:{content:JSON.stringify({items:[{name:'剪刀',rings:[[[1,2],[30,2],[10,30]]]}]})}}]});
  });
  assert.match(result.receipt,/example-model · 123 tokens · 响应 ID example-response/);
  assert.equal(result.items[0].name,'剪刀');
  assert.equal(result.items[0].outline?.rings.length,1);
  await assert.rejects(identifyPhoto('abc','demo',async()=>new Response(null,{status:401})),/401/);
});

test('透过原图颜色边界修正外缘，同时保留内孔',()=>{
  const pixels=Buffer.alloc(100*100*4);
  for(let y=20;y<80;y++)for(let x=20;x<80;x++){
    if(x>=40&&x<60&&y>=40&&y<60)continue;
    pixels.fill(255,4*(100*y+x),4*(100*y+x)+4);
  }
  const outline={aspect:1,rings:[[[230,230],[770,230],[770,770],[230,770]],[[410,410],[590,410],[590,590],[410,590]]]};
  const [outer,hole]=refineOutline(outline,{width:100,height:100,data:pixels}).rings;
  assert.ok(outer.some(([x,y])=>x>400&&x<600&&y>=180&&y<=210));
  assert.ok(hole.some(([x,y])=>x>460&&x<540&&y>=380&&y<=405));
});

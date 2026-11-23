/* Run against a built app with Playwright and Microsoft Edge installed. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({channel:'msedge',args:['--no-proxy-server']});
  try {
    const page = await browser.newPage();
    await page.goto(process.env.BOXIN_URL || 'http://127.0.0.1:8018');
    await page.getByLabel('Boxin收纳盒',{exact:true}).waitFor();
    assert.equal(await page.title(),'Boxin收纳盒');
    await page.getByText('创建收纳箱',{exact:true}).waitFor();
    assert.equal(await page.getByText(/演示空间/).count(),0);
    await page.getByText('创建收纳箱',{exact:true}).click();
    await page.getByLabel('箱子名称 *',{exact:true}).fill('布局测试箱');
    await page.getByText('保存并添加物品',{exact:true}).click();
    await page.getByText('添加小物',{exact:true}).waitFor();
    await page.getByText('贴纸工坊（拍照 / 相册抠图）',{exact:true}).click();
    await page.getByText('拍照',{exact:true}).waitFor();
    await page.getByText('从相册选择',{exact:true}).waitFor();
    await page.getByText('‹ 返回',{exact:true}).click();
    await page.getByText('＋ 添加',{exact:true}).click();
    await page.getByText('手动添加',{exact:true}).click();
    await page.getByLabel('物品名称 *',{exact:true}).fill('手动添加测试');
    await page.getByText('保存物品',{exact:true}).click();
    await page.getByText('布局测试箱',{exact:true}).waitFor();
    await page.getByText('手动添加测试',{exact:true}).waitFor();
    for (const width of [320, 390, 900]) {
      await page.setViewportSize({width, height:844});
      const shift = Math.min(86,16+Math.max(0,(Math.min(width,620)-76-370)/2))-26;
      await page.waitForFunction(expected => {
        const el=document.querySelector('[data-testid="detail-box-note"]');
        return new DOMMatrix(getComputedStyle(el).transform).m41===expected;
      },shift);
      const box = await page.getByTestId('detail-box-art').boundingBox();
      const note = await page.getByTestId('detail-box-note').boundingBox();
      const scene = await page.getByTestId('detail-box-note').locator('..').boundingBox();
      assert.ok(Math.abs(note.x + note.width - (scene.x + scene.width + shift)) < 1);
      const center = box.x + box.width/2;
      assert.ok(center < width/2 && center >= width/2-57);
      assert.ok(note.x + note.width/2 > center && note.x < box.x + box.width + 48);
      assert.ok(note.y > box.y + box.height/2 && note.y < box.y + box.height);
      assert.ok(note.y + note.height > box.y + box.height && note.x + note.width <= width);
    }
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.context().setOffline(true);
    await page.getByText('＋ 添加',{exact:true}).click();
    await page.getByText('贴纸工坊（拍照 / 相册抠图）',{exact:true}).click();
    await page.getByText('试试示例：咖啡杯',{exact:true}).click();
    await page.getByText('正在载入模型并提取物品轮廓…',{exact:true}).waitFor();
    await page.getByText('原始照片',{exact:true}).waitFor({timeout:90000});
    await page.getByText('一键切出全部',{exact:true}).click();
    const firstName=page.getByLabel('贴纸 1 名称',{exact:true});
    await firstName.waitFor();
    assert.equal(await firstName.inputValue(),'物品 1');
    await firstName.fill('批量测试贴纸');
    await page.getByLabel('选择目标箱子').click();
    await page.getByRole('button',{name:'布局测试箱',exact:true}).click();
    await page.getByLabel('保存贴纸 1',{exact:true}).click();
    await page.getByText('1 张已存入',{exact:true}).waitFor();
    const remove=page.getByLabel(/^移除贴纸 /);
    while(await remove.count())await remove.first().click();
    await page.getByText('完成',{exact:true}).click();
    await page.getByText('批量测试贴纸',{exact:true}).waitFor();
    await page.getByText('＋ 添加',{exact:true}).click();
    await page.getByText('贴纸工坊（拍照 / 相册抠图）',{exact:true}).click();
    await page.getByText('试试示例：咖啡杯',{exact:true}).click();
    await page.getByText('一键切出全部',{exact:true}).click();
    await firstName.fill('整批入箱测试');
    await page.getByRole('button',{name:/^存入箱子（/}).click();
    await page.getByText('整批入箱测试',{exact:true}).waitFor();
    await page.getByText('＋ 添加',{exact:true}).click();
    await page.getByText('贴纸工坊（拍照 / 相册抠图）',{exact:true}).click();
    await page.getByText('试试示例：咖啡杯',{exact:true}).click();
    await page.getByLabel('贴纸预览').waitFor({timeout:90000});
    await page.getByText('生成贴纸',{exact:true}).click();
    await page.getByText('生成贴纸',{exact:true}).waitFor({state:'hidden',timeout:90000});
    await page.getByLabel('物品名称 *',{exact:true}).fill('杯子贴纸');
    await page.getByText('保存物品',{exact:true}).click();
    await page.getByText('杯子贴纸',{exact:true}).waitFor();
    // Inspect the actual persisted PNG from both single and batch paths.
    const outlined=await page.evaluate(async()=>{
      const items=JSON.parse(localStorage.getItem('boxie-v1')).items;
      return Promise.all(['杯子贴纸','批量测试贴纸'].map(async name=>{
        const img=new Image();
        img.src=items.find(item=>item.name===name).image;
        await img.decode();
        const canvas=document.createElement('canvas');
        canvas.width=img.width;canvas.height=img.height;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        const pixels=ctx.getImageData(0,0,img.width,img.height).data;
        // Find the opaque outside edge per scanline, independent of subject colour.
        let rows=0,white=0;
        for(let y=0;y<img.height;y++){
          for(let x=0;x<img.width;x++){
            const i=(y*img.width+x)*4;
            if(pixels[i+3]<230)continue;
            rows++;
            if(pixels[i]===255&&pixels[i+1]===255&&pixels[i+2]===255)white++;
            break;
          }
        }
        return rows>5 && white>rows*.8 && pixels[3]===0;
      }));
    });
    assert.deepEqual(outlined,[true,true]);
    await page.getByText('编辑',{exact:true}).click();
    const ink=page.getByLabel('便利签备注');
    await ink.fill('雨天记得带伞');
    assert.deepEqual(await ink.evaluate(el=>[getComputedStyle(el).textAlign,getComputedStyle(el).fontWeight]),['center','300']);
    assert.equal(await ink.evaluate(el=>getComputedStyle(el).color),'rgb(32, 26, 22)');
    assert.ok(await ink.evaluate(el=>getComputedStyle(el).fontFamily.includes('STXingkai')));
    await ink.scrollIntoViewIfNeeded();
    assert.ok(await ink.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return document.elementFromPoint(r.left+8,r.top+16)===el && Number(getComputedStyle(el).zIndex)>0;
    }));
    await page.getByText('保存收纳箱',{exact:true}).click();
    const savedNote=page.getByText('雨天记得带伞',{exact:true});
    await savedNote.waitFor();
    assert.equal(await savedNote.evaluate(el=>getComputedStyle(el).textAlign),'center');
    await page.getByRole('tab',{name:'我的'}).click();
    await page.getByText('工坊记录',{exact:true}).click();
    await page.getByText('导出备份',{exact:true}).waitFor();
    assert.equal(await page.getByRole('tab',{selected:true}).getAttribute('aria-label'),'我的');
    assert.equal(await page.getByText('更多设置',{exact:true}).count(),0);
    await page.getByText('恢复示例箱子',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'搜索'}).click();
    await page.getByText('围巾',{exact:true}).click();
    assert.equal(await page.getByRole('textbox').inputValue(),'围巾');
    assert.equal(await page.getByText(/演示空间/).count(),0);
    console.log('Box and note placement passed at 320, 390 and 900px.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

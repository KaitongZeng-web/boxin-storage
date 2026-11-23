import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boxTags,demoData,saveBox,saveItem,search} from '../src/model.ts';
import {encodeBackup,decodeBackup} from '../src/backup.ts';

test('四类箱子标签可恢复，旧箱子无需补填',()=>{
  const data=demoData();
  assert.equal(boxTags.length,4);
  for(const tag of boxTags){
    const changed=saveBox(data,{...data.boxes[0],tag});
    const restored=decodeBackup(encodeBackup(changed));
    assert.equal(restored.boxes.find(b=>b.id===data.boxes[0].id)?.tag,tag);
    assert.equal(restored.boxes[0].tag,undefined);
  }
});

test('单件物品更新照片和轮廓后可恢复，其余物品不受影响',()=>{
  const data=demoData();
  const outline={aspect:1,rings:[[[0,0],[200,0],[100,200]]]};
  const item={...data.items[0],image:'data:image/jpeg;base64,YQ==',outline};
  const restored=decodeBackup(encodeBackup(saveItem(data,item)));
  assert.deepEqual(restored.items.find(i=>i.id===item.id)?.outline,outline);
  assert.equal(restored.items.find(i=>i.id===data.items[1].id)?.image,undefined);
});

test('手动命名的透明贴纸可入箱、备份和恢复',()=>{
  const data=demoData();
  const sticker={...data.items[0],name:'我的杯子',isSticker:true,image:'data:image/png;base64,iVBORw=='};
  const saved=saveItem(data,sticker);
  const restored=decodeBackup(encodeBackup(saved));
  const item=restored.items.find(i=>i.id===sticker.id);
  assert.equal(item?.name,sticker.name);
  assert.equal(item?.image,sticker.image);
  assert.equal(item?.isSticker,true);
  assert.equal(restored.items.find(i=>i.id===data.items[1].id)?.isSticker,undefined);
});

test('便利签换行和编辑内容在备份恢复后保留，搜索匹配更新后的提醒',()=>{
  const data=demoData();
  const note='出门清单\n记得带上耳机';
  const changed=saveBox(data,{...data.boxes[0],note});
  const restored=decodeBackup(encodeBackup(changed));
  assert.equal(restored.boxes.find(b=>b.id===data.boxes[0].id)?.note,note);
  assert.equal(search(restored,'带上耳机').boxes[0].id,data.boxes[0].id);
});

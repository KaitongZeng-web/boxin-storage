import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,saveBox,saveItem,deleteBox,deleteItem,confirmSession,search,mockDrafts,demoData} from '../src/model.ts';
test('创建编辑校验和序列化持久化',()=>{let d=demoData();assert.throws(()=>saveBox(d,{...d.boxes[0],name:' '}));d=saveBox(d,{...d.boxes[0],name:'新的箱子'});assert.equal(d.boxes.length,4);assert.deepEqual(JSON.parse(JSON.stringify(d)),d)});
test('确认前不添加物品，确认只保存选中项且禁止重复提交',()=>{let d=demoData();const count=d.items.length;const session={id:'session',boxId:d.boxes[1].id,status:'pending' as const,items:mockDrafts().map((i,n)=>({...i,selected:n===0}))};assert.equal(d.items.length,count);d=confirmSession(d,session);assert.equal(d.items.length,count+1);assert.equal(d.sessions[0].status,'confirmed');assert.throws(()=>confirmSession(d,session));assert.throws(()=>confirmSession(d,{...session,id:'another',items:[]}));});
test('移动物品更新两个箱子，搜索显示新位置',()=>{let d=demoData();const item=d.items[0],target=d.boxes[1];d.boxes.forEach(b=>b.updatedAt='2000-01-01');d=saveItem(d,{...item,boxId:target.id});assert.equal(search(d,'usb-c').items[0].boxId,target.id);assert.notEqual(d.boxes[0].updatedAt,'2000-01-01');assert.notEqual(d.boxes[1].updatedAt,'2000-01-01');assert.equal(search(d,'书房').boxes.length,1);assert.throws(()=>saveItem(d,{...item,boxId:'missing'}));});
test('删除箱子清除关联项，删除物品保留其余内容',()=>{let d=demoData();d=deleteItem(d,d.items[0]);assert.equal(d.items.length,5);d=deleteBox(d,d.boxes[0].id);assert.equal(d.items.length,0);assert.equal(d.boxes.length,3);assert.deepEqual(search(emptyData(),'卡'),{boxes:[],items:[]})});
test('中文、大小写、备注搜索和空查询',()=>{const d=demoData();assert.equal(search(d,'SD 卡').items.length,1);assert.equal(search(d,'USB').items.length,1);assert.equal(search(d,'存储').boxes.length,1);assert.deepEqual(search(d,' '),{boxes:[],items:[]})});

test('便利贴和位置返回对应的箱子，物品名跨箱匹配',()=>{
  const data=demoData();
  const [left,right]=data.boxes;
  left.note='出门要带这个';
  left.location='客厅左柜子';
  right.location='客厅右柜子';
  data.boxes=data.boxes.slice(0,2);
  assert.deepEqual(search(data,'出门要带这个'),{boxes:[left],items:[]});
  assert.deepEqual(search(data,'客厅'),{boxes:[left,right],items:[]});
  data.items[0].name='无线耳机';
  data.items[1].name='有线耳机';
  data.items[1].boxId=right.id;
  assert.deepEqual(search(data,' 耳机 '),{boxes:[],items:data.items.slice(0,2)});
  left.note='耳机配件';
  assert.deepEqual(search(data,'耳机'),{boxes:[left],items:data.items.slice(0,2)});
});

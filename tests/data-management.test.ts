import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoData,emptyData,saveDraft,confirmSession,deleteBox,deleteItem,unusedImages,validateEndpoint,type Session} from '../src/model.ts';
import {encodeBackup,decodeBackup,mergeBackup,validateData} from '../src/backup.ts';
import {isManagedPhoto} from '../src/photoPolicy.ts';
const photo='data:image/png;base64,aGVsbG8=';
test('照片清理限制到应用生成文件，拒绝路径穿越、相册和非照片文件',()=>{
 const root='file:///app/documents/';
 assert.equal(isManagedPhoto(root+'boxie-photos/abc-123.jpg',root),true);
 assert.equal(isManagedPhoto(root+'abc-123.jpg',root),true);
 for(const uri of [root+'boxie-photos/../secret.jpg',root+'boxie-photos/%2e%2e/secret.jpg',root+'database.db','file:///gallery/abc-123.jpg',root+'other.jpg',root])assert.equal(isManagedPhoto(uri,root),false);
 assert.equal(isManagedPhoto('file:///abc-123.jpg',null),false);
});
test('完整备份保留图片和草稿但不导出服务地址',()=>{
 const d=demoData();d.items[0].image=photo;d.settings={endpoint:'https://private.example'};
 const session:Session={id:'draft',boxId:d.boxes[0].id,status:'pending',items:[{id:'candidate',name:'',category:'其他',selected:false}],image:photo,mode:'mock'};
 const decoded=decodeBackup(encodeBackup(saveDraft(d,session)));
 assert.equal(decoded.items[0].image,photo);assert.equal(decoded.sessions[0].mode,'mock');assert.equal(decoded.settings,undefined);assert.equal(decoded.sessions[0].items[0].name,'');
});
test('导入合并重新分配标识，保留原有记录和设置，引用指向导入箱子',()=>{
 const d=demoData();d.settings={endpoint:'https://example.com'};
 const imported=decodeBackup(encodeBackup(d)),result=mergeBackup(d,imported);
 assert.equal(result.boxes.length,8);assert.equal(result.items.length,12);assert.equal(result.settings?.endpoint,d.settings.endpoint);
 assert.equal(new Set(result.boxes.map(b=>b.id)).size,8);assert.equal(result.items[6].boxId,result.boxes[4].id);assert.deepEqual(d.boxes,result.boxes.slice(0,4));
});
test('拒绝损坏格式、未来版本、重复 ID 和悬空引用',()=>{
 assert.throws(()=>decodeBackup('not json'));
 const d=demoData();const envelope={format:'boxie-backup',version:2,data:d};assert.throws(()=>decodeBackup(JSON.stringify(envelope)));
 assert.throws(()=>validateData({...d,boxes:[d.boxes[0],d.boxes[0]]}));
 assert.throws(()=>validateData({...d,items:[{...d.items[0],boxId:'missing'}]}));
 assert.throws(()=>validateData({...d,items:[{...d.items[0],confidence:4}]}));
});
test('导入拒绝设备路径和远程照片，防止备份引用外部资源',()=>{
 for(const image of ['file:///private/photo.jpg','https://example.com/tracking.png','data:image/svg+xml;base64,abc']){
 const d=demoData();d.items[0].image=image;assert.throws(()=>decodeBackup(JSON.stringify({format:'boxie-backup',version:1,data:d})));
 }
});
test('旧数据迁移保留记录，不伪造识别来源',()=>{
 const d=demoData();const result=validateData(JSON.parse(JSON.stringify(d)));assert.equal(result.boxes.length,4);assert.equal(result.settings,undefined);
});
test('保存草稿可恢复编辑和勾选，正式物品数不变，确认后不能再次转为草稿',()=>{
 let d=demoData();const draft:Session={id:'draft',boxId:d.boxes[1].id,status:'pending',mode:'vision',items:[{id:'one',name:'已修改名称',category:'办公',selected:true}]};
 d=saveDraft(d,draft);d=validateData(JSON.parse(JSON.stringify(d)));assert.equal(d.items.length,6);assert.equal(d.sessions[0].items[0].name,'已修改名称');assert.equal(d.sessions[0].mode,'vision');
 d=confirmSession(d,d.sessions[0]);assert.equal(d.items.length,7);assert.throws(()=>saveDraft(d,draft));
});
test('照片只在最后一个引用消失后清理，包含跨箱物品与识别记录',()=>{
 let d=demoData();d.items[0].image=photo;d.items[1].image=photo;d.items[1].boxId=d.boxes[1].id;
 d.sessions=[{id:'history',boxId:d.boxes[0].id,status:'confirmed',image:photo,items:[]}];
 let next=deleteItem(d,d.items[0]);assert.deepEqual(unusedImages(d,next),[]);
 next=deleteBox(next,d.boxes[0].id);assert.deepEqual(unusedImages(d,next),[]);
 const last=deleteItem(next,next.items[0]);assert.deepEqual(unusedImages(next,last),[photo]);
});
test('删除箱子保留设置；识别地址拒绝凭据和查询参数',()=>{
 const d=demoData();d.settings={endpoint:'https://example.com'};assert.deepEqual(deleteBox(d,d.boxes[0].id).settings,d.settings);
 assert.equal(validateEndpoint(' http://192.168.1.2:8000/ '),'http://192.168.1.2:8000');assert.equal(validateEndpoint(''),'');
 for(const url of ['javascript:alert(1)','https://user:secret@example.com','https://example.com?key=secret','bad'])assert.throws(()=>validateEndpoint(url));
 assert.deepEqual(decodeBackup(encodeBackup(emptyData())),emptyData());
});

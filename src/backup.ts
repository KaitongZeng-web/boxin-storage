import { boxTags, id, type Data, type Box, type Item, type Session, type Draft } from './model.ts';
import {validOutline} from './outline.ts';
export const MAX_BACKUP_BYTES=40*1024*1024;
type RecordValue=Record<string,unknown>;
function record(v:unknown):RecordValue {if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('备份格式不正确');return v as RecordValue}
function text(v:unknown,max=2000):string{if(typeof v!=='string'||v.length>max)throw new Error('备份字段不正确或过长');return v}
function key(v:unknown):string{const s=text(v,120);if(!s.trim())throw new Error('记录标识不能为空');return s}
function array(v:unknown,max=10000):unknown[]{if(!Array.isArray(v)||v.length>max)throw new Error('备份记录数量不正确');return v}
function image(v:unknown,portable:boolean):string|undefined{if(v===undefined)return;const s=text(v,MAX_BACKUP_BYTES);if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s)&&(portable||!s.startsWith('file://')))throw new Error('备份含无效图片，请使用包含照片的完整备份');return s}
function confidence(v:unknown):number|undefined{if(v===undefined)return;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)throw new Error('识别置信度不正确');return v}
function unique(rows:{id:string}[]){if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('备份含重复记录标识')}
export function validateData(value:unknown,portable=false):Data {
 const raw=record(value);
 const boxes:Box[]=array(raw.boxes,2000).map(v=>{const b=record(v);const name=key(b.name),color=text(b.color,7),updatedAt=text(b.updatedAt,40);if(!/^#[a-f0-9]{6}$/i.test(color)||!Number.isFinite(Date.parse(updatedAt)))throw new Error('箱子颜色或日期无效');const tag=boxTags.find(tag=>tag===b.tag);return {...(tag?{tag}:{}),id:key(b.id),name,color,updatedAt,note:text(b.note),location:text(b.location)}});
 const ids=new Set(boxes.map(b=>b.id));
 const boxId=(v:unknown)=>{const k=key(v);if(!ids.has(k))throw new Error('备份有物品或识别记录指向不存在的箱子');return k};
 const items:Item[]=array(raw.items).map(v=>{const i=record(v);return {id:key(i.id),boxId:boxId(i.boxId),name:key(i.name),category:text(i.category,120),image:image(i.image,portable),...(i.isSticker===true?{isSticker:true}:{}),...(validOutline(i.outline)?{outline:i.outline}:{}),confidence:confidence(i.confidence)}});
 const sessions:Session[]=array(raw.sessions).map(v=>{const s=record(v);if(!['pending','confirmed','failed'].includes(String(s.status)))throw new Error('识别状态无效');if(s.mode!==undefined&&!['mock','vision'].includes(String(s.mode)))throw new Error('识别模式无效');const drafts:Draft[]=array(s.items,100).map(v=>{const d=record(v);if(typeof d.selected!=='boolean')throw new Error('物品选择状态无效');return {id:key(d.id),name:text(d.name,120),category:text(d.category,120),selected:d.selected,...(validOutline(d.outline)?{outline:d.outline}:{}),confidence:confidence(d.confidence)}});unique(drafts);return {id:key(s.id),boxId:boxId(s.boxId),image:image(s.image,portable),status:s.status as Session['status'],items:drafts,...(s.receipt===undefined?{}:{receipt:text(s.receipt)}),mode:s.mode as Session['mode'],createdAt:s.createdAt===undefined?undefined:text(s.createdAt,40)}});
 unique(boxes);unique(items);unique(sessions);
 return {boxes,items,sessions,...(!portable&&raw.settings?{settings:{endpoint:text(record(raw.settings).endpoint),...(record(raw.settings).cutoutEndpoint===undefined?{}:{cutoutEndpoint:text(record(raw.settings).cutoutEndpoint)})}}:{})};
}
export function encodeBackup(data:Data):string {
 const content=JSON.stringify({format:'boxie-backup',version:1,exportedAt:new Date().toISOString(),data:validateData(data,true)});
 if(new TextEncoder().encode(content).byteLength>MAX_BACKUP_BYTES)throw new Error('备份超过 40MB，暂不支持导出这么大的空间');
 return content;
}
export function decodeBackup(content:string):Data {
 if(new TextEncoder().encode(content).byteLength>MAX_BACKUP_BYTES)throw new Error('备份超过 40MB');
 let raw:RecordValue;try{raw=record(JSON.parse(content))}catch{throw new Error('不是有效的 Boxin收纳盒 JSON 备份')}
 if(raw.format!=='boxie-backup'||raw.version!==1)throw new Error('不支持此备份格式或版本');
 return validateData(raw.data,true);
}
export function mergeBackup(current:Data,incoming:Data):Data {
 const boxIds=new Map(incoming.boxes.map(b=>[b.id,id()]));
 return {...current,boxes:[...current.boxes,...incoming.boxes.map(b=>({...b,id:boxIds.get(b.id)!}))],items:[...current.items,...incoming.items.map(i=>({...i,id:id(),boxId:boxIds.get(i.boxId)!}))],sessions:[...current.sessions,...incoming.sessions.map(s=>({...s,id:id(),boxId:boxIds.get(s.boxId)!,items:s.items.map(d=>({...d,id:id()}))}))]};
}

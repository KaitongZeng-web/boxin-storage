import type {Outline} from './outline';
export const colors = ['#D6A36A','#E9DDC9','#A7B69A','#91A9BE','#D69A8F','#BDAFCB','#E8C77E'];
export const boxTags = ["家庭收纳","工作学习","旅行打包","兴趣收藏"] as const;
export type Box = { tag?: typeof boxTags[number]; id:string; name:string; color:string; note:string; location:string; updatedAt:string };
export type Item = { isSticker?:boolean; id:string; boxId:string; name:string; category:string; outline?:Outline; image?:string; confidence?:number };
export type Draft = { id:string; name:string; category:string; outline?:Outline; selected:boolean; confidence?:number };
export type Session = { receipt?:string; id:string; image?:string; status:'pending'|'confirmed'|'failed'; items:Draft[]; boxId:string; mode?:'mock'|'vision'; createdAt?:string };
export type Data = { boxes:Box[]; items:Item[]; sessions:Session[]; settings?:{endpoint:string;cutoutEndpoint?:string} };
export const emptyData = ():Data => ({boxes:[],items:[],sessions:[]});
export const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export function saveBox(data:Data, box:Box):Data {
  if (!box.name.trim()) throw new Error('请填写箱子名称');
  return {...data, boxes:[...data.boxes.filter(b=>b.id!==box.id),{...box,name:box.name.trim(),updatedAt:new Date().toISOString()}]};
}
export function deleteBox(data:Data, boxId:string):Data {
  return {...data,boxes:data.boxes.filter(b=>b.id!==boxId),items:data.items.filter(i=>i.boxId!==boxId),sessions:data.sessions.filter(s=>s.boxId!==boxId)};
}
export function saveItem(data:Data, item:Item):Data {
  if(!item.name.trim()) throw new Error('请填写物品名称');
  if(!data.boxes.some(b=>b.id===item.boxId)) throw new Error('目标箱子不存在');
  const previous=data.items.find(i=>i.id===item.id);
  return {...data, items:[...data.items.filter(i=>i.id!==item.id),{...item,name:item.name.trim()}],boxes:data.boxes.map(b=>b.id===item.boxId||b.id===previous?.boxId?{...b,updatedAt:new Date().toISOString()}:b)};
}
export function deleteItem(data:Data, item:Item):Data {
  return {...data,items:data.items.filter(i=>i.id!==item.id),boxes:data.boxes.map(b=>b.id===item.boxId?{...b,updatedAt:new Date().toISOString()}:b)};
}
export function confirmSession(data:Data, session:Session):Data {
  if(data.sessions.find(s=>s.id===session.id)?.status==='confirmed') throw new Error('这次识别已保存');
  if(!data.boxes.some(b=>b.id===session.boxId)) throw new Error('请选择收纳箱');
  const selected=session.items.filter(i=>i.selected);
  if(!selected.length) throw new Error('请至少选择一个物品');
  let result=data;
  for(const draft of selected) result=saveItem(result,{id:id(),boxId:session.boxId,name:draft.name,category:draft.category,image:session.image,outline:draft.outline,confidence:draft.confidence});
  return {...result,sessions:[...result.sessions.filter(s=>s.id!==session.id),{...session,status:'confirmed'}]};
}
export function search(data:Data, query:string):{boxes:Box[];items:Item[]} {
  const term=query.trim().toLocaleLowerCase();
  if(!term) return {boxes:[],items:[]};
  const matches=(value:string)=>value.toLocaleLowerCase().includes(term);
  return {
    boxes:data.boxes.filter(box=>[box.name,box.note,box.location].some(matches)),
    items:data.items.filter(item=>[item.name,item.category].some(matches)),
  };
}
export function mockDrafts():Draft[] {return ['USB-C 数据线','充电头','U 盘','SD 卡','电池','剪刀'].map((name,n)=>({id:id(),name,category:n===5?'工具':'数码配件',selected:true,confidence:0.9}));}
export function saveDraft(data:Data, session:Session):Data {
 if(session.status!=='pending'||data.sessions.some(s=>s.id===session.id&&s.status==='confirmed'))throw new Error('已确认的识别不能覆盖为草稿');
 if(!data.boxes.some(b=>b.id===session.boxId))throw new Error('请先选择一个存在的箱子');
 return {...data,sessions:[...data.sessions.filter(s=>s.id!==session.id),session]};
}
export function validateEndpoint(value:string):string {
 const text=value.trim();if(!text)return '';
 let url:URL;try{url=new URL(text)}catch{throw new Error('请输入完整的 http:// 或 https:// 服务地址')}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('服务地址不能包含账号、密钥、查询参数或片段');
 return url.toString().replace(/\/$/,'');
}
export function referencedImages(data:Data):string[]{return [...new Set([...data.items.map(i=>i.image),...data.sessions.map(s=>s.image)].filter((v):v is string=>!!v))]}
export function unusedImages(before:Data,after:Data):string[]{const retained=new Set(referencedImages(after));return referencedImages(before).filter(uri=>!retained.has(uri))}
export function demoData():Data {
 const boxes=['数码杂物箱','书桌小物','旅行装备','手作收藏'].map((name,n)=>({id:id(),name,color:colors[[3,2,4,5][n]],note:['线材、充电、存储，都在这里','给日常留一点整齐','准备好下一次出发','慢慢收集的小快乐'][n],location:['书桌右侧第二层','书房置物架','衣柜上层','客厅储物柜'][n],updatedAt:new Date().toISOString()}));
 return {boxes,items:mockDrafts().map(d=>({id:d.id,name:d.name,category:d.category,boxId:boxes[0].id})),sessions:[]};
}

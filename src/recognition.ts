import { mockDrafts, id, type Draft } from './model';
export async function recognize(image:string|undefined, endpoint:string):Promise<{items:Draft[];mock:boolean}> {
 if(!endpoint) return {items:mockDrafts(),mock:true};
 if(!image)throw new Error('请先选择照片');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
 try {
  const form=new FormData();
  if(image.startsWith('blob:')||image.startsWith('data:'))form.append('image',await (await fetch(image)).blob(),'photo.jpg');
  else form.append('image',{uri:image,name:'photo.jpg',type:'image/jpeg'} as any);
  const response=await fetch(`${endpoint.replace(/\/$/,'')}/api/v1/recognize`,{method:'POST',body:form,signal:controller.signal});
  if(!response.ok)throw new Error('识别服务暂不可用，请重试');
  const body=await response.json();
  if(!Array.isArray(body.items)||body.items.length>100)throw new Error('识别结果格式错误');
  return {mock:body.mode==='mock',items:body.items.map((v:any)=>({id:id(),name:typeof v.name==='string'?v.name:'待确认物品',category:typeof v.category==='string'?v.category:'其他',selected:true,confidence:typeof v.confidence==='number'?v.confidence:undefined}))};
 } finally {clearTimeout(timeout);}
}

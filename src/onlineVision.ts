import jpegCodec from 'jpeg-js';
import {refineOutline} from './refineOutline.ts';
import {validOutline,type Outline} from './outline.ts';
export async function identifyPhoto(jpeg: string, key: string, request = fetch, baseUrl = "https://api.deepseek.com", aspect = 1): Promise<{items:{name:string;category:string;outline?:Outline}[];receipt:string}> {
  if (!jpeg || !key.trim()) throw new Error('请选择照片并填写 API Key');
  const base = baseUrl.trim().replace(/\/+$/,'');
  if (!['https://api.deepseek.com','https://api.deepseek.com/v1'].includes(base)) throw new Error('请填写 DeepSeek 官方 HTTPS API 地址');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await request(base+'/chat/completions', {
      method: 'POST',
      headers: {Authorization: 'Bearer ' + key.trim(), 'Content-Type': 'application/json'},
      signal: controller.signal,
      body: JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'}, response_format:{type:'json_object'}, messages:[{
        role:'user', content:[
          {type:'text',text:'列出清楚可见的独立物品。返回 JSON 对象，items 数组，每项含中文 name 和 category，以及 rings：逐件沿可见物体边缘描点，外轮廓及内部孔洞各一个闭合点序列，格式 [[[x,y],...],...]，按整张图宽高归一到 0-1000，禁止矩形框代替轮廓。无法识别时返回空数组。'},
          {type:'image_url',image_url:{url:'data:image/jpeg;base64,' + jpeg}}
        ]
      }]})
    });
    if (!response.ok) throw new Error('识别请求失败（HTTP ' + response.status + '），请检查 Key、额度和网络。');
    const body = await response.json();
    const items = JSON.parse(body.choices[0].message.content).items;
    if (!Array.isArray(items) || items.length > 100 || items.some(i => !i || typeof i.name !== 'string' || !i.name.trim())) throw new Error('模型返回的物品列表无效');
    let pixels:Parameters<typeof refineOutline>[1]|undefined;
    if(items.some(i=>validOutline({rings:i.rings,aspect}))){
      const bytes=Uint8Array.from(atob(jpeg),ch=>ch.charCodeAt(0));
      pixels=jpegCodec.decode(bytes,{useTArray:true,maxResolutionInMP:24});
    }
    const detected = items.map(i => ({...(validOutline({rings:i.rings,aspect})&&pixels?{outline:refineOutline({rings:i.rings,aspect},pixels)}:{}),name:i.name.trim().slice(0,120), category:typeof i.category === 'string' ? i.category.slice(0,120) : '其他'}));
    const total=body.usage?.total_tokens;
    const receipt=['DeepSeek 直连',typeof body.model==='string'?body.model:'未返回模型名',Number.isSafeInteger(total)&&total>=0?total+' tokens':'未返回用量','响应 ID '+(typeof body.id==='string'?body.id:'未提供')].join(' · ');
    return {items:detected,receipt};
  } finally {
    clearTimeout(timer);
  }
}

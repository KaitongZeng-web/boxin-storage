import { Platform } from 'react-native';

export type SubjectPoint = {x:number; y:number};

export function defaultCutoutService() {
  if (Platform.OS !== 'web') return '';
  const {hostname, origin} = window.location;
  return ['localhost', '127.0.0.1'].includes(hostname) ? 'http://' + hostname + ':8018' : origin;
}

async function requestCutout<T>(uri:string, endpoint:string, path:string, decode:(response:Response)=>Promise<T>, point?:SubjectPoint):Promise<T> {
  if (!endpoint) throw new Error('请在“我的”填写运行抠图服务的电脑地址。');
  const form = new FormData();
  if (Platform.OS === 'web') {
    form.append('image', await (await fetch(uri)).blob(), 'photo.png');
  } else {
    form.append('image', {uri, name:'photo.png', type:'image/png'} as unknown as Blob);
  }
  if (point) {
    form.append('x', String(point.x));
    form.append('y', String(point.y));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(endpoint + path, {method:'POST', body:form, signal:controller.signal});
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(typeof problem.detail === 'string' ? problem.detail : '抠图失败，请重试。');
    }
    return await decode(response);
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) throw new Error('无法连接抠图服务，请检查“我的”中的地址后重试。');
    throw error;
  } finally { clearTimeout(timeout); }
}

export function makeSticker(uri:string, endpoint:string, point?:SubjectPoint) {
  return requestCutout(uri, endpoint, '/api/v1/cutout', async response => {
    if (!response.headers.get('content-type')?.startsWith('image/png')) throw new Error('服务没有返回 PNG，请检查抠图地址。');
    const blob = await response.blob();
    return await new Promise<string>((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('无法读取贴纸'));
      reader.readAsDataURL(blob);
    });
  }, point);
}

export function makeStickers(uri:string, endpoint:string):Promise<string[]> {
  return requestCutout(uri, endpoint, '/api/v1/cutouts', async response => {
    const {stickers} = await response.json();
    if (!Array.isArray(stickers) || !stickers.length || stickers.some(s=>typeof s !== 'string' || !s.startsWith('data:image/png;base64,'))) {
      throw new Error('抠图服务未返回有效贴纸');
    }
    return stickers;
  });
}

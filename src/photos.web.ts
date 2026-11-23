import type { Data } from './model';
export async function retainPhoto(uri:string){const blob=await(await fetch(uri)).blob();return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('照片读取失败'));r.readAsDataURL(blob)})}
export async function removePhotos(_uris:string[]){}
export async function portablePhotos(data:Data){return data}
export async function localizePhotos(data:Data){return data}

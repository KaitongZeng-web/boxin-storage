import * as FS from 'expo-file-system/legacy';
import { id, referencedImages, type Data } from './model';
import { isManagedPhoto } from './photoPolicy';
const directory=()=>FS.documentDirectory+'boxie-photos/';
export async function retainPhoto(uri:string){await FS.makeDirectoryAsync(directory(),{intermediates:true});const target=directory()+id()+'.jpg';await FS.copyAsync({from:uri,to:target});return target}
export function managedPhoto(uri:string):boolean {
 return isManagedPhoto(uri,FS.documentDirectory);
}
export async function removePhotos(uris:string[]){for(const uri of uris){if(managedPhoto(uri))await FS.deleteAsync(uri,{idempotent:true})}}
export async function portablePhotos(data:Data):Promise<Data>{
 const replacements=new Map<string,string>();
 for(const uri of referencedImages(data)){if(uri.startsWith('data:'))replacements.set(uri,uri);else{if(!managedPhoto(uri))throw new Error('照片不在应用目录，无法备份');const base64=await FS.readAsStringAsync(uri,{encoding:FS.EncodingType.Base64});const mime=base64.startsWith('iVBOR')?'png':base64.startsWith('UklGR')?'webp':'jpeg';replacements.set(uri,`data:image/${mime};base64,${base64}`)}}
 return {...data,items:data.items.map(i=>({...i,image:i.image?replacements.get(i.image):undefined})),sessions:data.sessions.map(s=>({...s,image:s.image?replacements.get(s.image):undefined}))};
}
export async function localizePhotos(data:Data):Promise<Data>{
 await FS.makeDirectoryAsync(directory(),{intermediates:true});
 const replacements=new Map<string,string>();
 try{for(const uri of referencedImages(data)){const target=directory()+id()+'.jpg';replacements.set(uri,target);await FS.writeAsStringAsync(target,uri.slice(uri.indexOf(',')+1),{encoding:FS.EncodingType.Base64})}}catch(error){await removePhotos([...replacements.values()]);throw error}
 return {...data,items:data.items.map(i=>({...i,image:i.image?replacements.get(i.image):undefined})),sessions:data.sessions.map(s=>({...s,image:s.image?replacements.get(s.image):undefined}))};
}

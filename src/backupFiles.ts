import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Picker from 'expo-document-picker';
import { MAX_BACKUP_BYTES } from './backup';
export async function exportFile(content:string){
 if(!await Sharing.isAvailableAsync())throw new Error('当前设备无法打开文件分享面板');
 const uri=FS.cacheDirectory+'Boxin收纳盒-备份.json';
 await FS.writeAsStringAsync(uri,content);
 try{await Sharing.shareAsync(uri,{mimeType:'application/json',UTI:'public.json',dialogTitle:'保存 Boxin收纳盒 备份'})}finally{await FS.deleteAsync(uri,{idempotent:true})}
}
export async function importFile():Promise<string|undefined>{
 const result=await Picker.getDocumentAsync({type:['application/json','text/plain'],copyToCacheDirectory:true});if(result.canceled)return;
 const file=result.assets[0];
 try{const info=await FS.getInfoAsync(file.uri);if(!info.exists||info.size>MAX_BACKUP_BYTES)throw new Error('备份文件不能超过 40MB');return await FS.readAsStringAsync(file.uri)}finally{if(FS.cacheDirectory&&file.uri.startsWith(FS.cacheDirectory))await FS.deleteAsync(file.uri,{idempotent:true})}
}

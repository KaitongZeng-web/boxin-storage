import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { Data } from './model';
import { emptyData } from './model';
import { validateData } from './backup';
let database:Promise<SQLite.SQLiteDatabase>|undefined;
async function db(){if(!database) database=(async()=>{const d=await SQLite.openDatabaseAsync('boxie.db');await d.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);');return d;})();return database;}
export async function load():Promise<Data>{
 const raw=Platform.OS==='web'?localStorage.getItem('boxie-v1'):(await (await db()).getFirstAsync<{data:string}>('SELECT data FROM app_state WHERE id=1'))?.data;
 return raw?validateData(JSON.parse(raw)):emptyData();
}
export async function persist(data:Data){
 const raw=JSON.stringify(validateData(data));
 if(Platform.OS==='web')localStorage.setItem('boxie-v1',raw);
 else await (await db()).runAsync('INSERT INTO app_state(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',raw);
}

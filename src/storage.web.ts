import { emptyData, type Data } from './model';
import { validateData } from './backup';
export async function load():Promise<Data>{const raw=localStorage.getItem('boxie-v1');return raw?validateData(JSON.parse(raw)):emptyData()}
export async function persist(data:Data){localStorage.setItem('boxie-v1',JSON.stringify(validateData(data)))}

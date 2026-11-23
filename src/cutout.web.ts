import {outlineSticker} from './stickerBorder';
import {applyStickerMatte} from './stickerMatte';
import type * as ORT from 'onnxruntime-web';
export type SubjectPoint = {x:number;y:number};
export const defaultCutoutService = () => '';
const size = 320;
let session: Promise<ORT.InferenceSession> | undefined;
const runtime = () => (window as unknown as {ort:typeof ORT}).ort;
async function loadModel(){
  if (!runtime()) await new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='/sticker/ort.wasm.min.js';
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error('模型运行库未加载，请重新打开页面'));
    document.head.appendChild(script);
  });
  const ort=runtime();
  ort.env.wasm.numThreads=1;
  ort.env.wasm.wasmPaths='/sticker/';
  return ort.InferenceSession.create('/sticker/u2netp.onnx',{executionProviders:['wasm']});
}
function canvas(width:number,height:number){
  const el=document.createElement('canvas');
  el.width=width; el.height=height;
  return el.getContext('2d')!;
}
type Region = {x:number;y:number;width:number;height:number};
async function detect(model:ORT.InferenceSession,image:HTMLImageElement,region:Region){
  const ctx=canvas(size,size);
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(image,region.x,region.y,region.width,region.height,0,0,size,size);
  const pixels=ctx.getImageData(0,0,size,size).data;
  const area=size*size;
  const input=new Float32Array(area*3);
  for(let c=0;c<3;c++)for(let i=0;i<area;i++)
    input[c*area+i]=(pixels[i*4+c]/255-[.485,.456,.406][c])/[.229,.224,.225][c];
  const ort=runtime();
  const output=await model.run({[model.inputNames[0]]:new ort.Tensor('float32',input,[1,3,size,size])},[model.outputNames[0]]);
  const mask=output[model.outputNames[0]].data as Float32Array;
  const seen=new Uint8Array(area);
  const groups:number[][]=[];
  for(let i=0;i<area;i++){
    if(seen[i]||mask[i]<.45)continue;
    const group=[i];seen[i]=1;
    for(let k=0;k<group.length;k++){
      const p=group[k];
      for(const n of [p%size?p-1:-1,p%size===size-1?-1:p+1,p-size,p+size]){
        if(n>=0&&n<area&&!seen[n]&&mask[n]>=.45){seen[n]=1;group.push(n)}
      }
    }
    if(group.length>=40)groups.push(group);
  }
  return {pixels,mask,groups,region};
}
async function recognize(uri:string){
  session??=loadModel().catch(error=>{session=undefined;throw error});
  const model=await session;
  const image=new Image();
  image.src=uri;
  await image.decode();
  const full=await detect(model,image,{x:0,y:0,width:image.width,height:image.height});
  if(!full.groups.length)throw new Error('没有找到清晰主体，请换一张照片');
  return {image,model,full,stickers:new Map<number[],Promise<string>>()};
}

function bounds(group:number[],margin:number){
  let x=size,y=size,right=0,bottom=0;
  for(const index of group){
    const column=index%size,row=Math.floor(index/size);
    x=Math.min(x,column);y=Math.min(y,row);
    right=Math.max(right,column);bottom=Math.max(bottom,row);
  }
  x=Math.max(0,x-margin);y=Math.max(0,y-margin);
  return {x,y,width:Math.min(size,right+margin+1)-x,height:Math.min(size,bottom+margin+1)-y};
}

type Detection=Awaited<ReturnType<typeof detect>>;
async function refineSubject(model:ORT.InferenceSession,image:HTMLImageElement,full:Detection,group:number[]){
  const box=bounds(group,0);
  const context=Math.max(4,Math.ceil(Math.max(box.width,box.height)*.18));
  const tile=bounds(group,context);
  const sx=image.width/size,sy=image.height/size;
  // A second pass helps only when the crop contains more real detail and
  // substantially increases the number of model samples across the object.
  if(tile.width*tile.height>size*size*.60 || Math.max(sx,sy)<1.4)return {pass:full,group};
  const region={x:tile.x*sx,y:tile.y*sy,width:tile.width*sx,height:tile.height*sy};
  const zoom=await detect(model,image,region);
  const original=new Uint8Array(size*size);
  for(const index of group)original[index]=1;
  const support=new Uint8Array(size*size);
  let supported=0;
  for(let i=0;i<support.length;i++){
    const x=tile.x+Math.floor((i%size+.5)*tile.width/size);
    const y=tile.y+Math.floor((Math.floor(i/size)+.5)*tile.height/size);
    support[i]=original[y*size+x];supported+=support[i];
  }
  // Keep the original subject if the zoom pass switches to a neighbouring
  // object or splits off only a small part of the selected object.
  let best=.55, selected:number[]|undefined;
  for(const candidate of zoom.groups){
    const overlap=candidate.reduce((sum,i)=>sum+support[i],0);
    const iou=overlap/(supported+candidate.length-overlap);
    if(iou>best){best=iou;selected=candidate}
  }
  return selected?{pass:zoom,group:selected}:{pass:full,group};
}

function renderSticker(image:HTMLImageElement,pass:Detection,group:number[]){
  const {x:left,y:top,width:w,height:h}=bounds(group,2);
  const sx=pass.region.width/size,sy=pass.region.height/size;
  const scale=Math.min(1,1400/Math.max(w*sx,h*sy));
  const crop=canvas(Math.max(1,Math.round(w*sx*scale)),Math.max(1,Math.round(h*sy*scale)));
  crop.imageSmoothingQuality='high';
  crop.drawImage(image,pass.region.x+left*sx,pass.region.y+top*sy,w*sx,h*sy,0,0,crop.canvas.width,crop.canvas.height);
  const rgba=crop.getImageData(0,0,crop.canvas.width,crop.canvas.height);
  const alpha=new Uint8Array(size*size);
  for(const index of group)alpha[index]=Math.min(255,Math.round(pass.mask[index]*280));
  applyStickerMatte(rgba.data,rgba.width,rgba.height,pass.pixels,alpha,size,left,top,w,h);
  const outlined=outlineSticker(rgba.data,rgba.width,rgba.height);
  const final=canvas(outlined.width,outlined.height);
  final.putImageData(new ImageData(outlined.rgba,outlined.width,outlined.height),0,0);
  return final.canvas.toDataURL('image/png');
}
// Reuse the last photo's model pass when switching subjects or cutting all.
let previous:{uri:string;result:ReturnType<typeof recognize>}|undefined;
async function segment(uri:string,point?:SubjectPoint,all=false){
  if(previous?.uri!==uri){
    const result=recognize(uri);
    previous={uri,result};
    result.catch(()=>{if(previous?.result===result)previous=undefined});
  }
  const {image,model,full,stickers}=await previous.result;
  const groups=full.groups;
  const distance=(group:number[])=>group.reduce((best,i)=>Math.min(best,(i%size-point!.x*size)**2+(Math.floor(i/size)-point!.y*size)**2),Infinity);
  const ordered=groups.slice().sort((a,b)=>point?distance(a)-distance(b):b.length-a.length);
  const output:string[]=[];
  for(const group of all?ordered:ordered.slice(0,1)){
    let sticker=stickers.get(group);
    if(!sticker){
      sticker=refineSubject(model,image,full,group)
        .then(result=>renderSticker(image,result.pass,result.group));
      stickers.set(group,sticker);
      sticker.catch(()=>stickers.delete(group));
    }
    output.push(await sticker);
  }
  return output;
}
export async function makeSticker(uri:string,_endpoint:string,point?:SubjectPoint){return (await segment(uri,point))[0]}
export function makeStickers(uri:string,_endpoint:string){return segment(uri,undefined,true)}

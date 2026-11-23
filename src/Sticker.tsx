import React,{useId} from 'react';
import Svg,{Defs,ClipPath,Path,Image} from 'react-native-svg';
import type {Outline} from './outline';

export function Sticker({uri,outline}:{uri:string;outline:Outline}) {
  const clip='shape'+useId().replace(/[^a-z0-9]/gi,'');
  const rings=outline.rings.map(r=>r.map(([x,y])=>[x,y/outline.aspect]));
  const points=rings.flat(), xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const x=Math.min(...xs), y=Math.min(...ys);
  const w=Math.max(...xs)-x, h=Math.max(...ys)-y, pad=Math.max(w,h)*0.09;
  const path=rings.map(r=>'M'+r.map(p=>p.join(',')).join(' L')+' Z').join(' ');
  return <Svg width={88} height={88} viewBox={[x-pad,y-pad,w+pad*2,h+pad*2].join(' ')}>
    <Defs><ClipPath id={clip}><Path d={path} clipRule="evenodd"/></ClipPath></Defs>
    <Path d={path} fill="#9c8875" stroke="#9c8875" fillRule="evenodd" strokeWidth={pad} strokeLinejoin="round" y={pad*0.48}/>
    <Path d={path} fill="#fff8ef" stroke="#fff8ef" fillRule="evenodd" strokeWidth={pad} strokeLinejoin="round"/>
    <Image href={{uri}} width={1000} height={1000/outline.aspect} preserveAspectRatio="none" clipPath={'url(#'+clip+')'}/>
  </Svg>;
}

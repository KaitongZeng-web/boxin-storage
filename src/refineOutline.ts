import type {Outline} from './outline.ts';

type Pixels = {width:number;height:number;data:Uint8Array};
// Sample across each estimated edge, favouring nearby colour transitions.
// Work in image pixels so portrait photos and holes use the same distances.
export function refineOutline(outline:Outline, photo:Pixels):Outline {
  const {width,height,data}=photo;
  const offset=(x:number,y:number)=>4*(Math.min(height-1,Math.max(0,Math.round(y)))*width+
    Math.min(width-1,Math.max(0,Math.round(x))));
  const rings=outline.rings.map(ring=>{
    const vertices=ring.map(([x,y])=>[x*width/1000,y*height/1000]);
    const lengths=vertices.map(([x,y],i)=>{
      const q=vertices[(i+1)%vertices.length];
      return Math.hypot(q[0]-x,q[1]-y);
    });
    const perimeter=lengths.reduce((a,b)=>a+b,0);
    const radius=Math.max(2,Math.min(24,Math.round(perimeter*.024)));
    const count=Math.min(256,Math.max(vertices.length,Math.ceil(perimeter/2)));
    const points:number[][]=[];
    let edge=0,start=0;
    for(let i=0;i<count;i++){
      const distance=i*perimeter/count;
      while(edge<vertices.length-1 && start+lengths[edge]<=distance)start+=lengths[edge++];
      const a=vertices[edge],b=vertices[(edge+1)%vertices.length];
      const dx=(b[0]-a[0])/(lengths[edge]||1),dy=(b[1]-a[1])/(lengths[edge]||1);
      const x=a[0]+dx*(distance-start),y=a[1]+dy*(distance-start);
      let best=18,shift=0;
      for(let d=-radius;d<=radius;d++){
        const p=offset(x-dy*(d-1),y+dx*(d-1)),q=offset(x-dy*(d+1),y+dx*(d+1));
        const contrast=Math.hypot(data[p]-data[q],data[p+1]-data[q+1],data[p+2]-data[q+2]);
        const score=contrast/(1+Math.abs(d)/radius);
        if(score>best){best=score;shift=d}
      }
      points.push([x-dy*shift,y+dx*shift]);
    }
    return points.map((p,i)=>p.map((v,k)=>{
      const prev=points[(i+count-1)%count],next=points[(i+1)%count];
      return Math.min(1000,Math.max(0,(prev[k]+2*v+next[k])*250/(k?height:width)));
    }));
  });
  return {...outline,rings};
}

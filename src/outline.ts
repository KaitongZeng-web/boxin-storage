export type Outline = { rings: number[][][]; aspect: number };

export function validOutline(value: unknown): value is Outline {
  const o = value as Outline | undefined;
  return !!o && Number.isFinite(o.aspect) && o.aspect > 0 && o.aspect <= 100 &&
    Array.isArray(o.rings) && o.rings.length > 0 && o.rings.length <= 16 &&
    o.rings.every(r => Array.isArray(r) && r.length >= 3 && r.length <= 256 &&
      r.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1000)) &&
      Math.abs(r.reduce((a,p,i) => { const q=r[(i+1)%r.length]; return a+p[0]*q[1]-q[0]*p[1] },0)) > 1);
}

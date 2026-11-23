// Joint bilateral upsampling: use the original pixel colour to weight nearby
// model samples. The selected component is zero everywhere outside its mask.
export function applyStickerMatte(
  photo: Uint8ClampedArray, width: number, height: number,
  guide: Uint8ClampedArray, mask: Uint8Array, size: number,
  left: number, top: number, regionWidth: number, regionHeight: number,
) {
  const radius = 2;
  const spatial = new Float32Array(257);
  const colour = new Float32Array(4096);
  for (let i = 0; i < spatial.length; i++) spatial[i] = Math.exp(-i / 48);
  for (let i = 0; i < colour.length; i++) colour[i] = Math.exp(-i / 24);
  const boundaries = new Uint8Array(size * size);
  for (let y = top; y < top + regionHeight; y++) {
    for (let x = left; x < left + regionWidth; x++) {
      const index = y * size + x;
      for (let dy = -radius; dy <= radius && !boundaries[index]; dy++) {
        const row = Math.min(size - 1, Math.max(0, y + dy)) * size;
        for (let dx = -radius; dx <= radius; dx++) {
          if (mask[row + Math.min(size - 1, Math.max(0, x + dx))] !== mask[index]) {
            boundaries[index] = 1;
            break;
          }
        }
      }
    }
  }
  for (let y = 0; y < height; y++) {
    const fy = top + (y + .5) * regionHeight / height - .5;
    const cy = Math.round(fy);
    for (let x = 0; x < width; x++) {
      const fx = left + (x + .5) * regionWidth / width - .5;
      const cx = Math.round(fx);
      const i = cy * size + cx;
      const p = (y * width + x) * 4;
      let alpha = mask[i];
      if (boundaries[i]) {
        let sum = 0, weights = 0, spatialSum = 0, spatialWeights = 0;
        for (let sy = Math.max(0, cy-radius); sy <= Math.min(size-1, cy+radius); sy++) {
          for (let sx = Math.max(0, cx-radius); sx <= Math.min(size-1, cx+radius); sx++) {
            const q = sy * size + sx;
            const dr = photo[p] - guide[q*4], dg = photo[p+1] - guide[q*4+1], db = photo[p+2] - guide[q*4+2];
            const similarity = colour[Math.min(4095,(dr*dr+dg*dg+db*db) >>> 6)];
            const distance = Math.round(16*((sx-fx)**2+(sy-fy)**2));
            const weight = spatial[distance] * (similarity + .0005);
            spatialSum += spatial[distance] * mask[q];
            spatialWeights += spatial[distance];
            sum += weight * mask[q];
            weights += weight;
          }
        }
        const x0 = Math.max(0,Math.floor(fx)), y0 = Math.max(0,Math.floor(fy));
        const x1 = Math.min(size-1,x0+1), y1 = Math.min(size-1,y0+1);
        const tx = Math.max(0,fx-x0), ty = Math.max(0,fy-y0);
        const upper = mask[y0*size+x0]*(1-tx) + mask[y0*size+x1]*tx;
        const lower = mask[y1*size+x0]*(1-tx) + mask[y1*size+x1]*tx;
        const coarse = upper*(1-ty) + lower*ty;
        // Weak colour evidence should not spread a crisp model edge.
        const evidence = Math.min(1,Math.abs(sum/weights-spatialSum/spatialWeights)/12);
        alpha = evidence*(sum/weights) + (1-evidence)*coarse;
      }
      // Compress the uncertain transition while preserving source opacity.
      const coverage = Math.min(1, Math.max(0, (alpha/255 - .08) / .84));
      photo[p+3] = Math.round(photo[p+3] * coverage * coverage * (3 - 2*coverage));
    }
  }
}

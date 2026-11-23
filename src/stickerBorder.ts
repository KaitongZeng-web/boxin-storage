// Paint a round, antialiased white stroke behind the silhouette. The extra
// transparent margin also protects subjects that touch the source photo edge.
export function outlineSticker(photo: Uint8ClampedArray, width: number, height: number) {
  const radius = Math.max(1, Math.max(width, height) * 0.011);
  const padding = Math.ceil(radius) + 2;
  const outWidth = width + 2 * padding;
  const outHeight = height + 2 * padding;
  const distance = new Float32Array(outWidth * outHeight).fill(radius + 2);
  const rgba = new Uint8ClampedArray(distance.length * 4);

  for (let y = 0; y < height; y++) {
    const start = (y + padding) * outWidth + padding;
    rgba.set(photo.subarray(y * width * 4, (y + 1) * width * 4), start * 4);
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(start + x) * 4 + 3];
      if (alpha >= 96) distance[start + x] = 0.5 - alpha / 255;
    }
  }

  // Two directional passes approximate the distance to the nearest contour
  // in linear time, including the inside edges of handles and other holes.
  for (let y = 1; y < outHeight - 1; y++) {
    for (let x = 1; x < outWidth - 1; x++) {
      const i = y * outWidth + x;
      distance[i] = Math.min(distance[i], distance[i-1]+1, distance[i-outWidth]+1,
        distance[i-outWidth-1]+Math.SQRT2, distance[i-outWidth+1]+Math.SQRT2);
    }
  }
  for (let y = outHeight - 2; y > 0; y--) {
    for (let x = outWidth - 2; x > 0; x--) {
      const i = y * outWidth + x;
      distance[i] = Math.min(distance[i], distance[i+1]+1, distance[i+outWidth]+1,
        distance[i+outWidth+1]+Math.SQRT2, distance[i+outWidth-1]+Math.SQRT2);
      const stroke = Math.max(0, Math.min(1, radius + 0.5 - distance[i]));
      const p = i * 4;
      const subject = rgba[p+3] / 255;
      if (stroke === 0 || subject === 1) continue;
      const white = stroke * (1 - subject);
      const alpha = subject + white;
      for (let c = 0; c < 3; c++) rgba[p+c] = (rgba[p+c] * subject + 255 * white) / alpha;
      rgba[p+3] = 255 * alpha;
    }
  }
  return {rgba, width:outWidth, height:outHeight};
}

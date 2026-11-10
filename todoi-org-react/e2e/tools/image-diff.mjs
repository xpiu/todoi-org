// Pixel diff of two PNGs, computed in a headless browser's canvas (no native deps).
// Usage: node e2e/tools/image-diff.mjs a.png b.png [out-diff.png] [threshold=24]
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

export async function imageDiff(aPath, bPath, outPath, threshold = 24) {
  const [a, b] = await Promise.all([readFile(aPath), readFile(bPath)]);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = await page.evaluate(
    async ({ a, b, threshold }) => {
      const load = (b64) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = `data:image/png;base64,${b64}`;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const ctx = (img) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, w, h).data;
      };
      const da = ctx(ia);
      const db = ctx(ib);
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ox = out.getContext('2d');
      const od = ox.createImageData(w, h);
      let diff = 0;
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        const p = i / 4;
        if (d > threshold) {
          diff++;
          const x = p % w, y = Math.floor(p / w);
          minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          od.data[i] = 255; od.data[i + 1] = 0; od.data[i + 2] = 80; od.data[i + 3] = 255;
        } else {
          const g = (da[i] + da[i + 1] + da[i + 2]) / 3;
          od.data[i] = od.data[i + 1] = od.data[i + 2] = 200 + g / 5; od.data[i + 3] = 255;
        }
      }
      ox.putImageData(od, 0, 0);
      return {
        width: w,
        height: h,
        sizeMatch: ia.width === ib.width && ia.height === ib.height,
        diff,
        ratio: diff / (w * h),
        bbox: maxX < 0 ? null : [minX, minY, maxX, maxY],
        png: out.toDataURL('image/png').split(',')[1],
      };
    },
    { a: a.toString('base64'), b: b.toString('base64'), threshold },
  );
  await browser.close();
  if (outPath) await writeFile(outPath, Buffer.from(result.png, 'base64'));
  delete result.png;
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [a, b, out, t] = process.argv.slice(2);
  console.log(JSON.stringify(await imageDiff(a, b, out, t ? Number(t) : 24)));
}

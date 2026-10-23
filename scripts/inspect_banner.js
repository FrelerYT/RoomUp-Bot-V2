const { loadImage, createCanvas } = require('@napi-rs/canvas');
const path = 'C:/Users/frelerr/.gemini/antigravity/brain/92f1add0-89dd-40d3-9428-0523c0ea6b03/.user_uploaded/media_1789825104914.png';

async function test() {
  const img = await loadImage(path);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  let minX = img.width, maxX = 0, minY = img.height, maxY = 0;
  for (let y = 35; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const idx = (y * img.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      // Check if not dark discord background (which is around r:45-60, g:35-45, b:45-55)
      if ((r > 80 || b > 100) && !(r > 40 && r < 65 && g > 30 && g < 50 && b > 40 && b < 60)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log('Banner bounds: x:', minX, 'to', maxX, 'y:', minY, 'to', maxY, 'w:', maxX - minX, 'h:', maxY - minY);
  // Sample colors across the banner gradient
  const leftColor = [data[(minY + 50) * img.width * 4 + (minX + 30) * 4], data[(minY + 50) * img.width * 4 + (minX + 30) * 4 + 1], data[(minY + 50) * img.width * 4 + (minX + 30) * 4 + 2]];
  const midColor = [data[(minY + 50) * img.width * 4 + Math.floor((minX + maxX)/2) * 4], data[(minY + 50) * img.width * 4 + Math.floor((minX + maxX)/2) * 4 + 1], data[(minY + 50) * img.width * 4 + Math.floor((minX + maxX)/2) * 4 + 2]];
  const rightColor = [data[(minY + 50) * img.width * 4 + (maxX - 30) * 4], data[(minY + 50) * img.width * 4 + (maxX - 30) * 4 + 1], data[(minY + 50) * img.width * 4 + (maxX - 30) * 4 + 2]];
  console.log('Left color RGB:', leftColor);
  console.log('Mid color RGB:', midColor);
  console.log('Right color RGB:', rightColor);
}

test();

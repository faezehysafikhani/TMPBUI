import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

function createIconPNG(width, height) {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;

      // Distance from center for rounded box
      const cx = width / 2;
      const cy = height / 2;

      // Background gradient (Indigo to Purple)
      const tY = y / height;
      const r = Math.round(79 + (124 - 79) * tY);  // #4f46e5 -> #7c3aed
      const g = Math.round(70 + (58 - 70) * tY);
      const b = Math.round(229 + (237 - 229) * tY);

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;

      // Rounded container padding
      const margin = width * 0.08;
      const cornerRadius = width * 0.22;
      
      const insideX = x >= margin && x <= width - margin;
      const insideY = y >= margin && y <= height - margin;

      if (!insideX || !insideY) {
        // Outside padding -> rounded corners for icon
        let dx = 0;
        let dy = 0;
        if (x < margin + cornerRadius) dx = margin + cornerRadius - x;
        else if (x > width - margin - cornerRadius) dx = x - (width - margin - cornerRadius);

        if (y < margin + cornerRadius) dy = margin + cornerRadius - y;
        else if (y > height - margin - cornerRadius) dy = y - (height - margin - cornerRadius);

        if (dx > 0 && dy > 0) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > cornerRadius) {
            png.data[idx + 3] = 0; // Transparent
            continue;
          }
        }
      }

      // Draw Checkmark and "TM" in center
      // Checkmark geometry
      // Normalized coordinates within icon box (0..1)
      const nx = (x - margin) / (width - 2 * margin);
      const ny = (y - margin) / (height - 2 * margin);

      // Checkmark thickness and lines
      // Line 1: (0.28, 0.52) to (0.44, 0.68)
      // Line 2: (0.44, 0.68) to (0.72, 0.34)
      const distToSegment = (px, py, x1, y1, x2, y2) => {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
      };

      const d1 = distToSegment(nx, ny, 0.28, 0.50, 0.44, 0.66);
      const d2 = distToSegment(nx, ny, 0.44, 0.66, 0.72, 0.34);
      const minCheckDist = Math.min(d1, d2);

      const strokeWidth = 0.065;
      if (minCheckDist < strokeWidth) {
        // White checkmark
        const alpha = Math.min(1, (strokeWidth - minCheckDist) / 0.01);
        png.data[idx] = Math.round(255 * alpha + png.data[idx] * (1 - alpha));
        png.data[idx + 1] = Math.round(255 * alpha + png.data[idx + 1] * (1 - alpha));
        png.data[idx + 2] = Math.round(255 * alpha + png.data[idx + 2] * (1 - alpha));
      }

      // Small accent circle top right
      const circleDist = Math.hypot(nx - 0.75, ny - 0.72);
      if (circleDist < 0.05) {
        png.data[idx] = 255;
        png.data[idx + 1] = 255;
        png.data[idx + 2] = 255;
      }
    }
  }

  return png;
}

function createOGImagePNG(width, height) {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;

      // Dark Rich Indigo Slate Background
      const tX = x / width;
      const tY = y / height;

      // Dark gradient background #0f172a to #1e1b4b
      const r = Math.round(15 + (30 - 15) * tX + (20 - 15) * tY);
      const g = Math.round(23 + (27 - 23) * tX + (15 - 23) * tY);
      const b = Math.round(42 + (75 - 42) * tX + (60 - 42) * tY);

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;

      // Glowing indigo aura circle in center-left
      const auraDist = Math.hypot(x - 300, y - 315);
      if (auraDist < 350) {
        const factor = (1 - auraDist / 350) * 0.45;
        png.data[idx] = Math.min(255, Math.round(png.data[idx] + 79 * factor));
        png.data[idx + 1] = Math.min(255, Math.round(png.data[idx + 1] + 70 * factor));
        png.data[idx + 2] = Math.min(255, Math.round(png.data[idx + 2] + 229 * factor));
      }

      // Draw Icon Box on Left Side (center at x=280, y=315, size=240)
      const iconX = x - 160;
      const iconY = y - 195;
      const iconSize = 240;

      if (iconX >= 0 && iconX < iconSize && iconY >= 0 && iconY < iconSize) {
        const nx = iconX / iconSize;
        const ny = iconY / iconSize;

        // Rounded box
        const cornerRadius = 0.22;
        let inIcon = true;
        let dx = 0;
        let dy = 0;
        if (nx < cornerRadius) dx = cornerRadius - nx;
        else if (nx > 1 - cornerRadius) dx = nx - (1 - cornerRadius);

        if (ny < cornerRadius) dy = cornerRadius - ny;
        else if (ny > 1 - cornerRadius) dy = ny - (1 - cornerRadius);

        if (dx > 0 && dy > 0 && Math.hypot(dx, dy) > cornerRadius) {
          inIcon = false;
        }

        if (inIcon) {
          // Icon gradient
          const ir = Math.round(79 + (124 - 79) * ny);
          const ig = Math.round(70 + (58 - 70) * ny);
          const ib = Math.round(229 + (237 - 229) * ny);

          // Checkmark inside icon box
          const distToSegment = (px, py, x1, y1, x2, y2) => {
            const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
            if (l2 === 0) return Math.hypot(px - x1, py - y1);
            let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
          };

          const d1 = distToSegment(nx, ny, 0.28, 0.50, 0.44, 0.66);
          const d2 = distToSegment(nx, ny, 0.44, 0.66, 0.72, 0.34);
          const checkDist = Math.min(d1, d2);

          if (checkDist < 0.07) {
            png.data[idx] = 255;
            png.data[idx + 1] = 255;
            png.data[idx + 2] = 255;
          } else {
            png.data[idx] = ir;
            png.data[idx + 1] = ig;
            png.data[idx + 2] = ib;
          }
        }
      }

      // Draw horizontal decorative card lines on right side (mock UI card)
      if (x >= 460 && x <= 1120 && y >= 140 && y <= 490) {
        const cardX = x - 460;
        const cardY = y - 140;
        const cardW = 660;
        const cardH = 350;

        // Card container border & background
        const cRadius = 24;
        let inCard = true;
        let cdx = 0, cdy = 0;
        if (cardX < cRadius) cdx = cRadius - cardX;
        else if (cardX > cardW - cRadius) cdx = cardX - (cardW - cRadius);
        if (cardY < cRadius) cdy = cRadius - cardY;
        else if (cardY > cardH - cRadius) cdy = cardY - (cardH - cRadius);

        if (cdx > 0 && cdy > 0 && Math.hypot(cdx, cdy) > cRadius) {
          inCard = false;
        }

        if (inCard) {
          // Glass card background
          const blend = 0.25;
          png.data[idx] = Math.round(png.data[idx] * (1 - blend) + 30 * blend);
          png.data[idx + 1] = Math.round(png.data[idx + 1] * (1 - blend) + 41 * blend);
          png.data[idx + 2] = Math.round(png.data[idx + 2] * (1 - blend) + 69 * blend);

          // Card rows
          const rowY = cardY % 70;
          if (rowY >= 15 && rowY <= 55) {
            const itemX = cardX;
            if (itemX >= 30 && itemX <= 70 && rowY >= 25 && rowY <= 45) {
              // Checkbox accent
              png.data[idx] = 99;
              png.data[idx + 1] = 102;
              png.data[idx + 2] = 241;
            } else if (itemX >= 90 && itemX <= 500 && rowY >= 30 && rowY <= 40) {
              // Text line accent
              png.data[idx] = 226;
              png.data[idx + 1] = 232;
              png.data[idx + 2] = 240;
            } else if (itemX >= 530 && itemX <= 620 && rowY >= 26 && rowY <= 44) {
              // Badge pill
              png.data[idx] = 79;
              png.data[idx + 1] = 70;
              png.data[idx + 2] = 229;
            }
          }
        }
      }
    }
  }

  return png;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write 512x512
const icon512 = createIconPNG(512, 512);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), PNG.sync.write(icon512));
fs.writeFileSync(path.join(publicDir, 'icon.png'), PNG.sync.write(icon512));

// Write 192x192
const icon192 = createIconPNG(192, 192);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), PNG.sync.write(icon192));

// Write 1200x630 OG image
const ogImage = createOGImagePNG(1200, 630);
fs.writeFileSync(path.join(publicDir, 'og-image.png'), PNG.sync.write(ogImage));

console.log('PNG Icons and Open Graph image generated successfully!');

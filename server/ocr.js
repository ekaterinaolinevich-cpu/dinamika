// OCR для фото и скриншотов через Apple Vision (только macOS).
// На Linux osascript нет — там OCR отключается, PDF и текст работают.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tif', '.tiff', '.bmp']);

export function isImageUpload(filename = '', mimetype = '') {
  const ext = path.extname(String(filename)).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  return String(mimetype).toLowerCase().startsWith('image/');
}

let availability = null;

export async function ocrAvailable() {
  if (availability !== null) return availability;
  if (process.platform !== 'darwin') {
    availability = false;
    return availability;
  }
  try {
    await execFileAsync('osascript', ['-e', '1'], { timeout: 4000 });
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

export async function ocrImage(buffer, filename = 'photo.jpg') {
  const dir = path.join(process.cwd(), 'data', 'tmp');
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(filename).toLowerCase() || '.jpg';
  const file = path.join(dir, `${randomUUID()}${ext}`);
  await fs.writeFile(file, buffer);

  try {
    const scriptPath = path.join(process.cwd(), 'ocr', 'vision-ocr.js');
    const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', scriptPath, '--', file], {
      timeout: 45000,
      maxBuffer: 12 * 1024 * 1024,
    });
    return String(stdout || '').trim();
  } finally {
    fs.unlink(file).catch(() => {});
  }
}

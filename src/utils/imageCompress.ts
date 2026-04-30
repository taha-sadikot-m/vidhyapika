/**
 * Compresses and converts an image File to a base64 data URL — entirely client-side.
 * No server call, no body-size limits, works on every hosting environment.
 *
 * @param file     - The image File from <input> or drag-and-drop
 * @param maxPx    - Max width/height in pixels (default 1280)
 * @param quality  - JPEG quality 0-1 (default 0.82)
 */
export function compressImageToBase64(
  file: File,
  maxPx = 1280,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width: w, height: h } = img;
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round((h * maxPx) / w); w = maxPx; }
        else         { w = Math.round((w * maxPx) / h); h = maxPx; }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

/**
 * Process multiple image files: compress each and return array of base64 data URLs.
 */
export async function compressImagesToBase64(
  files: File[],
  maxPx = 1280,
  quality = 0.82
): Promise<string[]> {
  return Promise.all(files.map(f => compressImageToBase64(f, maxPx, quality)));
}

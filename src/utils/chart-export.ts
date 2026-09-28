function slugify(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'chart';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSvgElementAsSvg(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  const svgString = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `${slugify(filename)}.svg`);
}

/** CSS pixels are 96 dpi. 300/96 makes a print-sized PNG; pHYs records 300 dpi. */
export const CHART_EXPORT_PNG_DPI = 300;
export const CHART_EXPORT_PNG_SCALE = CHART_EXPORT_PNG_DPI / 96;

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Insert a pHYs chunk so the file declares the given dpi. */
export function stampPngDpi(input: Uint8Array, dpi = CHART_EXPORT_PNG_DPI): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0, ppm);
  view.setUint32(4, ppm);
  data[8] = 1;
  const phys = chunk('pHYs', data);
  const parts: Uint8Array[] = [input.subarray(0, 8)];
  let inserted = false;
  let offset = 8;
  while (offset + 8 <= input.length) {
    const length = new DataView(input.buffer, input.byteOffset + offset, 4).getUint32(0);
    const type = String.fromCharCode(
      input[offset + 4],
      input[offset + 5],
      input[offset + 6],
      input[offset + 7]
    );
    const end = offset + 12 + length;
    if (type === 'pHYs') {
      offset = end;
      continue;
    }
    if (type === 'IDAT' && !inserted) {
      parts.push(phys);
      inserted = true;
    }
    parts.push(input.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

export function pngDpi(bytes: Uint8Array): number | null {
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    if (type === 'pHYs' && length >= 9) {
      const ppm = new DataView(bytes.buffer, bytes.byteOffset + offset + 8, 4).getUint32(0);
      return Math.round(ppm * 0.0254);
    }
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return null;
}

export async function exportSvgElementAsPng(
  svg: SVGSVGElement,
  filename: string,
  scale = CHART_EXPORT_PNG_SCALE
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const viewBox = clone.viewBox?.baseVal;
  const width =
    viewBox?.width || clone.width?.baseVal?.value || svg.getBoundingClientRect().width || 420;
  const height =
    viewBox?.height || clone.height?.baseVal?.value || svg.getBoundingClientRect().height || 200;

  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const svgString = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(async pngBlob => {
        if (!pngBlob) {
          reject(new Error('Failed to create PNG'));
          return;
        }
        const stamped = stampPngDpi(new Uint8Array(await pngBlob.arrayBuffer()));
        const bytes = new ArrayBuffer(stamped.byteLength);
        new Uint8Array(bytes).set(stamped);
        downloadBlob(new Blob([bytes], { type: 'image/png' }), `${slugify(filename)}.png`);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to render chart'));
    img.src = url;
  });
}

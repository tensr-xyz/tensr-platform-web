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

export async function exportSvgElementAsPng(svg: SVGSVGElement, filename: string): Promise<void> {
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
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.scale(2, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(pngBlob => {
          if (!pngBlob) {
            reject(new Error('Failed to create PNG'));
            return;
          }
          downloadBlob(pngBlob, `${slugify(filename)}.png`);
          resolve();
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to render chart'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

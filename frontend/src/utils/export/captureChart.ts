import html2canvas from 'html2canvas-pro';

export async function captureNodeAsImage(node: HTMLElement): Promise<string> {
  const canvas = await html2canvas(node, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });
  return canvas.toDataURL('image/png');
}

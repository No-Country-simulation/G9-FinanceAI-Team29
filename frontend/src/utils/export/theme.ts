export const EXPORT_COLORS = {
  brand: '#465FFF',
  brandDark: '#3641F5',
  success: '#12B76A',
  error: '#F04438',
  gray: '#667085',
  white: '#FFFFFF',
  textDark: '#1D2939',
} as const;

export type KpiColor = 'brand' | 'success' | 'error';

const CATEGORIA_PALETTE = [
  '#465FFF', '#12B76A', '#F79009', '#0BA5EC', '#7A5AF8',
  '#F04438', '#06AED4', '#EE46BC', '#6172F3', '#F63D68', '#667085',
];

export function getCategoriaHex(categoria: string): string {
  let hash = 0;
  for (let i = 0; i < categoria.length; i++) {
    hash = categoria.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CATEGORIA_PALETTE.length;
  return CATEGORIA_PALETTE[index];
}

export const LOGO_PATH = '/logo.png';

export async function fetchLogoBase64(): Promise<string | undefined> {
  try {
    const response = await fetch(LOGO_PATH);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

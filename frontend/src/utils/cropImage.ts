import type { Area } from 'react-easy-crop';

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.addEventListener('load', () => resolve(imagen));
    imagen.addEventListener('error', reject);
    imagen.crossOrigin = 'anonymous';
    imagen.src = src;
  });
}

/**
 * Recorta `src` según `areaPixeles` (devuelto por react-easy-crop) y lo
 * devuelve como un Blob JPEG. El recorte final se limita a `ladoMaximo` para
 * no mandar al backend algo mucho más grande de lo que va a necesitar
 * (igual el backend redimensiona a 256x256, pero esto evita subir un blob
 * innecesariamente pesado en fotos de cámara de varios MB).
 */
export async function recortarImagen(
  src: string,
  areaPixeles: Area,
  ladoMaximo = 1024,
): Promise<Blob> {
  const imagen = await cargarImagen(src);
  const lado = Math.min(areaPixeles.width, ladoMaximo);

  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo preparar el recorte de la imagen.');
  }

  ctx.drawImage(
    imagen,
    areaPixeles.x,
    areaPixeles.y,
    areaPixeles.width,
    areaPixeles.height,
    0,
    0,
    lado,
    lado,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen recortada.'))),
      'image/jpeg',
      0.92,
    );
  });
}

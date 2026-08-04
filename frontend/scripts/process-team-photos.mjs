// Procesa las fotos originales del equipo (team-photos-raw/) y genera versiones
// cuadradas, livianas y optimizadas en public/team/ para los avatares circulares.
//
// Uso: npm run team-photos
//
// Cómo funciona el encuadre:
// Las fotos originales suelen tener mucho espacio de hombros/pecho debajo de la
// cara. Un recorte centrado corta la parte de arriba (pelo). Por eso el recorte
// cuadrado se toma con un sesgo hacia arriba (verticalBias cercano a 0 = pegado
// arriba, 0.5 = centrado). Si a alguien se le corta la cara o se ve muy "pegado
// arriba", ajustá su valor en VERTICAL_BIAS_OVERRIDES.
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "team-photos-raw");
const OUTPUT_DIR = path.join(ROOT, "public", "team");

const OUTPUT_SIZE = 480; // 2x-3x el tamaño máximo mostrado (112px) para retina
const WEBP_QUALITY = 82;
const DEFAULT_VERTICAL_BIAS = 0.18;

const VERTICAL_BIAS_OVERRIDES = {
  // "nombre-archivo-sin-extension": 0.1,
};

async function processImage(fileName) {
  const baseName = path.parse(fileName).name;
  const inputPath = path.join(SOURCE_DIR, fileName);
  const outputPath = path.join(OUTPUT_DIR, `${baseName}.webp`);

  const image = sharp(inputPath).rotate();
  const { width, height } = await image.metadata();

  if (!width || !height) {
    console.warn(`No se pudo leer ${fileName}, se omite.`);
    return;
  }

  const size = Math.min(width, height);
  const verticalBias = VERTICAL_BIAS_OVERRIDES[baseName] ?? DEFAULT_VERTICAL_BIAS;
  const maxTop = height - size;
  const left = Math.round((width - size) / 2);
  const top = Math.round(maxTop * verticalBias);

  await image
    .extract({ left, top, width: size, height: size })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);

  console.log(`✓ ${fileName} -> team/${baseName}.webp`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const entries = await readdir(SOURCE_DIR).catch(() => []);
  const images = entries.filter((name) => /\.(png|jpe?g|webp)$/i.test(name));

  if (images.length === 0) {
    console.log(
      `No hay imágenes en ${path.relative(ROOT, SOURCE_DIR)}. Colocá ahí las fotos originales y volvé a correr "npm run team-photos".`
    );
    return;
  }

  for (const fileName of images) {
    await processImage(fileName);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

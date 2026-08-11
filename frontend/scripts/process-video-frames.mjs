// Convierte videos en public/images/task/ a WebP animado optimizado,
// preservando la animación para easter eggs (a diferencia de las fotos
// del equipo, que se procesan como WebP estático con process-team-photos.mjs).
//
// Uso: npm run process-videos
//
import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VIDEO_DIR = path.join(ROOT, "public", "images", "task");
const WEBP_QUALITY = 65;
const OUTPUT_FPS = 12;
const MAX_WIDTH = 320;
const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";

async function convertToAnimatedWebp(fileName) {
  const baseName = path.parse(fileName).name;
  const inputPath = path.join(VIDEO_DIR, fileName);
  const outputPath = path.join(VIDEO_DIR, `${baseName}.webp`);

  try {
    execFileSync(
      FFMPEG_BIN,
      [
        "-y",
        "-i", inputPath,
        "-vcodec", "libwebp",
        "-filter:v", `fps=${OUTPUT_FPS},scale=${MAX_WIDTH}:-1:flags=lanczos`,
        "-lossless", "0",
        "-q:v", String(WEBP_QUALITY),
        "-compression_level", "6",
        "-loop", "0",
        "-an",
        "-vsync", "0",
        outputPath,
      ],
      { stdio: "pipe" }
    );

    const { size } = await stat(outputPath);
    console.log(`✓ ${fileName} -> ${baseName}.webp (${(size / 1024).toFixed(0)} KB)`);
  } catch (error) {
    console.error(`✗ Error procesando ${fileName}:`, error.message);
  }
}

async function main() {
  await mkdir(VIDEO_DIR, { recursive: true });

  const entries = await readdir(VIDEO_DIR).catch(() => []);
  const videos = entries.filter((name) => /\.mp4$/i.test(name));

  if (videos.length === 0) {
    console.log("No hay videos .mp4 para procesar.");
    return;
  }

  for (const fileName of videos) {
    await convertToAnimatedWebp(fileName);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

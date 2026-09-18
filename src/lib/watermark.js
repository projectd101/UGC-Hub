import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

// Pinned exact versions (must match package.json) — ffmpeg.wasm is known to
// throw cryptic "memory access out of bounds" errors when @ffmpeg/ffmpeg and
// @ffmpeg/core versions drift apart, so these three are always upgraded together.
const FFMPEG_CORE_VERSION = "0.12.10";
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

let ffmpegInstance = null;
let ffmpegLoadPromise = null;

// Loads the single-threaded ffmpeg.wasm core (not core-mt). Single-threaded
// avoids the SharedArrayBuffer / cross-origin-isolation (COOP+COEP header)
// requirement entirely — a whole class of deployment failure removed, at
// the cost of somewhat slower processing. Fine for short reaction clips.
async function getFFmpeg(onLog) {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    if (onLog) ffmpeg.on("log", ({ message }) => onLog(message));

    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

// Renders a thick, tiled, diagonal watermark pattern as a transparent PNG
// using Canvas. drawtext (FFmpeg's native text filter) cannot rotate text,
// so a full-coverage diagonal watermark is pre-rendered as an image instead
// and overlaid — the standard, robust approach for this kind of coverage.
function renderWatermarkPng(text, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
  ctx.font = "bold 42px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.save();
  // Rotate the whole canvas -30deg so the repeated tiles read as a diagonal
  // band across the frame, then tile well beyond the visible bounds so
  // rotation never leaves a gap at the corners.
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-30 * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);

  const stepX = 260;
  const stepY = 140;
  const overscan = Math.max(width, height); // covers corners after rotation
  for (let y = -overscan; y < height + overscan; y += stepY) {
    for (let x = -overscan; x < width + overscan; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

// Reads a video file's dimensions by loading it into a hidden <video> element,
// so the watermark PNG is generated at matching resolution for a clean overlay.
function getVideoDimensions(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const width = video.videoWidth || 1080;
      const height = video.videoHeight || 1920;
      URL.revokeObjectURL(video.src);
      resolve({ width, height });
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Couldn't read video metadata"));
    };
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Produces a watermarked, compressed preview copy of a video file.
 * The original `file` is left completely untouched — this only returns a
 * new Blob for the public-facing preview.
 *
 * @param {File} file - the original video file the creator selected
 * @param {(status: string) => void} [onProgress] - optional progress callback for UI feedback
 * @returns {Promise<Blob>} the watermarked, compressed video as a Blob (video/mp4)
 */
export async function createWatermarkedPreview(file, onProgress) {
  onProgress?.("Loading video processor…");
  const ffmpeg = await getFFmpeg((msg) => {
    // ffmpeg's own internal logs are verbose; surfaced only for debugging,
    // not shown to the creator directly.
    console.debug("[ffmpeg]", msg);
  });

  onProgress?.("Reading video…");
  const { width, height } = await getVideoDimensions(file);

  onProgress?.("Generating watermark…");
  const watermarkBlob = await renderWatermarkPng("UGC HUB PREVIEW", width, height);
  const watermarkBuffer = new Uint8Array(await watermarkBlob.arrayBuffer());

  const inputName = "input" + (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".mp4");
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
  await ffmpeg.writeFile("watermark.png", watermarkBuffer);

  onProgress?.("Applying watermark…");

  // overlay the watermark PNG over every frame, then compress with a fast
  // preset and a moderate CRF (lower quality than the original — this is a
  // preview, not the deliverable) so the file is small and quick to stream.
  await ffmpeg.exec([
    "-i", inputName,
    "-i", "watermark.png",
    "-filter_complex", "[0:v][1:v]overlay=0:0",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "30",
    "-c:a", "aac",
    "-b:a", "96k",
    "-movflags", "+faststart",
    outputName,
  ]);

  onProgress?.("Finishing up…");
  const data = await ffmpeg.readFile(outputName);

  // Clean up virtual filesystem entries so repeated calls in the same
  // session (multiple uploads) don't accumulate memory.
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile("watermark.png").catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  return new Blob([data.buffer], { type: "video/mp4" });
}

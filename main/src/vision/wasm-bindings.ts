import fs from "fs/promises";
import type { ImageData } from "./utils";

let tessModule: any;
export let tessApi: any;
export let cv: any;

const langMap = new Map([
  ["en", "eng"],
  ["ru", "rus"],
  // ['cmn-Hant', 'chi_tra'],
]);

export async function init(_binDir: string) {
  throw new Error("OCR screenshot pipeline is unsupported on Linux Wayland.");
}

export async function changeLanguage(lang: string, binDir: string) {
  if (!langMap.has(lang)) {
    throw new Error("Unsupported language");
  }
  lang = langMap.get(lang)!;
  const langData = await fs.readFile(binDir + `/${lang}.traineddata`);
  tessModule.FS.writeFile(`${lang}.traineddata`, langData);
  if (tessApi.Init(null, lang, tessModule.OEM_DEFAULT)) {
    throw new Error("Could not initialize tesseract.");
  }
  tessModule.FS.unlink(`${lang}.traineddata`);
}

export function ocrSetImage(
  data: Uint8Array,
  width: number,
  height: number,
  bpp: number,
) {
  const imgPtr = tessModule._malloc(data.byteLength);
  tessModule.HEAPU8.set(data, imgPtr);
  if (bpp === 0) {
    tessApi.SetImage(imgPtr, width, height, 0, Math.ceil(width / 8));
  } else {
    tessApi.SetImage(imgPtr, width, height, bpp, width * bpp);
  }
  tessModule._free(imgPtr);
}

export function cvMatFromImage(img: ImageData) {
  const mat = new cv.Mat(img.height, img.width, cv.CV_8UC4);
  mat.data.set(img.data);
  return mat;
}

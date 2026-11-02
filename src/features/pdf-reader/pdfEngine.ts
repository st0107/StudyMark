import * as pdfjsLibrary from 'pdfjs-dist';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Keep the display layer and worker on the exact same installed version.
pdfjsLibrary.GlobalWorkerOptions.workerSrc = workerUrl;

export function getDocument(options: DocumentInitParameters) {
  const base = `${import.meta.env.BASE_URL}pdfjs`;
  return pdfjsLibrary.getDocument({ cMapUrl: `${base}/cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${base}/standard_fonts/`, wasmUrl: `${base}/wasm/`, isEvalSupported: false, ...options });
}
export const pdfjs = { ...pdfjsLibrary, getDocument };

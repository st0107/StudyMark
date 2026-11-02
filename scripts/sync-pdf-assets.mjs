import { cp, mkdir } from 'node:fs/promises';

// PDF.js loads these files only when a document needs additional font/codec data.
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  const destination = new URL(`../public/pdfjs/${directory}/`, import.meta.url);
  await mkdir(destination, { recursive: true });
  await cp(new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url), destination, { recursive: true });
}
console.log('PDF font, character-map, and codec assets are ready.');

import { MAX_PDF_PAGES, validatePdfFile } from '../../shared/api/validation';

export async function inspectPdfUpload(file: File): Promise<number> {
  await validatePdfFile(file);
  const { pdfjs } = await import('../pdf-reader/pdfEngine');
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try {
    const document = await task.promise;
    if (document.numPages > MAX_PDF_PAGES) throw new Error(`Choose a PDF with ${MAX_PDF_PAGES} pages or fewer.`);
    // Parsing a page catches damaged page trees that an initial metadata read can miss.
    await document.getPage(1);
    return document.numPages;
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('Password-protected PDFs aren’t supported. Upload an unlocked copy.');
    if (error instanceof Error && error.message.includes('pages or fewer')) throw error;
    throw new Error('This PDF could not be opened. It may be damaged or unsupported.');
  } finally {
    await task.destroy();
  }
}

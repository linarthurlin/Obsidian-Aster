// Obsidian-hosted PDF.js adapter. The host supplies PDF.js and its worker; Aster bundles neither.
export const RESEARCH_PDF_LIMITS = Object.freeze({
  bytesPerFile: 12_000_000,
  pagesPerFile: 120,
  pagesTotal: 240,
  extractedCharsPerFile: 100_000,
});

export function parsePdfPageRange(value, pageCount, maxPages = RESEARCH_PDF_LIMITS.pagesPerFile) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 || !Number.isSafeInteger(maxPages) || maxPages < 1)
    throw new Error('PDF page count is invalid.');
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) {
    if (pageCount > maxPages) throw new Error(`This PDF has ${pageCount} pages. Enter an explicit page range of at most ${maxPages} pages.`);
    return Array.from({ length: pageCount }, (_unused, index) => index + 1);
  }
  const pages = new Set();
  for (const part of input.split(',')) {
    const token = part.trim();
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/u);
    if (!match) throw new Error('Enter PDF pages as numbers or ranges, for example 1-3, 8.');
    const first = Number(match[1]), last = match[2] ? Number(match[2]) : first;
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > pageCount)
      throw new Error(`PDF page range ${token} is outside the document's 1–${pageCount} page range.`);
    for (let page = first; page <= last; page++) {
      if (!pages.has(page) && pages.size >= maxPages) throw new Error(`Select no more than ${maxPages} pages from one PDF.`);
      pages.add(page);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

function pageText(items, characterLimit) {
  const parts = [];
  let length = 0;
  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const text = item.str;
    const addLineBreak = !!item.hasEOL && !text.endsWith('\n');
    length += text.length + (addLineBreak ? 1 : 0);
    if (length > characterLimit) throw new Error('Selected PDF pages exceed the 100,000-character extraction budget. Choose a narrower page range.');
    parts.push(text);
    if (addLineBreak) parts.push('\n');
  }
  return parts.join('').replace(/\r\n?/gu, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, ' ').trim();
}

function awaitWithAbort(value, signal) {
  if (!signal) return Promise.resolve(value);
  if (signal.aborted) return Promise.reject(new Error('PDF preview was cancelled.'));
  return new Promise((resolve, reject) => {
    const onAbort = () => { cleanup(); reject(new Error('PDF preview was cancelled.')); };
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(value).then(result => { cleanup(); resolve(result); }, error => { cleanup(); reject(error); });
  });
}

export async function extractPdfPages(pdfjs, bytes, pageRange = '', signal, maxSelectedPages = RESEARCH_PDF_LIMITS.pagesPerFile, onProgress) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > RESEARCH_PDF_LIMITS.bytesPerFile)
    throw new Error('Each selected PDF must be between 1 byte and 12,000,000 bytes.');
  if (!pdfjs || typeof pdfjs.getDocument !== 'function') throw new Error('Obsidian PDF.js is unavailable in this app version.');
  if (!Number.isSafeInteger(maxSelectedPages) || maxSelectedPages < 1) throw new Error('No PDF page budget remains in this Research source set.');
  if (signal?.aborted) throw new Error('PDF preview was cancelled.');

  let loadingTask, pdf, destroyPromise;
  const destroy = () => {
    if (!destroyPromise) {
      try { destroyPromise = Promise.resolve(loadingTask?.destroy?.()).catch(() => undefined); }
      catch { destroyPromise = Promise.resolve(); }
    }
    return destroyPromise;
  };
  const onAbort = () => { void destroy(); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    // Pass bytes only: PDF.js must never fetch a URL or other resource for a Research source.
    loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false, stopAtErrors: true, useWorkerFetch: false });
    if (!loadingTask?.promise || typeof loadingTask.promise.then !== 'function') throw new Error('Obsidian PDF.js returned an invalid loading task.');
    pdf = await awaitWithAbort(loadingTask.promise, signal);
    if (signal?.aborted) throw new Error('PDF preview was cancelled.');
    const pageCount = Number(pdf?.numPages);
    if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new Error('The selected PDF has no readable pages.');
    const selectedPages = parsePdfPageRange(pageRange, pageCount, Math.min(maxSelectedPages, RESEARCH_PDF_LIMITS.pagesPerFile));
    let pageLabels = [];
    if (pageCount <= 2_000) {
      try {
        const labels = await awaitWithAbort(pdf.getPageLabels?.() || [], signal);
        pageLabels = Array.isArray(labels) ? labels : [];
      } catch (error) {
        if (signal?.aborted) throw error;
        pageLabels = [];
      }
    }
    const pages = [];
    let extractedChars = 0;
    for (let index = 0; index < selectedPages.length; index++) {
      const pageNumber = selectedPages[index];
      if (signal?.aborted) throw new Error('PDF preview was cancelled.');
      try { onProgress?.({ currentPage: pageNumber, completedPages: index, totalPages: selectedPages.length }); } catch { /* Progress reporting must not compromise extraction. */ }
      if (signal?.aborted) throw new Error('PDF preview was cancelled.');
      const page = await awaitWithAbort(pdf.getPage(pageNumber), signal);
      const content = await awaitWithAbort(page.getTextContent(), signal);
      const text = pageText(content?.items || [], RESEARCH_PDF_LIMITS.extractedCharsPerFile - extractedChars);
      extractedChars += text.length;
      if (text) pages.push({ pageNumber, ...(typeof pageLabels[pageNumber - 1] === 'string' && pageLabels[pageNumber - 1].trim()
        ? { pageLabel: pageLabels[pageNumber - 1].trim().slice(0, 100) } : {}), text });
    }
    if (signal?.aborted) throw new Error('PDF preview was cancelled.');
    if (!pages.length) throw new Error('No selectable text was found on the selected PDF pages. Scanned pages need OCR or Zotero annotations.');
    return { pageCount, selectedPageCount: selectedPages.length, pages };
  } catch (error) {
    if (signal?.aborted) throw new Error('PDF preview was cancelled.');
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await destroy();
    try { pdf?.cleanup?.(); } catch { /* PDF.js cleanup is best-effort after its worker closes. */ }
  }
}

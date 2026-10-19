import { it, expect } from 'vitest';
import { extractPdfPages, parsePdfPageRange, RESEARCH_PDF_LIMITS } from '../workflow/research-pdf.mjs';

function fakePdf(pages, labels = []) {
  const requested = [];
  const destroyed = { value: 0 };
  return {
    requested,
    destroyed,
    api: { getDocument: options => {
      expect(options.data).toBeInstanceOf(Uint8Array);
      expect(options).toMatchObject({ isEvalSupported: false, stopAtErrors: true, useWorkerFetch: false });
      return { promise: Promise.resolve({ numPages: pages.length,
        getPageLabels: async () => labels,
        getPage: async pageNumber => { requested.push(pageNumber); return { getTextContent: pages[pageNumber - 1] }; },
      }), destroy: async () => { destroyed.value++; } };
    } },
  };
}

it('parses explicit ranges, de-duplicates overlap, and enforces per-file page limits', () => {
  expect(parsePdfPageRange(' 1-3, 3-5, 8 ', 10, 6)).toEqual([1, 2, 3, 4, 5, 8]);
  expect(() => parsePdfPageRange('', 121)).toThrow('explicit page range');
  expect(() => parsePdfPageRange('0, 2', 10)).toThrow('outside');
  expect(() => parsePdfPageRange('1-4, 8-10', 10, 6)).toThrow('no more than 6');
});

it('rejects extraction when the whole source set has exhausted its page budget', async () => {
  let opened = false;
  const pdfjs = { getDocument: () => { opened = true; throw new Error('must not open'); } };
  await expect(extractPdfPages(pdfjs, new Uint8Array([1]), '', undefined, 0)).rejects.toThrow('No PDF page budget remains');
  expect(opened).toBe(false);
});

it('extracts exactly 120 pages per PDF and allows a second PDF only within the remaining 240-page source-set budget', async () => {
  const pages = Array.from({ length: 121 }, (_unused, index) => async () => ({ items: [{ str: 'Synthetic page ' + (index + 1) + '.' }] }));
  const firstPdf = fakePdf(pages);
  await expect(extractPdfPages(firstPdf.api, new Uint8Array([1]))).rejects.toThrow('explicit page range of at most 120 pages');
  expect(firstPdf.requested).toEqual([]);

  const first = await extractPdfPages(firstPdf.api, new Uint8Array([1]), '1-120', undefined, RESEARCH_PDF_LIMITS.pagesPerFile);
  expect(first.selectedPageCount).toBe(120);
  expect(firstPdf.requested).toHaveLength(120);

  const remainingPages = RESEARCH_PDF_LIMITS.pagesTotal - first.selectedPageCount;
  const secondPdf = fakePdf(pages);
  const second = await extractPdfPages(secondPdf.api, new Uint8Array([2]), '1-120', undefined, remainingPages);
  expect(first.selectedPageCount + second.selectedPageCount).toBe(240);
  expect(secondPdf.requested).toHaveLength(120);

  const exhaustedPdf = fakePdf(pages);
  await expect(extractPdfPages(exhaustedPdf.api, new Uint8Array([3]), '1', undefined, 0)).rejects.toThrow('No PDF page budget remains');
  expect(exhaustedPdf.requested).toEqual([]);
});

it('extracts only selected pages with PDF page labels and closes the host worker', async () => {
  const pdf = fakePdf([
    async () => ({ items: [{ str: 'First page must not enter evidence.' }] }),
    async () => ({ items: [{ str: 'Selected source text', hasEOL: true }, { str: 'continued.' }] }),
  ], ['i', '12']);
  const result = await extractPdfPages(pdf.api, new Uint8Array([1, 2, 3]), '2');
  expect(result).toEqual({ pageCount: 2, selectedPageCount: 1, pages: [{ pageNumber: 2, pageLabel: '12', text: 'Selected source text\ncontinued.' }] });
  expect(pdf.requested).toEqual([2]);
  expect(pdf.destroyed.value).toBe(1);
});

it('reports progress only for explicitly selected pages', async () => {
  const pdf = fakePdf([
    async () => ({ items: [{ str: 'Page one.' }] }),
    async () => ({ items: [{ str: 'Page two.' }] }),
    async () => ({ items: [{ str: 'Page three.' }] }),
  ]);
  const progress = [];
  const result = await extractPdfPages(pdf.api, new Uint8Array([1]), '2-3', undefined, undefined, update => progress.push(update));
  expect(result.pages.map(page => page.pageNumber)).toEqual([2, 3]);
  expect(progress).toEqual([
    { currentPage: 2, completedPages: 0, totalPages: 2 },
    { currentPage: 3, completedPages: 1, totalPages: 2 },
  ]);
  expect(pdf.requested).toEqual([2, 3]);
});

it('rejects oversized, unsupported and image-only inputs with bounded diagnostics', async () => {
  await expect(extractPdfPages({}, new Uint8Array([1]))).rejects.toThrow('unavailable');
  await expect(extractPdfPages({ getDocument() {} }, new Uint8Array(RESEARCH_PDF_LIMITS.bytesPerFile + 1))).rejects.toThrow('12,000,000');
  const empty = fakePdf([async () => ({ items: [{ str: '' }] })]);
  await expect(extractPdfPages(empty.api, new Uint8Array([1]))).rejects.toThrow('No selectable text');
  expect(empty.destroyed.value).toBe(1);
});

it('stops extracting immediately when a selected page exceeds the text budget', async () => {
  const pdf = fakePdf([async () => ({ items: [{ str: 'x'.repeat(RESEARCH_PDF_LIMITS.extractedCharsPerFile + 1) }] })]);
  await expect(extractPdfPages(pdf.api, new Uint8Array([1]))).rejects.toThrow('100,000-character');
  expect(pdf.destroyed.value).toBe(1);
});

it('cancels deterministically while a selected page is still loading', async () => {
  let pageStarted;
  const started = new Promise(resolve => { pageStarted = resolve; });
  let destroyCount = 0;
  const never = new Promise(() => {});
  const pdfjs = { getDocument: () => ({
    promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: () => { pageStarted(); return never; } }) }),
    destroy: async () => { destroyCount++; },
  }) };
  const controller = new AbortController();
  const operation = extractPdfPages(pdfjs, new Uint8Array([1]), '', controller.signal);
  await started;
  controller.abort();
  await expect(operation).rejects.toThrow('cancelled');
  expect(destroyCount).toBe(1);
});

export const RESEARCH_PDF_LIMITS: Readonly<{ bytesPerFile: number; pagesPerFile: number; pagesTotal: number; extractedCharsPerFile: number }>;
export interface ResearchPdfPage { pageNumber: number; pageLabel?: string; text: string; }
export interface ResearchPdfResult { pageCount: number; selectedPageCount: number; pages: ResearchPdfPage[]; }
export function parsePdfPageRange(value: string, pageCount: number, maxPages?: number): number[];
export function extractPdfPages(pdfjs: unknown, bytes: Uint8Array, pageRange?: string, signal?: AbortSignal, maxSelectedPages?: number): Promise<ResearchPdfResult>;

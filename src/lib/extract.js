import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_CHARS = 85000;

function trimText(text) {
  const normalized = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return normalized.length > MAX_CHARS
    ? normalized.slice(0, MAX_CHARS) + "\n\n[Content truncated to fit the evaluation request.]"
    : normalized;
}

export async function extractDocument(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "txt" || extension === "md") {
    return trimText(await file.text());
  }

  if (extension === "pdf") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str || "").join(" ");
      pages.push(`[PAGE ${pageNumber}]\n${text}`);
    }
    const extracted = trimText(pages.join("\n\n"));
    if (!extracted.replace(/\[PAGE \d+\]/g, "").trim()) {
      throw new Error("This PDF appears to be scanned or image-only. This first version extracts selectable PDF text; OCR support is not enabled yet.");
    }
    return extracted;
  }

  if (extension === "pptx") {
    const zip = await JSZip.loadAsync(file);
    const slidePaths = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
    const slides = [];
    for (let index = 0; index < slidePaths.length; index += 1) {
      const xml = await zip.file(slidePaths[index]).async("text");
      const document = new DOMParser().parseFromString(xml, "application/xml");
      const text = [...document.getElementsByTagName("a:t")].map((node) => node.textContent || "").join(" ");
      slides.push(`[SLIDE ${index + 1}]\n${text}`);
    }
    return trimText(slides.join("\n\n"));
  }

  throw new Error("Unsupported file type. Upload PDF, PPTX, TXT, or Markdown.");
}
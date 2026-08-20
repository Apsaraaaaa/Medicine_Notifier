/**
 * A very small PDF writer.
 *
 * Why hand-rolled: the app already exports CSV through expo-file-system and
 * expo-sharing, and a report you can hand to a doctor needs to be a PDF. The
 * usual route is a rendering library, but PDF's own text operators cover
 * headings, paragraphs, rules and tables — which is the entire report — so the
 * format is written directly and no dependency is added for it.
 *
 * The subset used here is deliberate:
 *
 *   * the base-14 fonts (Helvetica), which every reader has built in, so no
 *     font file has to be embedded
 *   * uncompressed content streams, so the xref offsets below are simply
 *     character positions
 *   * WinAnsi encoding, and ASCII-only content
 *
 * That last point matters more than it looks. `File.write` encodes as UTF-8, so
 * a character above U+007F would occupy two bytes while `String.length` counts
 * it as one — and every `/Length` and xref offset below would then point at the
 * wrong byte and produce a file no reader will open. `sanitize` guarantees one
 * byte per character, which is also why a report is titled and labelled in
 * English (see `reportToPdf`): Devanagari would need an embedded font, the one
 * thing this writer deliberately does not do.
 */

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export type PdfFont = "regular" | "bold";

/** One drawing instruction. Everything the report needs, and nothing else. */
export type PdfBlock =
  | { kind: "heading"; text: string; size?: number }
  | { kind: "text"; text: string; size?: number; font?: PdfFont; indent?: number }
  | { kind: "row"; cells: string[]; widths: number[]; font?: PdfFont; size?: number }
  | { kind: "rule" }
  | { kind: "gap"; height?: number }
  | { kind: "pageBreak" };

/**
 * One byte per character, plus PDF's own escapes.
 *
 * Typography that has an ASCII equivalent is folded to it; accented letters
 * lose their accent rather than the whole word; anything else (Devanagari,
 * emoji) is dropped. See the file header for why this is not negotiable.
 *
 * The three escapes run last, on purpose: a backslash introduced by escaping
 * must not itself be escaped again.
 */
function sanitize(value: string): string {
  return String(value ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[·•]/g, "-")
    // Decompose so "é" becomes "e" + a combining mark, which the strip below
    // then removes — the letter survives where it would otherwise vanish.
    .normalize("NFD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Width of a string in points.
 *
 * Helvetica's real metrics would be a 224-entry table per font; the average
 * advance is within a few percent across the characters a report actually
 * contains (digits, latin letters, spaces), and it is only used to decide
 * where to wrap. Bold is very slightly wider.
 */
function textWidth(text: string, size: number, font: PdfFont): number {
  return text.length * size * (font === "bold" ? 0.55 : 0.5);
}

function wrap(text: string, size: number, font: PdfFont, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, font) <= width || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Clips a cell to its column so a long medicine name can't run into the next. */
function clip(text: string, size: number, font: PdfFont, width: number): string {
  if (textWidth(text, size, font) <= width) return text;
  let cut = text;
  while (cut.length > 1 && textWidth(`${cut}...`, size, font) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

class Page {
  ops: string[] = [];
  y = PAGE_HEIGHT - MARGIN;

  fits(height: number): boolean {
    return this.y - height >= MARGIN;
  }

  write(text: string, x: number, size: number, font: PdfFont) {
    this.ops.push(
      `BT /${font === "bold" ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${this.y.toFixed(2)} Td (${sanitize(text)}) Tj ET`
    );
  }

  line(y: number) {
    this.ops.push(
      `0.85 0.85 0.9 RG 0.8 w ${MARGIN} ${y.toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(2)} ${y.toFixed(2)} l S`
    );
  }
}

function layout(blocks: PdfBlock[]): Page[] {
  const pages: Page[] = [new Page()];
  let page = pages[0];

  const nextPage = () => {
    page = new Page();
    pages.push(page);
    return page;
  };

  for (const block of blocks) {
    if (block.kind === "pageBreak") {
      if (page.ops.length) nextPage();
      continue;
    }

    if (block.kind === "gap") {
      page.y -= block.height ?? 10;
      continue;
    }

    if (block.kind === "rule") {
      if (!page.fits(12)) nextPage();
      page.y -= 6;
      page.line(page.y);
      page.y -= 8;
      continue;
    }

    if (block.kind === "row") {
      const size = block.size ?? 10;
      const font = block.font ?? "regular";
      if (!page.fits(size + 8)) nextPage();
      page.y -= size + 4;
      let x = MARGIN;
      block.cells.forEach((cell, i) => {
        const width = (block.widths[i] ?? 1) * CONTENT_WIDTH;
        page.write(clip(cell, size, font, width - 6), x, size, font);
        x += width;
      });
      continue;
    }

    const heading = block.kind === "heading";
    const size = block.size ?? (heading ? 15 : 10.5);
    const font: PdfFont = heading ? "bold" : (block.font ?? "regular");
    const indent = block.kind === "text" ? (block.indent ?? 0) : 0;
    const lines = wrap(block.text, size, font, CONTENT_WIDTH - indent);

    if (heading) page.y -= 8;
    for (const text of lines) {
      const lineHeight = size * 1.5;
      if (!page.fits(lineHeight)) nextPage();
      page.y -= lineHeight;
      page.write(text, MARGIN + indent, size, font);
    }
    if (heading) page.y -= 4;
  }

  return pages;
}

/**
 * The finished document as a string.
 *
 * Objects are emitted in order and their byte offsets recorded as they go,
 * because the xref table at the end has to point at each one exactly. Since
 * everything written is Latin-1, a character index *is* a byte offset.
 */
export function buildPdf(blocks: PdfBlock[], title = "Report"): string {
  const pages = layout(blocks);
  const objects: string[] = [];

  const pageIds = pages.map((_, i) => 4 + i * 2);
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");

  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`
  );
  objects.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
  );

  pages.forEach((page, i) => {
    const contentId = pageIds[i] + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 ${3 + pages.length * 2 + 1} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`
    );
    const stream = page.ops.join("\n");
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`
  );
  objects.push(`<< /Title (${sanitize(title)}) /Producer (Medicine Notifier) >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;

  return pdf;
}

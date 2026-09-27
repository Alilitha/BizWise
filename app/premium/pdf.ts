import type { jsPDF as JsPdf } from 'jspdf';
import type { CanvasBlock, Textbook } from '../adviser/shared';
import type { BusinessMetrics, Kpis } from './metrics';

const PAGE = { width: 210, height: 297, margin: 20 };
const INK: [number, number, number] = [19, 33, 46];
const ACCENT: [number, number, number] = [36, 75, 219];
const MUTED: [number, number, number] = [96, 110, 125];

// The built-in PDF fonts only cover Latin-1, so typographic characters are mapped rather than dropped.
export const pdfSafe = (value: string) => value
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[•·]/g, '-')
  .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '');
export const rand = (value: number) => `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number | null) => value === null ? 'Not enough data' : `${(value * 100).toFixed(1)}%`;

export function kpiRows(kpis: Kpis): [string, string, string][] {
  return [
    ['Collection rate', percent(kpis.collectionRate), 'Payments received on completed jobs / amount charged'],
    ['Direct-cost margin', percent(kpis.directMargin), '(Charged - parts and other direct costs) / charged. Not net profit.'],
    ['Average job value', kpis.averageJobValue === null ? 'Not enough data' : rand(kpis.averageJobValue), 'Amount charged / completed jobs'],
    ['Repeat customer rate', percent(kpis.repeatCustomerRate), 'Customers with 2+ completed jobs / customers linked to jobs'],
    ['Enquiry-to-booking conversion', percent(kpis.enquiryToBooking), 'Owner-reported bookings / enquiries on saved actions'],
    ['Average feedback rating', kpis.averageRating === null ? 'Not enough data' : `${kpis.averageRating.toFixed(1)} / 5`, 'Mean of rated customer feedback'],
  ];
}

class Writer {
  y = PAGE.margin;
  constructor(readonly doc: JsPdf) {}
  get width() { return PAGE.width - PAGE.margin * 2; }
  page() { this.doc.addPage(); this.y = PAGE.margin; }
  ensure(height: number) { if (this.y + height > PAGE.height - PAGE.margin - 8) this.page(); }
  text(value: string, { size = 11, bold = false, color = INK, gap = 2, indent = 0 }: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number; indent?: number } = {}) {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...color);
    const lineHeight = size * 0.45;
    for (const line of this.doc.splitTextToSize(pdfSafe(value), this.width - indent) as string[]) {
      this.ensure(lineHeight);
      this.doc.text(line, PAGE.margin + indent, this.y + lineHeight * 0.8);
      this.y += lineHeight;
    }
    this.y += gap;
  }
  rule() { this.ensure(4); this.doc.setDrawColor(223, 230, 240).line(PAGE.margin, this.y, PAGE.width - PAGE.margin, this.y); this.y += 4; }
  table(head: string[], rows: string[][], widths: number[]) {
    const draw = (cells: string[], bold: boolean) => {
      this.doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(9).setTextColor(...INK);
      const wrapped = cells.map((cell, index) => this.doc.splitTextToSize(pdfSafe(cell), widths[index] - 2) as string[]);
      const height = Math.max(...wrapped.map(lines => lines.length)) * 4.2 + 2;
      this.ensure(height);
      let x = PAGE.margin;
      wrapped.forEach((lines, index) => { this.doc.text(lines, x, this.y + 4); x += widths[index]; });
      this.y += height;
      this.doc.setDrawColor(223, 230, 240).line(PAGE.margin, this.y - 1, PAGE.width - PAGE.margin, this.y - 1);
    };
    draw(head, true);
    rows.forEach(row => draw(row, false));
    this.y += 4;
  }
}

function footers(doc: JsPdf, title: string, skipFirst: boolean) {
  const total = doc.getNumberOfPages();
  for (let page = skipFirst ? 2 : 1; page <= total; page++) {
    doc.setPage(page).setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
    doc.text(pdfSafe(title), PAGE.margin, PAGE.height - 10);
    doc.text(`Page ${page} of ${total}`, PAGE.width - PAGE.margin, PAGE.height - 10, { align: 'right' });
  }
}

function recordsSection(w: Writer, metrics: BusinessMetrics) {
  w.table(['Indicator', 'Value', 'How it is calculated'], kpiRows(metrics.kpis), [48, 34, 88]);
  w.text('Monthly performance', { size: 13, bold: true, gap: 3 });
  w.table(['Month', 'Jobs', 'Charged', 'Direct costs', 'Received', 'New / returning', 'Growth'],
    metrics.months.map(month => [month.key, String(month.jobs), rand(month.charged), rand(month.directCosts), rand(month.collected), `${month.newCustomers} / ${month.returningCustomers}`, month.growthPct === null ? '-' : `${(month.growthPct * 100).toFixed(1)}%`]),
    [20, 12, 30, 28, 28, 26, 26]);
  w.text('Quarterly performance', { size: 13, bold: true, gap: 3 });
  w.table(['Quarter', 'Jobs', 'Charged', 'Growth vs previous quarter'], metrics.quarters.map(quarter => [quarter.label, String(quarter.jobs), rand(quarter.charged), quarter.growthPct === null ? '-' : `${(quarter.growthPct * 100).toFixed(1)}%`]), [55, 20, 40, 55]);
  w.text('Figures are calculated from completed jobs dated up to today, payments and feedback saved in BizWise. The current month is partial. Amounts charged are not cash received, and direct-cost margin is not net profit: rent, wages, tax and other overheads are not recorded.', { size: 9, color: MUTED });
}

async function newDoc() {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ unit: 'mm', format: 'a4' });
}
const fileName = (shop: string, kind: string) => `${shop.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'bizwise'}-${kind}-${new Date().toISOString().slice(0, 10)}.pdf`;

export async function downloadProgressReport(shop: string, metrics: BusinessMetrics) {
  const doc = await newDoc();
  const w = new Writer(doc);
  w.text('BIZWISE PREMIUM', { size: 9, bold: true, color: ACCENT });
  w.text(`${shop}: business progress report`, { size: 20, bold: true, gap: 1 });
  w.text(`Prepared ${new Date().toLocaleString('en-ZA')} from saved records. No AI-generated figures.`, { size: 9, color: MUTED, gap: 5 });
  recordsSection(w, metrics);
  footers(doc, `${shop} progress report`, false);
  doc.save(fileName(shop, 'progress-report'));
}

const CANVAS_LABELS: Record<CanvasBlock, string> = {
  key_partners: 'Key partners', key_activities: 'Key activities', key_resources: 'Key resources', value_propositions: 'Value propositions',
  customer_relationships: 'Customer relationships', channels: 'Channels', customer_segments: 'Customer segments', cost_structure: 'Cost structure', revenue_streams: 'Revenue streams',
};
const CANVAS_GRID: CanvasBlock[][] = [['key_partners', 'key_activities', 'value_propositions'], ['key_resources', 'customer_relationships', 'channels'], ['customer_segments', 'cost_structure', 'revenue_streams']];

function canvasPage(w: Writer, canvas: Textbook['canvas']) {
  w.page();
  w.text('Your business model canvas', { size: 16, bold: true, gap: 4 });
  const cellWidth = w.width / 3; const cellHeight = 72;
  CANVAS_GRID.forEach((row, rowIndex) => row.forEach((block, colIndex) => {
    const x = PAGE.margin + colIndex * cellWidth; const top = w.y + rowIndex * cellHeight;
    w.doc.setDrawColor(200, 210, 225).setFillColor(247, 249, 253).roundedRect(x + 1, top, cellWidth - 2, cellHeight - 2, 2, 2, 'FD');
    w.doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACCENT).text(CANVAS_LABELS[block], x + 4, top + 6);
    w.doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...INK);
    let lineY = top + 12;
    for (const item of canvas[block]) for (const line of w.doc.splitTextToSize(`- ${pdfSafe(item)}`, cellWidth - 8) as string[]) {
      if (lineY < top + cellHeight - 5) w.doc.text(line, x + 4, lineY);
      lineY += 3.6;
    }
  }));
  w.y += cellHeight * 3;
}

export async function downloadTextbook(shop: string, book: Textbook, metrics: BusinessMetrics) {
  const doc = await newDoc();
  const w = new Writer(doc);
  doc.setFillColor(...ACCENT).rect(0, 0, PAGE.width, 110, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(255, 255, 255).text('BIZWISE PREMIUM MASTERCLASS', PAGE.margin, 40);
  doc.setFontSize(26).text(doc.splitTextToSize(pdfSafe(book.title), w.width), PAGE.margin, 56);
  doc.setFont('helvetica', 'normal').setFontSize(12).text(pdfSafe(`Prepared for ${shop}`), PAGE.margin, 92);
  w.y = 130;
  w.text(`Generated ${new Date().toLocaleDateString('en-ZA')}. Chapters 1 to 4 are AI-drafted education tailored to your business type and services; they contain no figures from your records. The appendix is calculated from your saved records. Review everything before acting, and consult a qualified professional for legal, tax or financing decisions.`, { size: 10, color: MUTED });

  w.page();
  const contentsPage = doc.getNumberOfPages();
  const entries: { title: string; page: number }[] = [];
  book.chapters.forEach((chapter, index) => {
    w.page();
    entries.push({ title: `${index + 1}. ${chapter.title}`, page: doc.getNumberOfPages() });
    w.text(`CHAPTER ${index + 1}`, { size: 9, bold: true, color: ACCENT, gap: 1 });
    w.text(chapter.title, { size: 18, bold: true, gap: 3 });
    w.text(chapter.summary, { size: 11, color: MUTED, gap: 5 });
    if (index === 0) { canvasPage(w, book.canvas); w.page(); }
    for (const section of chapter.sections) {
      w.ensure(20);
      w.text(section.heading, { size: 13, bold: true, gap: 2 });
      section.paragraphs.forEach(paragraph => w.text(paragraph, { size: 10.5, gap: 3 }));
      if (section.checklist.length) {
        w.text('Action checklist', { size: 10, bold: true, color: ACCENT, gap: 1 });
        section.checklist.forEach(item => w.text(`[  ]  ${item}`, { size: 10, indent: 4, gap: 1 }));
        w.y += 2;
      }
      w.rule();
    }
  });
  w.page();
  entries.push({ title: 'Appendix. Your records at a glance', page: doc.getNumberOfPages() });
  w.text('APPENDIX', { size: 9, bold: true, color: ACCENT, gap: 1 });
  w.text('Your records at a glance', { size: 18, bold: true, gap: 4 });
  recordsSection(w, metrics);

  doc.setPage(contentsPage);
  w.y = PAGE.margin + 10;
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...INK).text('Contents', PAGE.margin, w.y);
  w.y += 14;
  for (const entry of entries) {
    doc.setFont('helvetica', 'normal').setFontSize(12).setTextColor(...INK);
    doc.text(pdfSafe(entry.title), PAGE.margin, w.y);
    doc.text(String(entry.page), PAGE.width - PAGE.margin, w.y, { align: 'right' });
    doc.setDrawColor(223, 230, 240).line(PAGE.margin, w.y + 2.5, PAGE.width - PAGE.margin, w.y + 2.5);
    w.y += 11;
  }
  footers(doc, book.title, true);
  doc.save(fileName(shop, 'masterclass'));
}

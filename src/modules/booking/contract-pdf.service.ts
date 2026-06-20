import { existsSync } from "fs";
import { join } from "path";
import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

/** Сторона договора. */
export interface ContractParty {
  /** ФИО физлица либо наименование ИП/ООО. */
  name: string;
  /** "Физическое лицо" | "Индивидуальный предприниматель" | "ООО ...". */
  legalLabel: string;
  inn?: string;
  ogrn?: string;
  address?: string;
  phone?: string;
}

export interface ContractEquipment {
  title: string;
  description: string;
  units: number;
  pricePerDay: number;
}

export interface ContractData {
  bookingId: string;
  /** Арендатор (физлицо). */
  renter: ContractParty;
  /** Арендодатель (физлицо/ИП/ООО). */
  owner: ContractParty;
  /** Агент — ИП-владелец платформы. */
  agent: ContractParty;
  equipment: ContractEquipment;
  dateFrom: string;
  dateTo: string;
  days: number;
  totalPrice: number;
  /** Способ получения оборудования (текст). */
  pickupMethod: string;
  /** Дата составления. */
  issuedAt: Date;
}

/**
 * Реальная генерация PDF-договоров через pdfkit.
 * Шрифт DejaVuSans подключается для поддержки кириллицы
 * (встроенные шрифты pdfkit кириллицу не поддерживают).
 */
@Injectable()
export class ContractPdfService {
  private readonly fontRegular: string;
  private readonly fontBold: string;

  constructor() {
    // Шрифты копируются в dist при сборке (см. nest-cli.json assets).
    // Ищем сначала рядом со скомпилированным кодом (dist), затем в src (dev/ts-node).
    this.fontRegular = this.resolveFont("DejaVuSans.ttf");
    this.fontBold = this.resolveFont("DejaVuSans-Bold.ttf");
  }

  private resolveFont(fileName: string): string {
    const candidates = [
      join(__dirname, "..", "..", "assets", "fonts", fileName), // dist/assets/fonts
      join(process.cwd(), "dist", "assets", "fonts", fileName),
      join(process.cwd(), "src", "assets", "fonts", fileName),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    // Возврат первого пути — pdfkit бросит понятную ошибку при отсутствии файла.
    return candidates[0];
  }

  /** Договор аренды между Арендатором и Арендодателем. */
  generateRentalAgreement(data: ContractData): Promise<Buffer> {
    return this.render((doc) => {
      this.title(doc, "ДОГОВОР АРЕНДЫ ОБОРУДОВАНИЯ");
      this.meta(doc, data.bookingId, data.issuedAt);

      doc.moveDown(0.5);
      this.paragraph(
        doc,
        `${data.owner.legalLabel} ${data.owner.name}` +
          this.requisites(data.owner) +
          `, именуемый в дальнейшем «Арендодатель», с одной стороны, и ` +
          `${data.renter.legalLabel} ${data.renter.name}` +
          this.requisites(data.renter) +
          `, именуемый в дальнейшем «Арендатор», с другой стороны, ` +
          `заключили настоящий договор о нижеследующем.`,
      );

      this.section(doc, "1. Предмет договора");
      this.paragraph(
        doc,
        `1.1. Арендодатель предоставляет Арендатору во временное пользование ` +
          `оборудование: «${data.equipment.title}» (${data.equipment.description}) ` +
          `в количестве ${data.equipment.units} ед.`,
      );
      this.paragraph(
        doc,
        `1.2. Стоимость аренды за единицу — ${data.equipment.pricePerDay} руб. в сутки.`,
      );

      this.section(doc, "2. Срок аренды");
      this.paragraph(
        doc,
        `2.1. Срок аренды: с ${this.fmtDate(data.dateFrom)} по ${this.fmtDate(
          data.dateTo,
        )} (${data.days} сут.).`,
      );

      this.section(doc, "3. Стоимость и порядок расчётов");
      this.paragraph(
        doc,
        `3.1. Итоговая стоимость аренды составляет ${data.totalPrice} руб. ` +
          `(${data.equipment.pricePerDay} руб. × ${data.days} сут. × ${data.equipment.units} ед.).`,
      );
      this.paragraph(
        doc,
        `3.2. Расчёты между Сторонами осуществляются через Агента — ${data.agent.legalLabel} ` +
          `${data.agent.name}${this.requisites(data.agent)} — на основании отдельного агентского договора.`,
      );

      this.section(doc, "4. Передача оборудования");
      this.paragraph(doc, `4.1. Способ получения оборудования: ${data.pickupMethod}.`);
      this.paragraph(
        doc,
        `4.2. Арендатор обязуется вернуть оборудование в исправном состоянии ` +
          `с учётом нормального износа по окончании срока аренды.`,
      );

      this.section(doc, "5. Реквизиты и подписи сторон");
      this.signatures(doc, "Арендодатель", data.owner, "Арендатор", data.renter);
    });
  }

  /** Агентский договор между Арендодателем и ИП-владельцем платформы. */
  generateAgencyAgreement(data: ContractData): Promise<Buffer> {
    const commission = Math.round(data.totalPrice * 0); // эквайринг позже; пока 0%.
    return this.render((doc) => {
      this.title(doc, "АГЕНТСКИЙ ДОГОВОР");
      this.meta(doc, data.bookingId, data.issuedAt);

      doc.moveDown(0.5);
      this.paragraph(
        doc,
        `${data.agent.legalLabel} ${data.agent.name}` +
          this.requisites(data.agent) +
          `, именуемый в дальнейшем «Агент», с одной стороны, и ` +
          `${data.owner.legalLabel} ${data.owner.name}` +
          this.requisites(data.owner) +
          `, именуемый в дальнейшем «Принципал», с другой стороны, ` +
          `заключили настоящий договор о нижеследующем.`,
      );

      this.section(doc, "1. Предмет договора");
      this.paragraph(
        doc,
        `1.1. Агент обязуется за вознаграждение совершать от своего имени, но за счёт ` +
          `Принципала действия по приёму платежей от арендаторов и их перечислению ` +
          `Принципалу по сделке аренды оборудования «${data.equipment.title}».`,
      );

      this.section(doc, "2. Расчёты и вознаграждение");
      this.paragraph(
        doc,
        `2.1. Сумма по сделке аренды: ${data.totalPrice} руб.`,
      );
      this.paragraph(
        doc,
        `2.2. Агентское вознаграждение: ${commission} руб. ` +
          `(удерживается Агентом при перечислении средств Принципалу).`,
      );
      this.paragraph(
        doc,
        `2.3. Агент перечисляет Принципалу денежные средства за вычетом вознаграждения ` +
          `на реквизиты, указанные Принципалом.`,
      );

      this.section(doc, "3. Срок действия");
      this.paragraph(
        doc,
        `3.1. Договор действует на период исполнения сделки аренды ` +
          `с ${this.fmtDate(data.dateFrom)} по ${this.fmtDate(data.dateTo)}.`,
      );

      this.section(doc, "4. Реквизиты и подписи сторон");
      this.signatures(doc, "Агент", data.agent, "Принципал", data.owner);
    });
  }

  // ---------- Низкоуровневые помощники рендеринга ----------

  private render(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.registerFont("regular", this.fontRegular);
        doc.registerFont("bold", this.fontBold);
        doc.font("regular").fontSize(11);

        draw(doc);
        doc.end();
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  private title(doc: PDFKit.PDFDocument, text: string): void {
    doc.font("bold").fontSize(16).text(text, { align: "center" });
    doc.font("regular").fontSize(11);
  }

  private meta(doc: PDFKit.PDFDocument, bookingId: string, issuedAt: Date): void {
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .fillColor("#555")
      .text(`№ ${bookingId} от ${this.fmtDate(issuedAt.toISOString())}`, {
        align: "center",
      });
    doc.fillColor("#000").fontSize(11);
  }

  private section(doc: PDFKit.PDFDocument, text: string): void {
    doc.moveDown(0.6);
    doc.font("bold").fontSize(12).text(text);
    doc.font("regular").fontSize(11);
    doc.moveDown(0.2);
  }

  private paragraph(doc: PDFKit.PDFDocument, text: string): void {
    doc.text(text, { align: "justify" });
    doc.moveDown(0.3);
  }

  private requisites(party: ContractParty): string {
    const parts: string[] = [];
    if (party.inn) parts.push(`ИНН ${party.inn}`);
    if (party.ogrn) parts.push(`ОГРН/ОГРНИП ${party.ogrn}`);
    if (party.address) parts.push(`адрес: ${party.address}`);
    if (party.phone) parts.push(`тел.: ${party.phone}`);
    return parts.length ? ` (${parts.join(", ")})` : "";
  }

  private signatures(
    doc: PDFKit.PDFDocument,
    leftLabel: string,
    left: ContractParty,
    rightLabel: string,
    right: ContractParty,
  ): void {
    doc.moveDown(1);
    const y = doc.y;
    doc.font("bold").fontSize(10);
    doc.text(`${leftLabel}:`, 50, y);
    doc.text(`${rightLabel}:`, 320, y);
    doc.font("regular").fontSize(10);
    doc.text(`${left.name}`, 50, y + 16, { width: 240 });
    doc.text(`${right.name}`, 320, y + 16, { width: 240 });
    doc.text("_________________ / подпись /", 50, y + 50);
    doc.text("_________________ / подпись /", 320, y + 50);
  }

  private fmtDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
}

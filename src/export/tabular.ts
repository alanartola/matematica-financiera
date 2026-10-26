/**
 * Exportación de tablas a CSV y a Excel (.xlsx).
 *
 * El archivo .xlsx se genera sin bibliotecas de terceros salvo `fflate` (ZIP):
 * contiene el mínimo de partes OpenXML (libro, hoja, estilos) con celdas
 * numéricas reales, de modo que Excel/LibreOffice pueden recalcular con ellas.
 */
import { strToU8, zipSync } from 'fflate';

export type ColumnType = 'text' | 'int' | 'money' | 'percent' | 'number';

export interface Column {
  header: string;
  type: ColumnType;
}

export interface Table {
  name: string;
  columns: Column[];
  rows: (string | number | null)[][];
}

// ------------------------------------------------------------------ CSV

function csvCell(v: string | number | null, type: ColumnType): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    // Coma decimal y punto y coma como separador: formato regional de Argentina.
    const decimals = type === 'percent' ? 8 : type === 'int' ? 0 : type === 'money' ? 2 : 10;
    const fixed = type === 'number' ? String(v) : v.toFixed(decimals);
    return fixed.replace('.', ',');
  }
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con separador ";" y coma decimal (abre correctamente en Excel con configuración regional es-AR). */
export function toCsv(table: Table): string {
  const lines = [table.columns.map((c) => csvCell(c.header, 'text')).join(';')];
  for (const row of table.rows) lines.push(row.map((v, k) => csvCell(v, table.columns[k]?.type ?? 'text')).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ----------------------------------------------------------------- XLSX

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colName(k: number): string {
  let s = '';
  let n = k + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Índices de estilo definidos en styles.xml.
const STYLE: Record<ColumnType | 'header', number> = { header: 1, text: 0, int: 2, money: 3, percent: 4, number: 5 };

function sheetXml(table: Table): string {
  const widths = table.columns.map((c) => Math.max(10, Math.min(40, c.header.length + 2)));
  const cols = widths.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows: string[] = [];
  const header = table.columns.map((c, k) => `<c r="${colName(k)}1" t="inlineStr" s="${STYLE.header}"><is><t>${xmlEscape(c.header)}</t></is></c>`).join('');
  rows.push(`<row r="1">${header}</row>`);
  table.rows.forEach((row, i) => {
    const r = i + 2;
    const cells = row
      .map((v, k) => {
        const ref = `${colName(k)}${r}`;
        const type = table.columns[k]?.type ?? 'text';
        if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '';
        if (typeof v === 'number') return `<c r="${ref}" s="${STYLE[type]}"><v>${v}</v></c>`;
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
      })
      .join('');
    rows.push(`<row r="${r}">${cells}</row>`);
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${rows.join('')}</sheetData></worksheet>`
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0000%"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '</cellXfs></styleSheet>';

/** Libro .xlsx con una hoja por tabla. */
export function toXlsx(tables: Table[]): Uint8Array {
  const safeName = (s: string, k: number) => (s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Hoja${k + 1}`).trim();
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        tables
          .map(
            (_, k) =>
              `<Override PartName="/xl/worksheets/sheet${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        tables.map((t, k) => `<sheet name="${xmlEscape(safeName(t.name, k))}" sheetId="${k + 1}" r:id="rId${k + 1}"/>`).join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        tables
          .map(
            (_, k) =>
              `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${k + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(STYLES_XML),
  };
  tables.forEach((t, k) => (files[`xl/worksheets/sheet${k + 1}.xml`] = strToU8(sheetXml(t))));
  return zipSync(files, { level: 6 });
}

// ------------------------------------------------------------- Descarga

export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(table: Table, filename: string) {
  downloadBlob(toCsv(table), filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv;charset=utf-8');
}

export function downloadXlsx(tables: Table[], filename: string) {
  const bytes = toXlsx(tables);
  downloadBlob(
    bytes.slice().buffer,
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

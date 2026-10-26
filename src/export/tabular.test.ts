import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { toCsv, toXlsx, type Table } from './tabular';

const TABLE: Table = {
  name: 'Cuadro de marcha',
  columns: [
    { header: 'Cuota', type: 'int' },
    { header: 'Sistema', type: 'text' },
    { header: 'Interés', type: 'money' },
    { header: 'Tasa', type: 'percent' },
  ],
  rows: [
    [1, 'Francés', 300000, 0.03],
    [2, 'Alemán; "tramo"', 1234.5, 0.0291],
  ],
};

describe('exportación CSV', () => {
  it('usa punto y coma, coma decimal y BOM UTF-8', () => {
    const csv = toCsv(TABLE);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Cuota;Sistema;Interés;Tasa');
    expect(lines[1]).toBe('1;Francés;300000,00;0,03000000');
    expect(lines[2]).toBe('2;"Alemán; ""tramo""";1234,50;0,02910000');
  });
});

describe('exportación XLSX', () => {
  it('genera un paquete OpenXML válido con celdas numéricas', () => {
    const bytes = toXlsx([TABLE]);
    expect(bytes[0]).toBe(0x50); // "PK"
    expect(bytes[1]).toBe(0x4b);
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(
      ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'].sort(),
    );
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<c r="C2" s="3"><v>300000</v></c>');
    expect(sheet).toContain('Alemán; &quot;tramo&quot;');
    expect(strFromU8(files['xl/workbook.xml'])).toContain('name="Cuadro de marcha"');
  });
});

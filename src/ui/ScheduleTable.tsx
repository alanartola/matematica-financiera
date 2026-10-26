/**
 * Cuadro de marcha interactivo (fila seleccionable) con totales y exportación.
 * Las columnas y los valores provienen de `scheduleTable`, la misma fuente que
 * se exporta a CSV y Excel.
 */
import { useEffect, useRef } from 'react';
import type { ScheduleResult } from '../engine';
import { scheduleTable } from '../simulation/loans';
import { downloadCsv, downloadXlsx, type Table } from '../export/tabular';
import { fmtMoney, fmtNum, fmtPct } from './format';
import { Icon } from './icons';

function fmtCell(v: string | number | null, type: string): string {
  if (v === null || v === '') return '';
  if (typeof v === 'string') return v;
  if (type === 'money') return fmtMoney(v);
  if (type === 'percent') return fmtPct(v, 4);
  return fmtNum(v, 0);
}

export function ExportButtons({ tables, filename }: { tables: Table[]; filename: string }) {
  return (
    <div className="btn-row">
      <button type="button" className="btn small" onClick={() => downloadCsv(tables[0], filename)} title="Descargar en formato CSV (separador ;)">
        <Icon name="download" /> CSV
      </button>
      <button type="button" className="btn small" onClick={() => downloadXlsx(tables, filename)} title="Descargar libro de Excel (.xlsx)">
        <Icon name="download" /> Excel
      </button>
    </div>
  );
}

export function ScheduleTable({
  result,
  selected,
  onSelect,
  filename = 'cuadro-de-marcha',
  extraTables = [],
}: {
  result: ScheduleResult;
  selected?: number;
  onSelect?: (period: number) => void;
  filename?: string;
  extraTables?: Table[];
}) {
  const table = scheduleTable(result);
  const transitions = new Set(result.segments.slice(1).map((s) => s.from));
  const selRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  const idx = (header: string) => table.columns.findIndex((c) => c.header === header);
  const sumCols = ['Intereses', 'Amortización', 'Cuota total', 'Pago extraordinario'].map(idx);
  const totals = table.columns.map((_, k) => (sumCols.includes(k) ? table.rows.reduce((s, r) => s + (r[k] as number), 0) : null));

  return (
    <div className="stack">
      <div className="row">
        <span className="small muted">
          {result.rows.length} cuotas · Intereses totales {fmtMoney(result.totals.interest)}
        </span>
        <span className="spacer" />
        <ExportButtons tables={[table, ...extraTables]} filename={filename} />
      </div>
      <div className="table-wrap" style={{ maxHeight: 'min(60vh, 520px)' }}>
        <table className="data" data-testid="cuadro-de-marcha">
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c.header} className={c.type === 'text' ? 'left' : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const period = row[0] as number;
              const cls = [onSelect ? 'clickable' : '', period === selected ? 'selected' : '', transitions.has(period) ? 'transition' : '']
                .filter(Boolean)
                .join(' ');
              return (
                <tr
                  key={period}
                  className={cls}
                  onClick={() => onSelect?.(period)}
                  ref={period === selected ? selRef : undefined}
                  aria-selected={period === selected}
                >
                  {row.map((v, k) => (
                    <td key={k} className={table.columns[k].type === 'text' ? 'left' : undefined}>
                      {fmtCell(v, table.columns[k].type)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              {totals.map((v, k) => (
                <td key={k} className={k === 0 ? 'left' : undefined}>
                  {k === 0 ? 'Total' : v === null ? '' : fmtMoney(v)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

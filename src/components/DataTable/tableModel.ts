import type { ReactNode } from 'react';

/** A column of a DataTable. `value` drives sorting, search and CSV; `render` the cell. */
export interface DataTableColumn<T> {
  id: string;
  header: string;
  value: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Minimum width in px (the table scrolls sideways when columns do not fit). */
  minWidth?: number;
  /** CSV value when it differs from `value` (defaults to `value`). */
  csv?: (row: T) => string | number;
  /** CSV header when it differs from `header`. */
  csvHeader?: string;
  sortable?: boolean;
}

export type SortDirection = 'asc' | 'desc';
export interface SortRule {
  id: string;
  dir: SortDirection;
}

/** "weight:desc,ticker:asc" ⇄ rules. Unknown or malformed parts are dropped. */
export function parseSort(text: string, columnIds?: readonly string[]): SortRule[] {
  const rules: SortRule[] = [];
  for (const part of text.split(',')) {
    const [id = '', dir = ''] = part.split(':');
    if (!id || (dir !== 'asc' && dir !== 'desc')) continue;
    if (columnIds && !columnIds.includes(id)) continue;
    if (rules.some((r) => r.id === id)) continue;
    rules.push({ id, dir });
  }
  return rules;
}

export function serializeSort(rules: readonly SortRule[]): string {
  return rules.map((r) => `${r.id}:${r.dir}`).join(',');
}

/** "a,b,c" ⇄ ids; empty parts dropped. */
export function parseIdList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The sort after clicking a header. Plain click: sort by that column alone (flipping it if it
 * already was the only sort). Shift-click (`additive`): add the column as the next key, flip it
 * if already sorted, and remove it on a third click (desc → asc → off for numbers).
 */
export function nextSort(
  rules: readonly SortRule[],
  id: string,
  additive: boolean,
  firstDir: SortDirection,
): SortRule[] {
  const existing = rules.find((r) => r.id === id);
  if (!additive) {
    if (existing && rules.length === 1) {
      return [{ id, dir: existing.dir === 'asc' ? 'desc' : 'asc' }];
    }
    return [{ id, dir: firstDir }];
  }
  if (!existing) return [...rules, { id, dir: firstDir }];
  if (existing.dir === firstDir) {
    return rules.map((r) => (r.id === id ? { id, dir: firstDir === 'asc' ? 'desc' : 'asc' } : r));
  }
  return rules.filter((r) => r.id !== id);
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

/** Stable multi-key sort: the first rule decides, later rules break ties. */
export function sortRows<T>(
  rows: readonly T[],
  columns: readonly DataTableColumn<T>[],
  rules: readonly SortRule[],
): T[] {
  const keyed = rules.flatMap((r) => {
    const col = columns.find((c) => c.id === r.id);
    return col ? [{ value: col.value, sign: r.dir === 'asc' ? 1 : -1 }] : [];
  });
  if (keyed.length === 0) return [...rows];
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const k of keyed) {
        const c = compareValues(k.value(a.row), k.value(b.row)) * k.sign;
        if (c !== 0) return c;
      }
      return a.index - b.index;
    })
    .map((x) => x.row);
}

/** Rows where every word of the query appears in some column's value (case-insensitive). */
export function filterRows<T>(
  rows: readonly T[],
  columns: readonly DataTableColumn<T>[],
  query: string,
): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((row) => {
    const text = columns.map((c) => String(c.value(row)).toLowerCase()).join('\u0000');
    return words.every((w) => text.includes(w));
  });
}

/** Columns in the saved order; columns missing from it keep their default place at the end. */
export function orderColumns<T>(
  columns: readonly DataTableColumn<T>[],
  order: readonly string[],
): DataTableColumn<T>[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const ordered = order.flatMap((id) => {
    const c = byId.get(id);
    return c ? [c] : [];
  });
  return [...ordered, ...columns.filter((c) => !order.includes(c.id))];
}

/** Move column `id` to `targetId`'s position. */
export function moveColumn(order: readonly string[], id: string, targetId: string): string[] {
  if (id === targetId) return [...order];
  const without = order.filter((x) => x !== id);
  const at = without.indexOf(targetId);
  if (at < 0) return [...order];
  const from = order.indexOf(id);
  const to = order.indexOf(targetId);
  without.splice(from < to ? at + 1 : at, 0, id);
  return without;
}

/** Move column `id` one place earlier (-1) or later (+1). */
export function shiftColumn(order: readonly string[], id: string, by: -1 | 1): string[] {
  const i = order.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= order.length) return [...order];
  const next = [...order];
  const other = next[j];
  if (other === undefined) return next;
  next[j] = id;
  next[i] = other;
  return next;
}

export interface Page {
  index: number;
  count: number;
  from: number;
  to: number;
}

/** Page `index` (clamped) of `total` rows at `size` per page; size 0 = one page of everything. */
export function pageOf(total: number, size: number, index: number): Page {
  if (size <= 0) return { index: 0, count: 1, from: 0, to: total };
  const count = Math.max(1, Math.ceil(total / size));
  const i = Math.min(Math.max(0, index), count - 1);
  return { index: i, count, from: i * size, to: Math.min(total, (i + 1) * size) };
}

/**
 * One CSV field: quoted when it holds a comma, quote or line break. Text starting with = + - @
 * (or a tab / carriage return) is prefixed with ' so spreadsheets do not run it as a formula.
 */
export function csvField(value: string | number): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV text (CRLF line ends, header row) of `rows` in the given columns. */
export function toCsv<T>(rows: readonly T[], columns: readonly DataTableColumn<T>[]): string {
  const header = columns.map((c) => csvField(c.csvHeader ?? c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => csvField((c.csv ?? c.value)(row))).join(','));
  return [header, ...body].join('\r\n');
}

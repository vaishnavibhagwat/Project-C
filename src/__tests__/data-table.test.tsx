import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { VirtuosoMockContext } from 'react-virtuoso';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  csvField,
  DataTable,
  filterRows,
  moveColumn,
  nextSort,
  orderColumns,
  pageOf,
  parseSort,
  serializeSort,
  shiftColumn,
  sortRows,
  toCsv,
  type DataTableColumn,
  type SortRule,
} from '@/components/DataTable';

interface Row {
  id: string;
  name: string;
  group: string;
  value: number;
}

const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', group: 'X', value: 3 },
  { id: 'b', name: 'Bravo', group: 'Y', value: 1 },
  { id: 'c', name: 'Charlie', group: 'X', value: 2 },
  { id: 'd', name: 'Delta, Inc', group: 'Y', value: 3 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', value: (r) => r.name },
  { id: 'group', header: 'Group', value: (r) => r.group },
  { id: 'value', header: 'Value', value: (r) => r.value, align: 'right' },
];

const viewport = (ui: ReactNode) => (
  <VirtuosoMockContext.Provider value={{ viewportHeight: 400, itemHeight: 32 }}>
    {ui}
  </VirtuosoMockContext.Provider>
);

/** A DataTable wired to local state, as a widget would wire it to its config. */
function Harness({
  rows = ROWS,
  pageSize: initialPageSize = 0,
  onRowClick,
  spy,
}: {
  rows?: Row[];
  pageSize?: number;
  onRowClick?: (r: Row) => void;
  spy?: (change: string, value: unknown) => void;
}) {
  const [sort, setSort] = useState<SortRule[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(initialPageSize);
  return (
    <DataTable<Row>
      caption="Rows"
      rows={rows}
      columns={COLUMNS}
      getRowId={(r) => r.id}
      sort={sort}
      onSortChange={(s) => {
        spy?.('sort', s);
        setSort(s);
      }}
      columnOrder={order}
      onColumnOrderChange={(o) => {
        spy?.('order', o);
        setOrder(o);
      }}
      hiddenColumns={hidden}
      onHiddenColumnsChange={(h) => {
        spy?.('hidden', h);
        setHidden(h);
      }}
      pageSize={pageSize}
      onPageSizeChange={setPageSize}
      onRowClick={onRowClick}
      rowActionLabel={(r) => `Select ${r.name}`}
      exportFileName="rows.csv"
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataTable logic', () => {
  it('sorts by one column on click and adds keys on shift-click', () => {
    let rules = nextSort([], 'value', false, 'desc');
    expect(rules).toEqual([{ id: 'value', dir: 'desc' }]);
    rules = nextSort(rules, 'value', false, 'desc');
    expect(rules).toEqual([{ id: 'value', dir: 'asc' }]);
    rules = nextSort(rules, 'name', true, 'asc');
    expect(rules).toEqual([
      { id: 'value', dir: 'asc' },
      { id: 'name', dir: 'asc' },
    ]);
    rules = nextSort(rules, 'name', true, 'asc');
    expect(rules[1]).toEqual({ id: 'name', dir: 'desc' });
    expect(nextSort(rules, 'name', true, 'asc')).toEqual([{ id: 'value', dir: 'asc' }]);
    expect(nextSort(rules, 'group', false, 'asc')).toEqual([{ id: 'group', dir: 'asc' }]);
  });

  it('sorts by several keys, stably', () => {
    const byGroupThenValue = sortRows(ROWS, COLUMNS, [
      { id: 'group', dir: 'asc' },
      { id: 'value', dir: 'desc' },
    ]);
    expect(byGroupThenValue.map((r) => r.id)).toEqual(['a', 'c', 'd', 'b']);
    // Ties keep input order (a before d at value 3).
    expect(sortRows(ROWS, COLUMNS, [{ id: 'value', dir: 'desc' }]).map((r) => r.id)).toEqual([
      'a',
      'd',
      'c',
      'b',
    ]);
  });

  it('searches every column; every word must match somewhere', () => {
    expect(filterRows(ROWS, COLUMNS, 'y').map((r) => r.id)).toEqual(['b', 'd']);
    expect(filterRows(ROWS, COLUMNS, 'x 2').map((r) => r.id)).toEqual(['c']);
    expect(filterRows(ROWS, COLUMNS, '  ')).toHaveLength(4);
  });

  it('reorders columns by drag target or by one step', () => {
    const ids = ['name', 'group', 'value'];
    expect(moveColumn(ids, 'value', 'name')).toEqual(['value', 'name', 'group']);
    expect(moveColumn(ids, 'name', 'value')).toEqual(['group', 'value', 'name']);
    expect(shiftColumn(ids, 'group', -1)).toEqual(['group', 'name', 'value']);
    expect(shiftColumn(ids, 'name', -1)).toEqual(ids);
    expect(orderColumns(COLUMNS, ['value']).map((c) => c.id)).toEqual(['value', 'name', 'group']);
  });

  it('pages rows, clamping the page index', () => {
    expect(pageOf(62, 25, 0)).toEqual({ index: 0, count: 3, from: 0, to: 25 });
    expect(pageOf(62, 25, 9)).toEqual({ index: 2, count: 3, from: 50, to: 62 });
    expect(pageOf(62, 0, 3)).toEqual({ index: 0, count: 1, from: 0, to: 62 });
  });

  it('round-trips the saved sort and drops malformed parts', () => {
    expect(parseSort('value:desc,bogus,name:sideways,group:asc')).toEqual([
      { id: 'value', dir: 'desc' },
      { id: 'group', dir: 'asc' },
    ]);
    expect(parseSort('value:desc,zzz:asc', ['value'])).toEqual([{ id: 'value', dir: 'desc' }]);
    expect(serializeSort([{ id: 'value', dir: 'asc' }])).toBe('value:asc');
  });

  it('escapes CSV fields and blocks spreadsheet formulas', () => {
    expect(csvField('Delta, Inc')).toBe('"Delta, Inc"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('+1')).toBe("'+1");
    expect(csvField(-12.5)).toBe('-12.5');
    expect(toCsv(ROWS.slice(2), COLUMNS)).toBe(
      'Name,Group,Value\r\nCharlie,X,2\r\n"Delta, Inc",Y,3',
    );
  });
});

describe('DataTable component', () => {
  it('shift-click adds a second sort key and shows its priority', () => {
    const spy = vi.fn();
    render(viewport(<Harness spy={spy} />));
    fireEvent.click(screen.getByRole('button', { name: /^Group/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Value/ }), { shiftKey: true });
    expect(spy).toHaveBeenLastCalledWith('sort', [
      { id: 'group', dir: 'asc' },
      { id: 'value', dir: 'desc' },
    ]);
    expect(screen.getByRole('columnheader', { name: /Value/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('button', { name: /^Value/ })).toHaveTextContent('Value▼2');
    expect(screen.getByRole('status')).toHaveTextContent(
      'sorted by Group ascending, then Value descending',
    );
  });

  it('searches across every column', async () => {
    render(viewport(<Harness />));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inc' } });
    expect(await screen.findByText('1 of 4')).toBeInTheDocument();
  });

  it('hides and moves columns from the Columns menu', () => {
    const spy = vi.fn();
    render(viewport(<Harness spy={spy} />));
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    const menu = screen.getByRole('dialog', { name: 'Columns' });
    fireEvent.click(within(menu).getByRole('checkbox', { name: 'Group' }));
    expect(spy).toHaveBeenLastCalledWith('hidden', ['group']);
    expect(screen.queryByRole('columnheader', { name: /Group/ })).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('button', { name: 'Move Value earlier' }));
    expect(spy).toHaveBeenLastCalledWith('order', ['name', 'value', 'group']);
  });

  it('reorders columns by dragging one header onto another', () => {
    const spy = vi.fn();
    render(viewport(<Harness spy={spy} />));
    const store = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => store.set(k, v),
      getData: (k: string) => store.get(k) ?? '',
      effectAllowed: '',
      dropEffect: '',
    };
    const value = screen.getByRole('columnheader', { name: /Value/ });
    const name = screen.getByRole('columnheader', { name: /Name/ });
    fireEvent.dragStart(value, { dataTransfer });
    fireEvent.dragOver(name, { dataTransfer });
    fireEvent.drop(name, { dataTransfer });
    expect(spy).toHaveBeenLastCalledWith('order', ['value', 'name', 'group']);
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Value',
      'Name',
      'Group',
    ]);
  });

  it('exports the filtered, sorted rows as CSV through a Blob URL', async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(viewport(<Harness />));
    fireEvent.click(screen.getByRole('button', { name: /^Value/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x' } });
    await screen.findByText('2 of 4');
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(click).toHaveBeenCalledTimes(1);
    const blob = blobs[0];
    if (!blob) throw new Error('no blob');
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.readAsText(blob);
    });
    expect(text.replace(String.fromCharCode(0xfeff), '')).toBe(
      ['Name,Group,Value', 'Alpha,X,3', 'Charlie,X,2'].join(String.fromCharCode(13, 10)),
    );
  });

  it('pages through rows', () => {
    const many = Array.from({ length: 62 }, (_, i) => ({
      id: `r${i}`,
      name: `Row ${i}`,
      group: 'G',
      value: i,
    }));
    render(viewport(<Harness rows={many} pageSize={25} />));
    const pages = screen.getByRole('navigation', { name: 'Pages' });
    expect(pages).toHaveTextContent('1–25 of 62');
    fireEvent.click(within(pages).getByRole('button', { name: /Next/ }));
    expect(pages).toHaveTextContent('26–50 of 62');
    fireEvent.click(within(pages).getByRole('button', { name: /Next/ }));
    expect(within(pages).getByRole('button', { name: /Next/ })).toBeDisabled();
  });

  it('activates a row by click or keyboard', () => {
    const onRowClick = vi.fn<(r: Row) => void>();
    render(viewport(<Harness onRowClick={onRowClick} />));
    fireEvent.click(screen.getByRole('row', { name: 'Select Bravo' }));
    fireEvent.keyDown(screen.getByRole('row', { name: 'Select Alpha' }), { key: 'Enter' });
    expect(onRowClick.mock.calls.map((call: Row[]) => call[0]?.id)).toEqual(['b', 'a']);
  });

  it('renders only a window of rows for a 1,000-row table', () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({
      id: `r${i}`,
      name: `Row ${i}`,
      group: 'G',
      value: i,
    }));
    render(viewport(<Harness rows={many} />));
    expect(screen.getByText('1,000 of 1,000')).toBeInTheDocument();
    const bodyRows = screen.getAllByRole('row').length;
    expect(bodyRows).toBeGreaterThan(5);
    expect(bodyRows).toBeLessThan(60);
  });
});

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DataTable, type DataTableColumn, type SortRule } from '@/components/DataTable';

interface Row {
  id: string;
  city: string;
  state: string;
  population: number;
}

const CITIES: [string, string, number][] = [
  ['Mumbai', 'Maharashtra', 12.4],
  ['Delhi', 'Delhi', 11.0],
  ['Bengaluru', 'Karnataka', 8.4],
  ['Hyderabad', 'Telangana', 6.8],
  ['Ahmedabad', 'Gujarat', 5.6],
  ['Chennai', 'Tamil Nadu', 4.6],
  ['Kolkata', 'West Bengal', 4.5],
  ['Pune', 'Maharashtra', 3.1],
];

/** Illustrative rows (rounded 2011 census figures, millions), repeated to `count`. */
const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => {
    const [city, state, population] = CITIES[i % CITIES.length] ?? ['', '', 0];
    return {
      id: `r${i}`,
      city: count > CITIES.length ? `${city} ${i + 1}` : city,
      state,
      population,
    };
  });

const COLUMNS: DataTableColumn<Row>[] = [
  { id: 'city', header: 'City', value: (r) => r.city, minWidth: 120 },
  { id: 'state', header: 'State', value: (r) => r.state, minWidth: 120 },
  {
    id: 'population',
    header: 'Population (m)',
    value: (r) => r.population,
    render: (r) => r.population.toFixed(1),
    align: 'right',
  },
];

/** DataTable with its controlled state held locally, as a widget holds it in its config. */
function Demo({ count, pageSize: initialPageSize }: { count: number; pageSize: number }) {
  const [sort, setSort] = useState<SortRule[]>([{ id: 'population', dir: 'desc' }]);
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(initialPageSize);
  return (
    <div className="h-[360px] w-[560px] rounded border border-line bg-panel">
      <DataTable<Row>
        caption="Cities"
        rows={makeRows(count)}
        columns={COLUMNS}
        getRowId={(r) => r.id}
        sort={sort}
        onSortChange={setSort}
        columnOrder={order}
        onColumnOrderChange={setOrder}
        hiddenColumns={hidden}
        onHiddenColumnsChange={setHidden}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        exportFileName="cities.csv"
        footer={(rows) => ({
          city: 'Total',
          population: rows.reduce((s, r) => s + r.population, 0).toFixed(1),
        })}
      />
    </div>
  );
}

const meta = {
  title: 'Components/DataTable',
  component: Demo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sort (shift-click for more keys), search, drag headers, Columns menu, CSV export. */
export const Default: Story = { args: { count: 8, pageSize: 0 } };

/** 1,000 rows in pages of 25. */
export const Configured: Story = { args: { count: 1000, pageSize: 25 } };

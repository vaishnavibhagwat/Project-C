import { forwardRef, type HTMLAttributes, type TableHTMLAttributes } from 'react';
import type { TableComponents } from 'react-virtuoso';

/** Stable table parts for react-virtuoso so the virtual table fills its widget width. */
const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(
  function Table(props, ref) {
    return <table {...props} ref={ref} className="w-full border-collapse" />;
  },
);

const TableHead = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableHead(props, ref) {
    return <thead {...props} ref={ref} className="z-[1]" />;
  },
);

export function virtuosoTableComponents<T>(): TableComponents<T> {
  return { Table, TableHead };
}

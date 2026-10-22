import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '@/utils/cx';

export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
  /** The widget instance in this cell (also the react-grid-layout key). */
  instanceId: string;
}

/**
 * One cell of the dashboard grid. react-grid-layout clones its children to add position
 * styles, drag and resize handlers and the resize handle (appended to `children`), so this
 * forwards the ref and passes every prop through to the DOM node.
 */
export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(function GridItem(
  { instanceId, className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} data-instance-id={instanceId} className={cx('min-w-0', className)} {...rest}>
      {children}
    </div>
  );
});

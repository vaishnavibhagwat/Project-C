import { describe, expect, it } from 'vitest';
import {
  clampToConstraints,
  detectCollision,
  isPositionValid,
  nextAvailablePosition,
} from '@/grid/utils';
import { gridItem as item } from './fixtures';

// A 12-column page: a 6-wide and a 3-wide widget on top (a 3-column gap at the right), and a
// full-width widget below.
const layout = [item('a', 0, 0, 6, 4), item('b', 6, 0, 3, 4), item('c', 0, 4, 12, 2)];

describe('nextAvailablePosition', () => {
  it('fills the first gap the item fits, scanning top to bottom and left to right', () => {
    expect(nextAvailablePosition(layout, { w: 3, h: 3 }, 12)).toEqual({ x: 9, y: 0, w: 3, h: 3 });
  });

  it('goes to the bottom-left when no gap is wide enough, and starts at 0,0 on an empty grid', () => {
    expect(nextAvailablePosition(layout, { w: 4, h: 2 }, 12)).toEqual({ x: 0, y: 6, w: 4, h: 2 });
    expect(nextAvailablePosition([], { w: 4, h: 3 }, 12)).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });

  it('caps the width at the column count (mobile stacks in one column)', () => {
    expect(nextAvailablePosition(layout, { w: 6, h: 2 }, 1)).toEqual({ x: 0, y: 6, w: 1, h: 2 });
  });
});

describe('detectCollision', () => {
  it('returns the first overlapping item, or null', () => {
    expect(detectCollision(layout, item('new', 5, 3, 2, 2))).toEqual(layout[0]);
    expect(detectCollision(layout, item('new', 9, 0, 3, 4))).toBeNull();
  });

  it('treats touching edges as no collision and ignores the item itself', () => {
    expect(detectCollision(layout, item('new', 0, 6, 12, 1))).toBeNull();
    expect(detectCollision(layout, item('a', 0, 0, 6, 4))).toBeNull();
  });
});

describe('isPositionValid', () => {
  it('accepts a free cell inside the grid', () => {
    expect(isPositionValid(layout, item('new', 9, 0, 3, 3), 12)).toBe(true);
  });

  it('rejects overlaps, positions outside the columns and non-whole or empty sizes', () => {
    expect(isPositionValid(layout, item('new', 8, 0, 3, 3), 12)).toBe(false);
    expect(isPositionValid(layout, item('new', 10, 0, 3, 3), 12)).toBe(false);
    expect(isPositionValid(layout, item('new', -1, 8, 3, 3), 12)).toBe(false);
    expect(isPositionValid(layout, item('new', 0, 8, 2.5, 3), 12)).toBe(false);
    expect(isPositionValid(layout, item('new', 0, 8, 3, 0), 12)).toBe(false);
  });
});

describe('clampToConstraints', () => {
  const limits = { min: { w: 4, h: 2 }, max: { w: 8, h: 3 } };

  it('keeps sizes within min and max', () => {
    expect(clampToConstraints(item('a', 0, 0, 2, 1), limits, 12)).toMatchObject({ w: 4, h: 2 });
    expect(clampToConstraints(item('a', 0, 0, 12, 9), limits, 12)).toMatchObject({ w: 8, h: 3 });
    expect(clampToConstraints(item('a', 0, 0, 6, 3), limits, 12)).toEqual(item('a', 0, 0, 6, 3));
  });

  it('moves the item left to stay inside the columns and caps a minimum wider than the grid', () => {
    expect(clampToConstraints(item('a', 10, 5, 4, 2), limits, 12)).toEqual(item('a', 8, 5, 4, 2));
    expect(clampToConstraints(item('a', 0, 0, 1, 2), limits, 1)).toMatchObject({ x: 0, w: 1 });
  });

  it('rounds to whole cells and only applies a minimum of 1 without constraints', () => {
    expect(clampToConstraints(item('a', 1.4, 2.6, 0, 0), undefined, 12)).toEqual(
      item('a', 1, 3, 1, 1),
    );
  });
});

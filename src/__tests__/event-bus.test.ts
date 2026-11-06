import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEventBus } from '@/hooks/useEventBus';
import { EventBus, eventBus, type WidgetEventMap } from '@/registry/eventBus';

interface TestEvents {
  PING: { n: number };
  NAME: { value: string };
}

const quiet = () => new EventBus<TestEvents>(() => undefined);

describe('EventBus', () => {
  it('delivers each payload to the handlers of that event only', () => {
    const bus = quiet();
    const pings: number[] = [];
    const names: string[] = [];
    bus.subscribe('PING', (p) => pings.push(p.n));
    bus.subscribe('NAME', (p) => names.push(p.value));
    bus.publish('PING', { n: 1 });
    bus.publish('PING', { n: 2 });
    bus.publish('NAME', { value: 'a' });
    expect(pings).toEqual([1, 2]);
    expect(names).toEqual(['a']);
  });

  it('calls handlers in subscription order', () => {
    const bus = quiet();
    const order: string[] = [];
    bus.subscribe('PING', () => order.push('first'));
    bus.subscribe('PING', () => order.push('second'));
    bus.publish('PING', { n: 0 });
    expect(order).toEqual(['first', 'second']);
  });

  it('does nothing when an event has no handlers', () => {
    expect(() => quiet().publish('PING', { n: 1 })).not.toThrow();
  });

  it('subscribe returns an unsubscribe function that is safe to call twice', () => {
    const bus = quiet();
    const handler = vi.fn();
    const stop = bus.subscribe('PING', handler);
    expect(bus.listenerCount('PING')).toBe(1);
    stop();
    stop();
    bus.publish('PING', { n: 1 });
    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount('PING')).toBe(0);
  });

  it('unsubscribing one handler leaves the others', () => {
    const bus = quiet();
    const a = vi.fn();
    const b = vi.fn();
    const stopA = bus.subscribe('PING', a);
    bus.subscribe('PING', b);
    stopA();
    bus.publish('PING', { n: 3 });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith({ n: 3 });
  });

  it('counts the same handler once', () => {
    const bus = quiet();
    const handler = vi.fn();
    bus.subscribe('PING', handler);
    bus.subscribe('PING', handler);
    bus.publish('PING', { n: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('applies subscribe and unsubscribe made during a publish from the next publish', () => {
    const bus = quiet();
    const late = vi.fn();
    const second = vi.fn();
    let stopSecond: () => void = () => undefined;
    bus.subscribe('PING', () => {
      stopSecond();
      bus.subscribe('PING', late);
    });
    stopSecond = bus.subscribe('PING', second);
    bus.publish('PING', { n: 1 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();
    bus.publish('PING', { n: 2 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledWith({ n: 2 });
  });

  it('keeps delivering when a handler throws and reports the error', () => {
    const onError = vi.fn();
    const bus = new EventBus<TestEvents>(onError);
    const after = vi.fn();
    const boom = new Error('boom');
    bus.subscribe('PING', () => {
      throw boom;
    });
    bus.subscribe('PING', after);
    bus.publish('PING', { n: 1 });
    expect(after).toHaveBeenCalledWith({ n: 1 });
    expect(onError).toHaveBeenCalledWith(boom, 'PING');
  });

  it('logs handler errors to the console by default', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = new EventBus<TestEvents>();
    bus.subscribe('PING', () => {
      throw new Error('boom');
    });
    bus.publish('PING', { n: 1 });
    expect(log).toHaveBeenCalledWith('[eventBus] a PING handler threw', expect.any(Error));
    log.mockRestore();
  });

  it('clear removes every handler', () => {
    const bus = quiet();
    const handler = vi.fn();
    bus.subscribe('PING', handler);
    bus.subscribe('NAME', handler);
    bus.clear();
    bus.publish('PING', { n: 1 });
    bus.publish('NAME', { value: 'x' });
    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount('PING') + bus.listenerCount('NAME')).toBe(0);
  });

  it('rejects unknown events and wrong payloads at compile time', () => {
    const bus = quiet();
    // @ts-expect-error: not an event in the map
    bus.publish('PONG', { n: 1 });
    // @ts-expect-error: wrong payload for PING
    bus.publish('PING', { value: 'x' });
    // @ts-expect-error: the handler expects NAME's payload
    bus.subscribe('PING', (p: { value: string }) => p.value);
    expect(bus.listenerCount('PING')).toBe(1);
  });
});

describe('the app event bus', () => {
  it('carries the three widget events with their payloads', () => {
    const seen: unknown[] = [];
    const stops = [
      eventBus.subscribe('SYMBOL_SELECTED', (p) => seen.push(p)),
      eventBus.subscribe('DATE_RANGE_CHANGED', (p) => seen.push(p)),
      eventBus.subscribe('ALERT_CLICKED', (p) => seen.push(p)),
    ];
    const symbol: WidgetEventMap['SYMBOL_SELECTED'] = { ticker: 'TCS', source: 'w04' };
    const range: WidgetEventMap['DATE_RANGE_CHANGED'] = { from: '2026-01-01', to: '2026-06-30' };
    const alert: WidgetEventMap['ALERT_CLICKED'] = {
      alertId: 'a1',
      relatedWidget: 'var-gauge',
      relatedEntity: 'PORTFOLIO',
    };
    eventBus.publish('SYMBOL_SELECTED', symbol);
    eventBus.publish('DATE_RANGE_CHANGED', range);
    eventBus.publish('ALERT_CLICKED', alert);
    for (const stop of stops) stop();
    expect(seen).toEqual([symbol, range, alert]);
  });
});

describe('useEventBus', () => {
  it('subscribes while mounted and unsubscribes on unmount', () => {
    const before = eventBus.listenerCount('SYMBOL_SELECTED');
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEventBus('SYMBOL_SELECTED', handler));
    expect(eventBus.listenerCount('SYMBOL_SELECTED')).toBe(before + 1);
    act(() => eventBus.publish('SYMBOL_SELECTED', { ticker: 'INFY', source: 'x' }));
    expect(handler).toHaveBeenCalledWith({ ticker: 'INFY', source: 'x' });
    unmount();
    expect(eventBus.listenerCount('SYMBOL_SELECTED')).toBe(before);
    eventBus.publish('SYMBOL_SELECTED', { ticker: 'TCS', source: 'x' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('uses the latest handler without subscribing again', () => {
    const before = eventBus.listenerCount('DATE_RANGE_CHANGED');
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ handler }) => useEventBus('DATE_RANGE_CHANGED', handler),
      { initialProps: { handler: first } },
    );
    rerender({ handler: second });
    expect(eventBus.listenerCount('DATE_RANGE_CHANGED')).toBe(before + 1);
    eventBus.publish('DATE_RANGE_CHANGED', { from: 'a', to: 'b' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ from: 'a', to: 'b' });
    unmount();
  });
});

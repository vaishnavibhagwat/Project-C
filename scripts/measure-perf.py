"""Measure runtime performance of the workstation in headless Chrome (Playwright).

Usage:
  npm run build && npx vite preview --port 4173      (production build)
  npx vite --port 5173                               (dev server, for React Profiler timings)
  python scripts/measure-perf.py

Numbers depend on the machine; record where they were measured.
"""
import json
import statistics
import sys

from playwright.sync_api import sync_playwright

PROD = 'http://localhost:4173/#/workstation'
DEV = 'http://localhost:5173/#/workstation'

READY = """() => {
  const regions = document.querySelectorAll('section[role=region]');
  if (regions.length !== 10) return false;
  if (document.querySelector('[data-testid^=skeleton]')) return false;
  return [...regions].every((r) => {
    const body = r.querySelector('[data-widget-body]');
    return (
      body !== null &&
      body.childElementCount > 0 &&
      !body.querySelector('[data-testid^=skeleton]') &&
      (body.textContent.trim().length > 0 || body.querySelector('svg') !== null)
    );
  });
}"""


def initial_load(browser, runs=5):
    times = []
    for _ in range(runs):
        ctx = browser.new_context(viewport={'width': 1600, 'height': 1000})
        page = ctx.new_page()
        page.goto(PROD)
        page.wait_for_function(READY, timeout=20000, polling=16)
        times.append(page.evaluate('() => performance.now()'))
        ctx.close()
    return times


SWITCH = """async (name) => {
  const btn = [...document.querySelectorAll('[role=option] button')].find((b) => b.textContent.includes(name));
  const t0 = performance.now();
  btn.click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return performance.now() - t0;
}"""


def theme_switch(browser, loads=5, switches=4):
    """Click-to-next-paint for theme switches. The first switch on a fresh load is the worst case."""
    first, later = [], []
    for _ in range(loads):
        ctx = browser.new_context(viewport={'width': 1600, 'height': 1000})
        page = ctx.new_page()
        page.goto(PROD)
        page.wait_for_function(READY, timeout=20000)
        page.get_by_role('button', name='Theme', exact=True).click()
        for i in range(switches):
            ms = page.evaluate(SWITCH, 'Porcelain' if i % 2 == 0 else 'Midnight Graphite')
            (first if i == 0 else later).append(ms)
        ctx.close()
    return first, later


def drag_fps(page):
    handle = page.locator('section[aria-label="NAV vs Nifty 50"] .widget-drag-handle')
    box = handle.bounding_box()
    page.evaluate(
        """() => {
          window.__frames = [];
          const loop = (t) => { window.__frames.push(t); if (window.__frames.length < 100000) window.__raf = requestAnimationFrame(loop); };
          window.__raf = requestAnimationFrame(loop);
        }"""
    )
    x, y = box['x'] + 40, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.evaluate('() => { window.__frames = []; }')
    for i in range(120):
        page.mouse.move(x + (i % 60) * 8, y + (i // 60) * 160 + (i % 60) * 2, steps=1)
        page.wait_for_timeout(16)
    frames = page.evaluate('() => { cancelAnimationFrame(window.__raf); return window.__frames; }')
    page.mouse.up()
    intervals = [b - a for a, b in zip(frames, frames[1:])]
    duration = (frames[-1] - frames[0]) / 1000
    return {
        'frames': len(frames),
        'avg_fps': round((len(frames) - 1) / duration, 1),
        'p95_frame_ms': round(sorted(intervals)[int(len(intervals) * 0.95)], 1),
        'max_frame_ms': round(max(intervals), 1),
    }


def render_timings(browser, seconds=25):
    ctx = browser.new_context(viewport={'width': 1600, 'height': 1000})
    ctx.add_init_script('window.__MERIDIAN_PERF__ = [];')
    page = ctx.new_page()
    page.goto(DEV)
    page.wait_for_function(READY, timeout=60000, polling=50)
    page.evaluate('() => { window.__MERIDIAN_PERF__.length = 0; }')
    page.wait_for_timeout(seconds * 1000)
    samples = page.evaluate('() => window.__MERIDIAN_PERF__')
    ctx.close()
    updates = [s for s in samples if s['phase'] != 'mount']
    by_widget = {}
    for s in updates:
        by_widget.setdefault(s['id'], []).append(s['durationMs'])
    return {
        'updates': len(updates),
        'max_ms': round(max((s['durationMs'] for s in updates), default=0), 1),
        'p95_ms': round(sorted(s['durationMs'] for s in updates)[int(len(updates) * 0.95)] if updates else 0, 1),
        'per_widget_max_ms': {k: round(max(v), 1) for k, v in sorted(by_widget.items())},
    }


def main():
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        loads = initial_load(browser)
        out['initial_load_10_widgets_ms'] = {
            'runs': [round(t) for t in loads],
            'median': round(statistics.median(loads)),
        }
        first, later = theme_switch(browser)
        out['theme_switch_to_next_paint_ms'] = {
            'first_switch_per_fresh_load': [round(t, 1) for t in first],
            'later_switches_max': round(max(later), 1),
            'max': round(max(first + later), 1),
        }
        ctx = browser.new_context(viewport={'width': 1600, 'height': 1000})
        page = ctx.new_page()
        page.goto(PROD)
        page.wait_for_function(READY, timeout=20000)
        out['drag'] = drag_fps(page)
        ctx.close()
        if '--no-dev' not in sys.argv:
            out['widget_render_on_new_data_dev_build'] = render_timings(browser)
        browser.close()
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()

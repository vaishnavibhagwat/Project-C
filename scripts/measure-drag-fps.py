"""Record a drag in real Chrome, measure its frame rate and screenshot the Performance Overlay.

Usage:
  npm run build && npx vite preview --port 4173
  python scripts/measure-drag-fps.py [trace-output.json]

Opens headed Google Chrome (not headless, so frames follow the display's vsync), loads the
Workstation, opens the Performance Overlay (Ctrl+Shift+P) and drags the NAV widget back and
forth for four seconds, one pointer move per frame. Frame rate is measured two ways over the same drag:

  1. requestAnimationFrame timestamps in the page (what the overlay shows), and
  2. a Chrome performance trace (the data DevTools > Performance records): compositor frames
     drawn (DrawFrame) and dropped (DroppedFrame) between the first and last pointer move.

The trace is written out so it can be loaded in DevTools > Performance > Load profile. A
screenshot is taken while the widget is still held, with the overlay visible, and saved to
docs/screenshots/drag-fps.png. Numbers depend on the machine; record where they were measured.
"""
import json
import statistics
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = 'http://localhost:4173/#/workstation'
SCREENSHOT = Path('docs/screenshots/drag-fps.png')
TRACE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('drag-trace.json')
WIDGET = '[data-testid="widget-workstation-nav-performance"]'
DRAG_MS = 4000

# Moves the pointer once per animation frame, like a real mouse (60+ Hz), for DRAG_MS. Sending
# each move from Python takes ~50 ms on Windows, which would leave most frames with nothing to
# draw. react-draggable listens for mousemove on the document, so in-page events drive it.
DRAG = """([x0, y0, ms]) => new Promise((resolve) => {
  const t0 = performance.now();
  const step = (now) => {
    const t = now - t0;
    if (t >= ms) return resolve();
    const phase = (t % 2000) / 2000;
    const dx = 500 * (phase < 0.5 ? phase * 2 : (1 - phase) * 2);
    const dy = 140 * (t / ms);
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true, clientX: x0 + dx, clientY: y0 + dy, buttons: 1,
    }));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
})"""

FRAME_COUNTER = """() => {
  window.__dragFrames = [];
  const tick = (t) => { window.__dragFrames.push(t); window.__dragRaf = requestAnimationFrame(tick); };
  window.__dragRaf = requestAnimationFrame(tick);
}"""


def main():
    with sync_playwright() as p:
        # Chrome pauses frames (1 FPS) in a window that is covered or minimised; these flags
        # keep it rendering at the display rate so a run is not spoiled by switching windows.
        browser = p.chromium.launch(
            channel='chrome',
            headless=False,
            args=[
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-background-timer-throttling',
            ],
        )
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(URL)
        page.wait_for_selector(f'{WIDGET} [data-widget-body] svg', timeout=20000)
        page.wait_for_timeout(1500)  # let first-load work and the grid's settle delay finish
        page.keyboard.press('Control+Shift+P')
        page.wait_for_selector('section[aria-label="Performance overlay"]')
        page.wait_for_timeout(1500)

        handle = page.locator(f'{WIDGET} .widget-drag-handle h2')
        box = handle.bounding_box()
        x0, y0 = box['x'] + 20, box['y'] + box['height'] / 2

        browser.start_tracing(
            page=page,
            categories=[
                'devtools.timeline',
                'disabled-by-default-devtools.timeline',
                'disabled-by-default-devtools.timeline.frame',
                'blink.user_timing',
            ],
            screenshots=False,
        )
        page.mouse.move(x0, y0)
        page.mouse.down()
        page.evaluate(FRAME_COUNTER)
        t_start = page.evaluate('() => performance.timeOrigin + performance.now()')
        # A first real move starts the drag; then sweep 500 px right and back, drifting down,
        # so other widgets keep being pushed.
        page.mouse.move(x0 + 8, y0 + 4)
        page.evaluate(DRAG, [x0 + 8, y0 + 4, DRAG_MS])
        t_end = page.evaluate('() => performance.timeOrigin + performance.now()')
        frames = page.evaluate('() => { cancelAnimationFrame(window.__dragRaf); return window.__dragFrames; }')
        if page.evaluate('() => document.visibilityState') != 'visible' or len(frames) < 60:
            sys.exit('Chrome throttled the page (window hidden?): run again with it visible.')
        trace = browser.stop_tracing()

        # Screenshot with the widget still held: overlay, ghost and departure outline visible.
        page.wait_for_timeout(600)  # one more overlay sample
        SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SCREENSHOT))
        page.mouse.up()
        browser.close()

    TRACE.write_bytes(trace)

    deltas = [b - a for a, b in zip(frames, frames[1:])]
    raf = {
        'frames': len(frames),
        'seconds': round((frames[-1] - frames[0]) / 1000, 2),
        'fps': round((len(frames) - 1) * 1000 / (frames[-1] - frames[0]), 1),
        'p95_frame_ms': round(statistics.quantiles(deltas, n=20)[18], 1),
        'worst_frame_ms': round(max(deltas), 1),
        'frames_over_33ms': sum(1 for d in deltas if d > 33.4),
    }

    events = json.loads(trace)
    events = events['traceEvents'] if isinstance(events, dict) else events
    # Trace timestamps are microseconds on the same monotonic clock; keep the drag window.
    main_ts = [e['ts'] for e in events if e.get('name') == 'DrawFrame']
    drawn = dropped = 0
    if main_ts:
        lo, hi = min(main_ts), max(main_ts)
        window_s = (hi - lo) / 1e6
        drawn = sum(1 for e in events if e.get('name') == 'DrawFrame')
        dropped = sum(1 for e in events if e.get('name') == 'DroppedFrame')
        begun = sum(1 for e in events if e.get('name') == 'BeginFrame')
        trace_fps = round((drawn - 1) / window_s, 1) if window_s > 0 else None
    else:
        window_s, trace_fps, begun = 0, None, 0
    # Input the script did not send (someone using the mouse wheel over the window).
    stray = sum(
        1 for e in events
        if e.get('name') == 'EventDispatch'
        and e.get('args', {}).get('data', {}).get('type') in ('wheel', 'scroll')
    )

    print(json.dumps({
        'drag_wall_seconds': round((t_end - t_start) / 1000, 2),
        'raf': raf,
        'trace': {
            'draw_frames': drawn,
            'begin_frames': begun,
            'dropped_frames': dropped,
            'stray_wheel_or_scroll_events': stray,
            'window_seconds': round(window_s, 2),
            'fps': trace_fps,
        },
        'screenshot': str(SCREENSHOT),
        'trace_file': str(TRACE),
    }, indent=2))


if __name__ == '__main__':
    main()

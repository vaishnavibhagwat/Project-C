export const SHORTCUTS: readonly [string, string][] = [
  ['Ctrl / ⌘ + K', 'Open global search'],
  ['/', 'Open global search'],
  ['G then 1-7', 'Go to app area (Workstation … Settings)'],
  ['L', 'Lock / unlock layout'],
  ['Esc', 'Close dialogs and panels'],
  ['↑ ↓ Enter', 'Navigate search results'],
];

export function ShortcutsList() {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {SHORTCUTS.map(([keys, action]) => (
        <div key={keys} className="contents">
          <dt>
            <kbd className="num rounded border border-line-strong bg-raised px-1.5 py-0.5 text-xs text-fg">
              {keys}
            </kbd>
          </dt>
          <dd className="text-muted">{action}</dd>
        </div>
      ))}
    </dl>
  );
}

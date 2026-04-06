const SHORTCUTS = [
  { key: '1', desc: 'Live view' },
  { key: '2', desc: 'Grid view' },
  { key: '3', desc: 'Compare' },
  { key: '4', desc: 'Coaching' },
  { key: 'T', desc: 'Toggle theme' },
  { key: 'F', desc: 'Toggle fullscreen' },
  { key: 'Space', desc: 'Toggle ghost line' },
  { key: '?', desc: 'Show/hide shortcuts' },
  { key: 'Esc', desc: 'Close dialogs' },
];

export function ShortcutsHelp({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-raised border border-border rounded-xl p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold uppercase tracking-wider mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-muted">{s.desc}</span>
              <kbd className="px-2 py-0.5 bg-surface-overlay rounded text-xs font-mono border border-border">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-4 text-center">
          Press <kbd className="px-1 bg-surface-overlay rounded text-[10px] border border-border">?</kbd> or <kbd className="px-1 bg-surface-overlay rounded text-[10px] border border-border">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}

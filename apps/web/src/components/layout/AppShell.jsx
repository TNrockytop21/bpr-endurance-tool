import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ShortcutsHelp } from './ShortcutsHelp';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useStreamDeck } from '../../hooks/useStreamDeck';

export function AppShell() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const { isFullscreen } = useFullscreen();
  useStreamDeck();

  return (
    <div className="min-h-screen bg-surface">
      {!isFullscreen && <Header />}
      <main className="p-2 sm:p-4">
        <Outlet />
      </main>
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}

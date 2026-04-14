import { useSession } from '../../context/SessionContext';
import { cn } from '../../lib/utils';

export function Header() {
  const { connected, sessionInfo, drivers } = useSession();
  const driverCount = Object.values(drivers).filter((d) => d.connected).length;

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      height: '42px',
      borderBottom: '1px solid #1a1a1a',
      background: '#0d0d0f',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '26px',
          height: '26px',
          borderRadius: '4px',
          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '9px',
          fontWeight: 900,
        }}>
          BPR
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700 }}>Bite Point Racing</span>
        <span style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          Broadcast
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px' }}>
        {sessionInfo?.trackName && (
          <span style={{ color: '#666' }}>{sessionInfo.trackName}</span>
        )}
        <span style={{ color: '#666' }}>
          {driverCount} driver{driverCount !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
          }} />
          <span style={{ color: connected ? '#22c55e' : '#ef4444' }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}

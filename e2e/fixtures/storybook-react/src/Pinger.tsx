import * as React from 'react';

export function Pinger({ onPing }: { onPing?: () => string }) {
  const [message, setMessage] = React.useState('idle');

  return (
    <button
      type="button"
      onClick={() => setMessage(onPing ? onPing() : 'none')}
    >
      {message}
    </button>
  );
}

// React 19 ignores defaultProps on a function component; React 16 to 18 apply them when `onPing` is undefined.
Pinger.defaultProps = { onPing: () => 'pong' };

export function PingPanel({ reply }: { reply?: () => string }) {
  return <Pinger onPing={reply} />;
}

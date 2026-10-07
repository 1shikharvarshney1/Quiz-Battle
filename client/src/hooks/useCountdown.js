import { useState, useEffect } from 'react';

/**
 * Authoritative countdown hook synchronized with server clock offset.
 *
 * @param {number|null} endsAt Server timestamp when question ends
 * @param {number|null} serverNow Server timestamp at the moment question was dispatched
 * @param {number} totalDurationMs Total question duration in milliseconds
 */
export function useCountdown(endsAt, serverNow, totalDurationMs = 20000) {
  // Offset between client clock and authoritative server clock
  const clockOffset = serverNow ? serverNow - Date.now() : 0;

  const calculateRemaining = () => {
    if (!endsAt) return 0;
    const currentAuthoritativeTime = Date.now() + clockOffset;
    return Math.max(0, endsAt - currentAuthoritativeTime);
  };

  const [remainingMs, setRemainingMs] = useState(calculateRemaining);

  useEffect(() => {
    if (!endsAt) {
      setRemainingMs(0);
      return;
    }

    setRemainingMs(calculateRemaining());

    const interval = setInterval(() => {
      const ms = calculateRemaining();
      setRemainingMs(ms);
      if (ms <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [endsAt, serverNow]);

  const percentage = totalDurationMs > 0 ? Math.max(0, Math.min(100, (remainingMs / totalDurationMs) * 100)) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return {
    remainingMs,
    remainingSeconds,
    percentage,
    isExpired: remainingMs <= 0,
  };
}

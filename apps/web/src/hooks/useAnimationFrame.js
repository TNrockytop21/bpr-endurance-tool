import { useEffect, useRef } from 'react';

export function useAnimationFrame(callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let rafId;
    let intervalId;
    let running = true;

    function loop(timestamp) {
      if (!running) return;
      callbackRef.current(timestamp);
      rafId = requestAnimationFrame(loop);
    }

    // Use rAF as primary driver, with setInterval fallback
    // for headless/background tab scenarios where rAF is throttled
    rafId = requestAnimationFrame(loop);
    intervalId = setInterval(() => {
      callbackRef.current(performance.now());
    }, 50); // 20fps fallback

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      clearInterval(intervalId);
    };
  }, []);
}

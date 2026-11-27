import { useEffect, useState } from 'react';
import { readRuns, scoreChangeEvent } from './scores.js';

export function useSavedRuns() {
  const [runs, setRuns] = useState(readRuns);
  useEffect(() => {
    const refresh = () => setRuns(readRuns());
    window.addEventListener(scoreChangeEvent, refresh);
    window.addEventListener('storage', refresh);
    refresh();
    return () => {
      window.removeEventListener(scoreChangeEvent, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return runs;
}

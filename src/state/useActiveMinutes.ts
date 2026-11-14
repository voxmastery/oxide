import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useApp } from './app';

/**
 * Counts time on learning screens (Reader, Exercise, Terminal, Editor) toward today's goal.
 * Adds a minute for every 60 s the screen is mounted and the app is in the foreground.
 */
export function useActiveMinutes(active = true) {
  useEffect(() => {
    if (!active) return;
    let fg = AppState.currentState === 'active';
    const sub = AppState.addEventListener('change', (s) => { fg = s === 'active'; });
    const id = setInterval(() => { if (fg) useApp.getState().addMinutes(1); }, 60000);
    return () => { clearInterval(id); sub.remove(); };
  }, [active]);
}

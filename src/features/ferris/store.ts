// Ferris preferences. Persisted on its own (AsyncStorage key `oxide-ferris-v1`).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type FerrisState = {
  /** Show Ferris and its reactions (Exercise sheet, Terminal, speed-run results). */
  ferris: boolean;
  setFerris: (on: boolean) => void;
};

export const useFerrisStore = create<FerrisState>()(
  persist(
    (set) => ({
      ferris: true,
      setFerris: (on) => set({ ferris: on }),
    }),
    {
      name: 'oxide-ferris-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ ferris: s.ferris }) as FerrisState,
    },
  ),
);

/** True while Ferris is turned on in Settings. */
export const useFerrisOn = () => useFerrisStore((s) => s.ferris);

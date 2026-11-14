import React from 'react';
import type { Popup } from '../nav/store';
import { OVERLAYS } from './registry';

export function OverlayHost({ popup }: { popup: Popup }) {
  const C = OVERLAYS[popup.kind];
  return C ? <C opts={popup.opts} /> : null;
}

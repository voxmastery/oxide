// Popup registry: kind → component. Implementations live in src/overlays/*.tsx
// (see design/project/Overlays.dc.html and design/SPEC.md "Popups").
import type React from 'react';
import type { PopupKind } from '../nav/store';

export type OverlayProps = { opts: Record<string, any> };

export const OVERLAYS: Partial<Record<PopupKind, React.ComponentType<OverlayProps>>> = {};

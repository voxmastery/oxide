// Entry point for the app: `getToolchain()` returns the one Toolchain for this device.
//
//   Android (arm64, 10+) with the OxideToolchain module → NativeToolchain. Until "Setting up
//     Rust" has finished, its info() reports `installed: false` with a reason, and commands
//     print that reason; install() is what makes it usable.
//   iOS, web, other Android ABIs → UnavailableToolchain, with a message saying why.
//
// No React here: screens call these functions from effects and event handlers.

import { Platform } from 'react-native';

import { OxideToolchain } from '../../modules/oxide-toolchain';
import { documentDirPath } from './fs';
import { createNativeToolchain } from './native';
import type { Toolchain, ToolchainPaths } from './types';
import { MESSAGE_IOS, MESSAGE_NOT_INSTALLED, MESSAGE_WEB, UnavailableToolchain } from './unavailable';

export * from './types';
export { parsePanic, firstErrorCode, stripAnsi } from './diagnostics';
export { payloadManifestUrl } from './native';
export { MESSAGE_IOS, MESSAGE_NOT_INSTALLED, MESSAGE_WEB } from './unavailable';

/** `~` = `<documentDirectory>/home`, as the Terminal shows it. */
export const toolchainPaths: ToolchainPaths = (() => {
  const doc = Platform.OS === 'web' ? null : documentDirPath();
  const home = (doc ?? '/data/oxide') + '/home';
  return { home, projects: `${home}/projects`, rustlings: `${home}/rustlings` };
})();

function unavailableReason(): string {
  if (Platform.OS === 'web') return MESSAGE_WEB;
  if (Platform.OS === 'ios') return MESSAGE_IOS;
  if (!OxideToolchain) {
    return 'Compiling needs the Rust toolchain on Android. This build of Oxide was made without the toolchain module (run a development build with `npx expo run:android`, not Expo Go).';
  }
  if (!OxideToolchain.isSupported) {
    return 'Compiling needs the Rust toolchain on Android, on a 64-bit ARM phone with Android 10 or later.';
  }
  return MESSAGE_NOT_INSTALLED;
}

let instance: Toolchain | null = null;

export function getToolchain(): Toolchain {
  if (!instance) {
    instance =
      Platform.OS === 'android'
        ? createNativeToolchain(OxideToolchain, toolchainPaths, unavailableReason())
        : new UnavailableToolchain(unavailableReason());
  }
  return instance;
}

/** True when this device can compile at all (it may still need the first-run download). */
export function canCompileOnThisDevice(): boolean {
  return Platform.OS === 'android' && !!OxideToolchain?.isSupported;
}

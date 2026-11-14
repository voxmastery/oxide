import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { navActions } from '../../nav/store';

/** Share a result line with the system sheet; on web without a share sheet, copy it instead. */
export async function shareResult(text: string) {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : undefined;
  if (Platform.OS === 'web' && !nav?.share) {
    await Clipboard.setStringAsync(text).catch(() => {});
    navActions().showToast('Result copied');
    return;
  }
  try { await Share.share({ message: text }); } catch { /* dismissed */ }
}

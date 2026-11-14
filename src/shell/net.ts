import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

/** Network state for the offline banner and the setup download (Wi-Fi vs metered). */
export const useNet = create<{ offline: boolean; metered: boolean; wifi: boolean }>(() => ({ offline: false, metered: false, wifi: true }));

let started = false;
export function startNetWatch() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((st) => {
    const offline = st.isConnected === false || st.isInternetReachable === false;
    useNet.setState({ offline, wifi: st.type === 'wifi' || st.type === 'ethernet', metered: !!st.details && 'isConnectionExpensive' in st.details ? !!(st.details as { isConnectionExpensive?: boolean }).isConnectionExpensive : false });
  });
}

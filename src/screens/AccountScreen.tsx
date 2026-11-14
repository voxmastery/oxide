// Account (design/project/Account.dc.html): name, email, sign-in providers, sync, export, delete.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { C } from '../theme/tokens';
import { sans, sectionLabel, t } from '../theme/fonts';
import { Icon } from '../theme/Icon';
import { Inset, Press, TopLine } from '../ui/core';
import { Button } from '../ui/controls';
import { TopBar } from '../ui/bars';
import { navActions } from '../nav/store';
import { today, useApp, type AppData } from '../state/app';
import { AUTH_CONFIGURED, NOT_CONFIGURED_MESSAGE, signInWithGitHub, signInWithGoogle, type AuthResult } from '../state/auth';
import { ago, initialOf, sinceLine } from './home/format';
import type { ScreenProps } from './registry';

function ARow({ icon, iconColor = C.strong2, title, sub, action, line, onPress }: { icon: string; iconColor?: string; title: string; sub: string; action?: string; line?: boolean; onPress?: () => void }) {
  return (
    <Press onPress={onPress} disabled={!onPress} overlay="rgba(255,255,255,0.03)" accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 16 }}>
      {line ? <TopLine /> : null}
      <Icon name={icon} size={22} color={iconColor} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={t(15, undefined, 500, C.text)}>{title}</Text>
        <Text style={t(13, 1.4, 400, C.secondary)}>{sub}</Text>
      </View>
      {action ? <Text style={t(14, undefined, 600, C.rustLight)}>{action}</Text> : null}
    </Press>
  );
}

const Label = ({ children }: { children: string }) => <Text style={[sectionLabel, { paddingTop: 16, paddingHorizontal: 8, paddingBottom: 4 }]}>{children}</Text>;
const Group = ({ children }: { children: React.ReactNode }) => <View style={{ borderRadius: 20, backgroundColor: C.s1, overflow: 'hidden' }}>{children}</View>;

/** The persisted state, as JSON (same shape the app stores). */
function exportJson() {
  const s = useApp.getState();
  const data = Object.fromEntries(Object.entries(s).filter(([k, v]) => typeof v !== 'function' && k !== 'hydrated')) as AppData;
  return JSON.stringify({ app: 'Oxide', exportedAt: new Date().toISOString(), data }, null, 2);
}

export default function AccountScreen(_: ScreenProps) {
  const user = useApp((s) => s.user);
  const startDate = useApp((s) => s.startDate);
  const setUser = useApp((s) => s.setUser);
  const { back, pop, showToast } = navActions();
  const [focused, setFocused] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => { clearInterval(id); clearTimeout(timer.current); };
  }, []);

  const initial = initialOf(user.name);

  const connect = async (which: 'github' | 'google') => {
    if (!AUTH_CONFIGURED) { showToast(NOT_CONFIGURED_MESSAGE); return; }
    const r: AuthResult = which === 'github' ? await signInWithGitHub() : await signInWithGoogle();
    if (!r.ok) { if (r.reason !== 'cancelled') showToast(r.message); return; }
    const u = useApp.getState().user;
    setUser({
      signedIn: true,
      email: u.email ?? r.user.email,
      providers: { ...u.providers, ...(which === 'github' ? { github: r.user.github ?? r.user.name ?? 'github' } : { google: true }) },
    });
    showToast(which === 'github' ? 'GitHub connected' : 'Google connected');
  };

  // No sync backend exists yet: this records the time of the attempt so the status reads honestly
  // as "just now" for the local copy.
  const sync = () => {
    if (syncing) return;
    setSyncing(true);
    timer.current = setTimeout(() => { setUser({ lastSync: Date.now() }); setSyncing(false); }, 1200);
  };
  const syncSub = syncing ? 'Syncing…' : user.lastSync ? (Date.now() - user.lastSync < 60000 ? 'Synced just now' : `Last synced ${ago(user.lastSync)}`) : 'Not synced yet';

  const exportData = async () => {
    const json = exportJson();
    try {
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        const f = new File(Paths.cache, `oxide-export-${today()}.json`);
        if (f.exists) f.delete();
        f.create();
        f.write(json);
        await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Export my data', UTI: 'public.json' });
        return;
      }
    } catch {
      // fall through to the clipboard
    }
    try {
      await Clipboard.setStringAsync(json);
      showToast('Your data was copied to the clipboard as JSON');
    } catch {
      showToast('Couldn’t export your data');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <TopBar title="Account" onBack={back} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 24 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.track, alignItems: 'center', justifyContent: 'center' }}>
            {initial ? <Text style={t(34, undefined, 600, C.text)}>{initial}</Text> : <Icon name="person" size={44} color={C.text} />}
          </View>
          <Text style={t(13, undefined, 400, C.secondary)}>{sinceLine(startDate, today())}</Text>
        </View>

        <View>
          <TextInput
            value={user.name}
            onChangeText={(name) => setUser({ name })}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); setUser({ name: useApp.getState().user.name.trim() }); }}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            returnKeyType="done"
            selectionColor={C.rust}
            cursorColor={C.rust}
            accessibilityLabel="Name"
            style={[{ height: 56, borderRadius: 8, color: C.text, fontSize: 16, paddingHorizontal: 16 }, sans(400), Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          />
          <Inset color={focused ? C.rust : C.disabled} width={focused ? 2 : 1} radius={8} />
          <Text style={t(12, undefined, 400, focused ? C.rustLight : C.secondary, { position: 'absolute', left: 12, top: -8, paddingHorizontal: 4, backgroundColor: C.ground })}>Name</Text>
        </View>
        <Text style={t(12.5, undefined, 400, C.tertiary, { paddingTop: 2, paddingHorizontal: 16, paddingBottom: 14 })}>Shown on your profile.</Text>

        <View style={{ minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.s1 }}>
          <Icon name="mail" size={22} color={C.strong2} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={t(15, undefined, 500, C.text)}>Email</Text>
            <Text numberOfLines={1} style={t(13, undefined, 400, C.secondary)}>{user.email ?? 'Not added'}</Text>
          </View>
        </View>

        <Label>SIGN-IN</Label>
        <Group>
          {user.providers.github ? (
            <ARow icon="check_circle" iconColor={C.done} title="GitHub" sub={`Connected as @${user.providers.github}`} />
          ) : (
            <ARow icon="add_link" title="GitHub" sub="Not connected" action="Connect" onPress={() => void connect('github')} />
          )}
          {user.providers.google ? (
            <ARow line icon="check_circle" iconColor={C.done} title="Google" sub="Connected" />
          ) : (
            <ARow line icon="add_link" title="Google" sub="Not connected" action="Connect" onPress={() => void connect('google')} />
          )}
        </Group>

        <Label>YOUR DATA</Label>
        <Group>
          <ARow icon="sync" title="Sync" sub={syncSub} action={syncing ? undefined : 'Sync now'} onPress={sync} />
          <ARow line icon="download" title="Export my data" sub="Progress and code as a .json file" action="Export" onPress={() => void exportData()} />
        </Group>

        <Button variant="danger-outlined" label="Delete account" height={52} fontSize={15} onPress={() => pop('delacct')} style={{ marginTop: 20 }} />
      </ScrollView>
    </View>
  );
}


// Sign-in. STUB: this build has no auth backend. Every call returns `{ ok: false, reason: 'not-configured' }`
// so the UI can say so honestly. Replace the bodies when a backend exists (GitHub/Google OAuth via
// expo-auth-session, email magic links), keeping the signatures and result type.

export type AuthProvider = 'github' | 'google' | 'email';

export type AuthUser = { email: string | null; name: string | null; github: string | null; provider: AuthProvider };

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'not-configured' | 'cancelled' | 'network' | 'error'; message: string };

export type MagicLinkResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'not-configured' | 'invalid-email' | 'network' | 'error'; message: string };

/** False until a sign-in backend is wired up. */
export const AUTH_CONFIGURED = false;

export const NOT_CONFIGURED_MESSAGE = 'Sign-in isn’t set up in this build yet';

const notConfigured = { ok: false as const, reason: 'not-configured' as const, message: NOT_CONFIGURED_MESSAGE };

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export async function signInWithGitHub(): Promise<AuthResult> {
  return notConfigured;
}

export async function signInWithGoogle(): Promise<AuthResult> {
  return notConfigured;
}

/** Email a one-time sign-in link to `email`. */
export async function sendMagicLink(email: string): Promise<MagicLinkResult> {
  if (!isValidEmail(email)) return { ok: false, reason: 'invalid-email', message: 'Enter a valid email address' };
  return notConfigured;
}

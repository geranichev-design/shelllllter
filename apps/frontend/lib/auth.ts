import { createDemoAuth, DEMO_AUTH_KEY, isDemoMode } from './demo/config';

export type StoredAuth = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    orgId: string | null;
  };
};

const authKey = isDemoMode ? DEMO_AUTH_KEY : 'shelter-auth';
let demoAuth: StoredAuth = createDemoAuth();

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(authKey);
    if (!raw) return isDemoMode ? demoAuth : null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return isDemoMode ? demoAuth : null;
  }
}

export function setStoredAuth(auth: StoredAuth) {
  if (isDemoMode) demoAuth = auth;
  try {
    window.localStorage.setItem(authKey, JSON.stringify(auth));
  } catch (error) {
    if (!isDemoMode) throw error;
  }
}

export function clearStoredAuth() {
  if (isDemoMode) demoAuth = createDemoAuth();
  try {
    window.localStorage.removeItem(authKey);
  } catch (error) {
    if (!isDemoMode) throw error;
  }
}

export function hasStoredAuth() {
  const auth = getStoredAuth();
  return Boolean(auth?.accessToken && auth.user?.email && auth.user?.id && auth.user?.role);
}

export function canCreateShelterRequest(role?: string | null) {
  return role === 'BALANCE_HOLDER' || role === 'GOV_ORG' || role === 'DSNS';
}

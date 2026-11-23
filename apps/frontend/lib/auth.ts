export type StoredAuth = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    orgId: string | null;
  };
};

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem('shelter-auth');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth) {
  window.localStorage.setItem('shelter-auth', JSON.stringify(auth));
}

export function clearStoredAuth() {
  window.localStorage.removeItem('shelter-auth');
}

export function hasStoredAuth() {
  const auth = getStoredAuth();
  return Boolean(auth?.accessToken && auth.user?.email && auth.user?.id && auth.user?.role);
}

export function canCreateShelterRequest(role?: string | null) {
  return role === 'BALANCE_HOLDER' || role === 'GOV_ORG' || role === 'DSNS';
}

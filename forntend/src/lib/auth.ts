export type AuthRole = 'employee' | 'admin';

export interface AuthSessionData {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: AuthRole;
  };
}

const EMPLOYEE_AUTH_KEY = 'synov_employee_auth';
const ADMIN_AUTH_KEY = 'synov_admin_auth';

export const getStoredAuth = (role?: AuthRole): AuthSessionData | null => {
  if (typeof window === 'undefined') return null;

  const storageKeys = role === 'admin'
    ? [ADMIN_AUTH_KEY]
    : role === 'employee'
      ? [EMPLOYEE_AUTH_KEY]
      : [EMPLOYEE_AUTH_KEY, ADMIN_AUTH_KEY];

  for (const key of storageKeys) {
    const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (!value) continue;

    try {
      const parsed = JSON.parse(value) as AuthSessionData;
      if (parsed?.token && parsed?.user) {
        return parsed;
      }
    } catch {
      // ignore malformed auth payloads
    }
  }

  return null;
};

export const setStoredAuth = (data: AuthSessionData, rememberMe: boolean) => {
  if (typeof window === 'undefined') return;

  const targetStorage = rememberMe ? window.localStorage : window.sessionStorage;
  targetStorage.setItem(data.user.role === 'admin' ? ADMIN_AUTH_KEY : EMPLOYEE_AUTH_KEY, JSON.stringify(data));

  if (rememberMe) {
    window.sessionStorage.removeItem(data.user.role === 'admin' ? ADMIN_AUTH_KEY : EMPLOYEE_AUTH_KEY);
  }
};

export const clearStoredAuth = () => {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(EMPLOYEE_AUTH_KEY);
  window.localStorage.removeItem(ADMIN_AUTH_KEY);
  window.sessionStorage.removeItem(EMPLOYEE_AUTH_KEY);
  window.sessionStorage.removeItem(ADMIN_AUTH_KEY);
};

export const isAuthenticated = (role?: AuthRole) => {
  const auth = getStoredAuth();
  if (!auth) return false;
  if (role && auth.user.role !== role) return false;
  return Boolean(auth.token);
};

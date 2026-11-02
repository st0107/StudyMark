import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api';
import type { LoginInput, RegisterInput, User } from '../../shared/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const restore = useCallback(() => {
    setLoading(true);
    api.getSession().then(setUser).catch(() => setError('Could not open browser storage. Enable site storage, then reload.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    restore();
    const onStorage = () => { client.clear(); restore(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [restore, client]);
  const value: AuthContextValue = {
    user, loading, error,
    login: async (input) => { const next = await api.login(input); client.clear(); setUser(next); setError(''); },
    register: async (input) => { const next = await api.register(input); client.clear(); setUser(next); setError(''); },
    logout: async () => { await api.logout(); client.clear(); setUser(null); },
    updateProfile: async (displayName) => setUser(await api.updateProfile({ displayName })),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// Shared by route guards and authenticated feature screens.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}

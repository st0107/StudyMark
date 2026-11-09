import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, isMockApi } from '../../shared/api';
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
  const sessionRequest = useRef(0);
  const profileRequest = useRef(0);
  const restore = useCallback(() => {
    const request = ++sessionRequest.current;
    setLoading(true);
    setError('');
    api.getSession().then(next => {
      if (request === sessionRequest.current) setUser(next);
    }).catch(() => {
      if (request === sessionRequest.current) {
        setUser(null);
        setError(isMockApi ? 'Could not open browser storage. Enable site storage, then reload.' : 'Could not restore your session. Check your connection, then retry.');
      }
    }).finally(() => { if (request === sessionRequest.current) setLoading(false); });
  }, []);
  useEffect(() => {
    restore();
    const onStorage = (event: StorageEvent) => {
      if (isMockApi && (event.key === null || event.key === 'studymark.session' || event.key === 'studymark.session.revision')) {
        client.clear(); restore();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { sessionRequest.current += 1; window.removeEventListener('storage', onStorage); };
  }, [restore, client]);
  const value: AuthContextValue = {
    user, loading, error,
    login: async (input) => {
      const request = ++sessionRequest.current;
      try {
        const next = await api.login(input);
        if (request === sessionRequest.current) { client.clear(); setUser(next); setError(''); }
      } finally { if (request === sessionRequest.current) setLoading(false); }
    },
    register: async (input) => {
      const request = ++sessionRequest.current;
      try {
        const next = await api.register(input);
        if (request === sessionRequest.current) { client.clear(); setUser(next); setError(''); }
      } finally { if (request === sessionRequest.current) setLoading(false); }
    },
    logout: async () => {
      const request = ++sessionRequest.current;
      try {
        await api.logout();
        if (request === sessionRequest.current) { client.clear(); setUser(null); setError(''); }
      } finally { if (request === sessionRequest.current) setLoading(false); }
    },
    updateProfile: async (displayName) => {
      const session = sessionRequest.current;
      const request = ++profileRequest.current;
      const next = await api.updateProfile({ displayName });
      if (session === sessionRequest.current && request === profileRequest.current) setUser(next);
    },
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

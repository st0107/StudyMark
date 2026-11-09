import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../shared/types';
import { AuthProvider, useAuth } from './AuthProvider';

const api = vi.hoisted(() => ({
  getSession: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), updateProfile: vi.fn(),
}));
vi.mock('../../shared/api', () => ({ api, isMockApi: true }));

const alex: User = { id: 'user-alex', displayName: 'Alex', email: 'alex@studymark.app', role: 'USER' };
const sam: User = { id: 'user-sam', displayName: 'Sam', email: 'sam@studymark.app', role: 'USER' };
const credentials = { email: alex.email, password: 'StudyMark123!' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function renderAuth() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
  return renderHook(() => useAuth(), { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getSession.mockResolvedValue(null);
  api.login.mockResolvedValue(alex);
  api.logout.mockResolvedValue(undefined);
});

describe('authentication request ordering', () => {
  it('keeps an explicit login when the initial session restore finishes later', async () => {
    const restoration = deferred<User | null>();
    api.getSession.mockReturnValue(restoration.promise);
    const { result } = renderAuth();
    await act(async () => { await result.current.login(credentials); });
    expect(result.current.user).toEqual(alex);
    expect(result.current.loading).toBe(false);
    await act(async () => { restoration.resolve(null); });
    expect(result.current.user).toEqual(alex);
  });

  it('does not restore an account from a profile response that arrives after logout', async () => {
    api.getSession.mockResolvedValue(alex);
    const profile = deferred<User>();
    api.updateProfile.mockReturnValue(profile.promise);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual(alex));
    const saving = result.current.updateProfile('Updated Alex');
    await act(async () => { await result.current.logout(); });
    await act(async () => { profile.resolve({ ...alex, displayName: 'Updated Alex' }); await saving; });
    expect(result.current.user).toBeNull();
  });

  it('ignores a profile response after switching accounts through another tab', async () => {
    api.getSession.mockResolvedValue(alex);
    const profile = deferred<User>();
    api.updateProfile.mockReturnValue(profile.promise);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual(alex));
    const saving = result.current.updateProfile('Updated Alex');
    api.getSession.mockResolvedValue(sam);
    await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'studymark.session' })); });
    expect(result.current.user).toEqual(sam);
    await act(async () => { profile.resolve({ ...alex, displayName: 'Updated Alex' }); await saving; });
    expect(result.current.user).toEqual(sam);
  });

  it('ignores a stale session error after a successful login', async () => {
    const restoration = deferred<User | null>();
    api.getSession.mockReturnValue(restoration.promise);
    const { result } = renderAuth();
    await act(async () => { await result.current.login(credentials); });
    await act(async () => { restoration.reject(new Error('Storage failed')); });
    expect(result.current.user).toEqual(alex);
    expect(result.current.error).toBe('');
  });
});

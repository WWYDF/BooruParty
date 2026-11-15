'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { API } from '@/core/api';
import { UserPrivateSummary } from '@/core/types/users';

type UserContextValue = {
  user: UserPrivateSummary | null | undefined; // undefined = still loading, null = logged out
  setUser: (user: UserPrivateSummary | null) => void;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPrivateSummary | null | undefined>(undefined);

  useEffect(() => {
    API('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await API('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  return <UserContext.Provider value={{ user, setUser, logout }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>');
  return ctx;
}

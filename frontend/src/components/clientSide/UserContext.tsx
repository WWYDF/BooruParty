'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type UserInfo = {
  id: string;
  username?: string;
  avatar?: string;
  role: {
    name: string;
    permissions: { name: string }[];
  };
};

type UserContextType = {
  user: UserInfo | null;
  refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  refreshUser: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/users/self', { cache: 'no-store' });
      if (!res.ok) return setUser(null);
  
      const data = await res.json();
  
      if (
        (data && typeof data.id === "string") || // logged-in user
        data?.role?.name === "GUEST"             // fallback guest
      ) {
        setUser(data);
        console.log("[UserProvider] setUser called with:", data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

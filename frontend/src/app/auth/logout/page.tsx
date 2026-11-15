'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserProvider';

export default function LogoutPage() {
  const { logout } = useUser();
  const router = useRouter();

  useEffect(() => {
    logout().then(() => router.replace('/'));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center text-subtle">
      Logging you out...
    </main>
  );
}

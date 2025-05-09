"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

export default function LogoutPage() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated" || status === "unauthenticated") {
      signOut({ callbackUrl: "/" });
    }
  }, [status]);

  return (
    <main className="min-h-screen flex items-center justify-center text-subtle">
      Logging you out...
    </main>
  );
}
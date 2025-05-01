"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function LogoutPage() {
  useEffect(() => {
    // Trigger logout and redirect to home (or login)
    signOut({ callbackUrl: "/" });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center text-subtle">
      Logging you out...
    </main>
  );
}

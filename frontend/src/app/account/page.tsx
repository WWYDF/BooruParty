'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountHeader from "@/components/Account/AccountHeader";
import BrowserCard from "@/components/Account/BrowserCard";
import ContentCard from "@/components/Account/ContentCard";
import EmailCard from "@/components/Account/EmailCard";
import PasswordCard from "@/components/Account/PasswordCard";
import PrivacyCard from "@/components/Account/PrivacyCard";
import ProfileCard from "@/components/Account/ProfileCard";
import SessionCard from "@/components/Account/SessionCard";
import TagsCard from "@/components/Account/TagsCard";
import { useUser } from "@/components/UserProvider";
import { API } from "@/core/api";
import { AccountDetails } from "@/core/types/users";

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser, logout } = useUser();
  const [me, setMe] = useState<AccountDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Logged out: go log in
  useEffect(() => {
    if (user === null) router.replace("/auth/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    API("/api/me")
      .then(async (res) => (res.ok ? setMe(await res.json()) : setError("Could not load your account.")))
      .catch(() => setError("The server could not be reached."));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="py-10 text-center text-sm text-red-400">{error}</p>;
  if (!user || !me) return <p className="py-10 text-center text-sm text-zinc-600">Loading...</p>;

  // Keeps the navbar (useUser) in sync with what changed here
  const accountSaved = (updated: Partial<AccountDetails>) => {
    setMe({ ...me, ...updated });
    setUser({
      ...user,
      ...(updated.username !== undefined && { username: updated.username }),
      ...(updated.email !== undefined && { email: updated.email }),
      ...(updated.private !== undefined && { private: updated.private }),
      ...(updated.avatar !== undefined && { avatar: updated.avatar }),
    });
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-[90%] space-y-6 px-4 py-8">
      <AccountHeader me={me} />

      <div className="grid items-start gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <ProfileCard me={me} canEditAvatar={user.permissions.includes("profile.edit.avatar")} onSaved={accountSaved} />
          <EmailCard me={me} onSaved={accountSaved} />
          <PasswordCard />
          <PrivacyCard me={me} onSaved={accountSaved} />
        </div>

        <div className="space-y-6">
          <ContentCard
            me={me}
            canChangeBackground={user.permissions.includes("profile.edit.background")}
            onSaved={(preferences) => setMe({ ...me, preferences })}
          />
          <TagsCard />
          <BrowserCard />
          <SessionCard onLogout={handleLogout} />
        </div>
      </div>
    </div>
  );
}

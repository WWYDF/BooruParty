import AvatarUpload from "@/components/clientSide/UserSettings/AvatarUpload";
import InfoForm from "@/components/clientSide/UserSettings/InfoForm";
import PasswordChangeForm from "@/components/clientSide/UserSettings/PasswordForm";
import PreferencesForm from "@/components/clientSide/UserSettings/Preferences";
import { auth } from "@/core/authServer";
import { redirect } from "next/navigation";


export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) { redirect("/login") }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-accent mb-8">Profile Settings</h1>
      <a
        href={`/users/${session.user.username}`}
        className="inline-block mb-6 px-4 py-2 text-sm font-medium bg-zinc-900 text-accent rounded-md border border-zinc-800 hover:bg-zinc-950 hover:border-black transition"
      >
        View My Public Profile →
      </a>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <InfoForm currentUsername={session.user.username} />
          <PasswordChangeForm username={session.user.username} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <AvatarUpload username={session.user.username} />
          <PreferencesForm username={session.user.username} />
        </div>
      </div>
    </div>
  );
}
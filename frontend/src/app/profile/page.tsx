import AvatarUpload from "@/components/clientSide/UserSettings/AvatarUpload";
import InfoForm from "@/components/clientSide/UserSettings/InfoForm";
import PasswordChangeForm from "@/components/clientSide/UserSettings/PasswordForm";
import PreferencesForm from "@/components/clientSide/UserSettings/Preferences";


export default function ProfileSettingsPage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-accent mb-8">Profile Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <InfoForm />
          <PasswordChangeForm />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <AvatarUpload />
          <PreferencesForm />
        </div>
      </div>
    </div>
  );
}
import { AccountCard, Field, inputClass } from "./AccountCard";

// Placeholder: Preferences has no blacklist/favorites yet
export default function TagsCard() {
  return (
    <AccountCard title="Tags" badge="Coming soon" description="Hide posts with certain tags, and show off your favorites on your profile.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Blacklisted tags">
          <input type="text" disabled placeholder="Search tags..." className={inputClass} />
        </Field>
        <Field label="Favorite tags">
          <input type="text" disabled placeholder="Search tags..." className={inputClass} />
        </Field>
      </div>
    </AccountCard>
  );
}

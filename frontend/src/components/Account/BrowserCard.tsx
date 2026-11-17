'use client';

import { useEffect, useState } from "react";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import Dropdown from "@/components/UI/Dropdown";
import { FullCheckbox } from "@/components/UI/FullCheckbox";
import { useToast } from "@/components/UI/Toast";
import { AccountCard, Field, inputClass } from "./AccountCard";

// Read by PostsPage and PostNavigator
const BROWSER_PREFS_KEY = "browserPreferences";

type BrowserPrefs = { layout: "GRID" | "COLLAGE"; postsPerPage: number; flipNavigators: boolean };
const DEFAULTS: BrowserPrefs = { layout: "GRID", postsPerPage: 75, flipNavigators: false };

const readStored = () => JSON.parse(localStorage.getItem(BROWSER_PREFS_KEY) ?? "{}");

export default function BrowserCard() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<BrowserPrefs>(DEFAULTS);
  const [postsPerPage, setPostsPerPage] = useState(String(DEFAULTS.postsPerPage));

  useEffect(() => {
    try {
      const merged = { ...DEFAULTS, ...readStored() };
      setPrefs(merged);
      setPostsPerPage(String(merged.postsPerPage));
    } catch { /* bad JSON or blocked storage: keep the defaults */ }
  }, []);

  // Saves instantly, keeping any other keys already stored
  const update = (patch: Partial<BrowserPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(BROWSER_PREFS_KEY, JSON.stringify({ ...readStored(), ...next }));
    } catch {
      toast("This browser won't let us save preferences", "error");
    }
  };

  const commitPostsPerPage = () => {
    const n = Math.min(100, Math.max(1, Math.round(Number(postsPerPage)) || DEFAULTS.postsPerPage));
    setPostsPerPage(String(n));
    if (n !== prefs.postsPerPage) update({ postsPerPage: n });
  };

  return (
    <AccountCard title="This browser" description="Only saved on this device. Changes apply immediately.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Feed layout">
            <Dropdown
              value={prefs.layout}
              options={[{ value: "GRID", label: "Grid" }, { value: "COLLAGE", label: "Collage" }]}
              onChange={(layout) => update({ layout })}
            />
          </Field>
          <Field label="Posts per page" hint="1-100">
            <input
              type="number"
              min={1}
              max={100}
              value={postsPerPage}
              onChange={(e) => setPostsPerPage(e.target.value)}
              onBlur={commitPostsPerPage}
              onKeyDown={(e) => e.key === "Enter" && commitPostsPerPage()}
              className={inputClass}
            />
          </Field>
        </div>

        <FullCheckbox
          checked={prefs.flipNavigators}
          onChange={(flipNavigators) => update({ flipNavigators })}
          icon={<ArrowsLeftRightIcon size={18} />}
          label="Flip post navigation"
          description="Swap the next and previous buttons on post pages."
        />
      </div>
    </AccountCard>
  );
}

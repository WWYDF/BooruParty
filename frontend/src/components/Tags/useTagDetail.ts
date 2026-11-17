"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/core/api";
import { TagDetail } from "@/core/types/tags";
import { CategoryInfo } from "@/components/Posts/Individual/PostView";

// Loads a tag + all categories for the /tags/[name]/* pages.
// Opened through an alias -> replaces the URL with the real name (same sub page), so edits/merges/deletes
// always act on the real tag, never on "pkmn" meaning "pokemon".
export function useTagDetail(name: string | undefined, section: "" | "edit" | "merge" | "delete") {
  const router = useRouter();
  const [tag, setTag] = useState<TagDetail | null>(null);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const [tagRes, catRes] = await Promise.all([API(`/api/tags/${name}`), API("/api/tag-categories")]);
        if (cancelled) return;

        if (!tagRes.ok) {
          setError(tagRes.status === 404 ? "Tag not found." : "Could not load this tag.");
          return;
        }

        const data: TagDetail = await tagRes.json();
        if (data.matchedAlias) {
          const base = `/tags/${encodeURIComponent(data.name)}`;
          router.replace(section ? `${base}/${section}` : base);
          return;
        }

        const cats: CategoryInfo[] = catRes.ok ? await catRes.json() : [];
        setCategories([...cats].sort((a, b) => a.index - b.index));
        setTag(data);
      } catch {
        if (!cancelled) setError("The server could not be reached.");
      }
    })();

    return () => { cancelled = true; };
  }, [name, section, reloadKey]);

  return { tag, categories, error, reload: () => setReloadKey((k) => k + 1) };
}

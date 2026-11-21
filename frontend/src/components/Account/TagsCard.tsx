'use client';

import { useEffect, useState } from "react";
import { EyeSlashIcon, FloppyDiskIcon, ProhibitIcon, StarIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import TagInput from "@/components/Uploads/TagInput";
import { ColoredTag, UserTagLists } from "@/core/types/tags";
import { TagChip } from "@/core/types/uploads";
import { AccountCard, CardActions } from "./AccountCard";
import { useSend } from "./useSend";

const toChip = (t: ColoredTag): TagChip => ({ name: t.name, color: t.category.color, postCount: t.postCount });
const sameNames = (a: TagChip[], b: TagChip[]) => a.length === b.length && a.every((x) => b.some((y) => y.name === x.name));

// Favorite tags (shown on your profile) and blacklisted tags (posts with them are left out of every list you see)
export default function TagsCard() {
  const send = useSend();
  const toast = useToast();

  const [saved, setSaved] = useState<UserTagLists | null>(null);
  const [failed, setFailed] = useState(false);
  const [favorites, setFavorites] = useState<TagChip[]>([]);
  const [blacklist, setBlacklist] = useState<TagChip[]>([]);
  const [saving, setSaving] = useState(false);

  const apply = (lists: UserTagLists) => {
    setSaved(lists);
    setFavorites(lists.favorites.map(toChip));
    setBlacklist(lists.blacklist.map(toChip));
  };

  useEffect(() => {
    send<UserTagLists>("/api/me/tags", "GET").then((lists) => (lists ? apply(lists) : setFailed(true)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <AccountCard title="Tags">
        <p className="text-xs text-red-400">Could not load your tag lists.</p>
      </AccountCard>
    );
  }
  if (!saved) {
    return (
      <AccountCard title="Tags">
        <p className="animate-pulse text-xs text-subtle">Loading...</p>
      </AccountCard>
    );
  }

  const { limits } = saved;
  const favoritesChanged = !sameNames(favorites, saved.favorites.map(toChip));
  const blacklistChanged = !sameNames(blacklist, saved.blacklist.map(toChip));
  const dirty = favoritesChanged || blacklistChanged;

  // A tag can't be both: adding it to one list takes it out of the other
  const changeList = (
    next: TagChip[],
    max: number,
    setThis: (t: TagChip[]) => void,
    other: TagChip[],
    setOther: (t: TagChip[]) => void,
    otherLabel: string,
  ) => {
    if (next.length > max) return toast(`You can have up to ${max} here`, "error");
    const moved = other.filter((o) => next.some((n) => n.name === o.name));
    if (moved.length) {
      setOther(other.filter((o) => !moved.includes(o)));
      toast(`Removed ${moved.map((m) => m.name).join(", ")} from your ${otherLabel}`, "info");
    }
    setThis(next);
  };

  const save = async () => {
    setSaving(true);
    let latest: UserTagLists | null = null;
    let failedOne = false;

    // Blacklist first: if a tag moved from blacklist to favorites, it's gone from the blacklist before it's favorited
    if (blacklistChanged) {
      latest = await send<UserTagLists>("/api/me/tags/blacklist", "PUT", { names: blacklist.map((t) => t.name) });
      if (!latest) failedOne = true;
    }
    if (favoritesChanged) {
      const result = await send<UserTagLists>("/api/me/tags/favorites", "PUT", { names: favorites.map((t) => t.name) });
      if (result) latest = result;
      else failedOne = true;
    }

    setSaving(false);
    if (!latest) return; // nothing saved (errors already toasted)

    // Each response has BOTH lists as the server stores them; keep any unsaved edit to the list that failed
    setSaved(latest);
    if (!failedOne || !favoritesChanged) setFavorites(latest.favorites.map(toChip));
    if (!failedOne || !blacklistChanged) setBlacklist(latest.blacklist.map(toChip));
    if (!failedOne) toast("Tags saved", "success");
  };

  const counter = (count: number, max: number) => (
    <span className={`ml-auto text-2xs tabular-nums ${count >= max ? "text-amber-400" : "text-zinc-600"}`}>
      {count} / {max}
    </span>
  );

  return (
    <AccountCard title="Tags">
      <div className="space-y-5">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <StarIcon size={14} className="text-yellow-400" />
            Favorite tags
            {counter(favorites.length, limits.favorites)}
          </p>
          <p className="mb-2 text-xs text-zinc-600">Shown on your profile, grouped by category.</p>
          {limits.favorites === 0 ? (
            <p className="text-xs text-subtle">Favorite tags are turned off on this site.</p>
          ) : (
            <TagInput
              value={favorites}
              onChange={(next) => changeList(next, limits.favorites, setFavorites, blacklist, setBlacklist, "blacklist")}
              placeholder="Add a favorite tag..."
              disabled={saving}
            />
          )}
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <EyeSlashIcon size={14} className="text-red-400" />
            Blacklisted tags
            {counter(blacklist.length, limits.blacklist)}
          </p>
          <p className="mb-2 text-xs text-zinc-600">
            Posts with any of these are hidden from the feed, pools, collections and related posts. A direct link still opens them.
          </p>
          {limits.blacklist === 0 ? (
            <p className="text-xs text-subtle">The blacklist is turned off on this site.</p>
          ) : (
            <TagInput
              value={blacklist}
              onChange={(next) => changeList(next, limits.blacklist, setBlacklist, favorites, setFavorites, "favorites")}
              placeholder="Add a tag to hide..."
              disabled={saving}
            />
          )}
        </div>
      </div>

      <CardActions>
        <Button size="lg" variant="success" icon={<FloppyDiskIcon size={16} />} loading={saving} disabled={!dirty} onClick={save}>
          Save tags
        </Button>
      </CardActions>
    </AccountCard>
  );
}

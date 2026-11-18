"use client";

import Link from "next/link";
import { StarIcon } from "@phosphor-icons/react";
import { Safety } from "@/core/types/posts";

type PoolCardProps = {
  name: string;
  artist?: string | null;
  coverUrl?: string | null;
  safety?: Safety | null;
  showOverlay?: boolean; // false = plain thumbnail (posts inside a pool)
  linkTo?: string;
  yearStart?: number | null;
  yearEnd?: number | null;
  favoriteCount?: number;
  postCount?: number;
};

const SAFETY_LABEL: Record<Safety, string> = {
  SAFE: "Safe",
  QUESTIONABLE: "Questionable",
  EXPLICIT: "Explicit",
};

export function PoolCard({
  name,
  artist,
  coverUrl,
  safety,
  showOverlay = true,
  linkTo,
  yearStart,
  yearEnd,
  favoriteCount,
  postCount,
}: PoolCardProps) {
  const content = (
    <div className="relative aspect-9/16 rounded-lg overflow-hidden bg-secondary border border-secondary-border group">
      {/* Safety Badge */}
      {safety && showOverlay && (
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-xs font-medium rounded bg-black/70 text-white">
          {SAFETY_LABEL[safety]}
        </div>
      )}

      {/* Post count */}
      {typeof postCount === "number" && showOverlay && (
        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 text-xs font-medium rounded bg-black/70 text-white tabular-nums">
          {postCount} {postCount === 1 ? "post" : "posts"}
        </div>
      )}

      {/* Cover */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={name}
          draggable={false}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 z-0"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-subtle text-sm">
          No cover
        </div>
      )}

      {/* Overlay */}
      {showOverlay && (
        <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none">
          <div className="absolute -top-6 left-0 w-full h-6 bg-linear-to-t from-black/70 to-transparent" />
          <div className="bg-black/80 px-3 pt-2 pb-1">
            {typeof favoriteCount === "number" && favoriteCount > 0 && (
              <div className="absolute right-2 top-[65%] -translate-y-1/2 flex items-center gap-1 text-xs bg-black/60 px-2 py-0.5 rounded-full">
                <StarIcon size={12} weight="fill" className="text-yellow-400" />
                <span className="text-white/80 tabular-nums">{favoriteCount}</span>
              </div>
            )}
            <div className="text-sm font-semibold text-white truncate">{name}</div>
            <div className="text-xs text-white/70 truncate">by {artist ?? "Unknown"}</div>
            {yearStart && (
              <div className="text-2xs text-subtle truncate">
                {yearStart}{" "}
                <span className="text-white/30">—</span>{" "}
                {yearEnd ?? "Present"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return linkTo ? <Link href={linkTo}>{content}</Link> : content;
}

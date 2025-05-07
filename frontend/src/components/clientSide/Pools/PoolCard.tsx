"use client";

import Link from "next/link";
import React from "react";

type PoolCardProps = {
  id: number;
  name: string;
  artist?: string | null;
  coverUrl?: string | null;
  safety?: "SAFE" | "UNSAFE" | "SKETCHY";
  showOverlay?: boolean;
  linkTo?: string;
  yearStart?: number | null;
  yearEnd?: number | null;
};


export function PoolCard({
  id,
  name,
  artist = "Unknown",
  coverUrl,
  safety,
  showOverlay = true,
  linkTo,
  yearStart,
  yearEnd,
}: PoolCardProps) {
  const content = (
    <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-secondary border border-secondary-border group">
      {/* Safety Badge */}
      {safety && showOverlay && (
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 text-xs font-medium rounded bg-black/70 text-white">
          {safety}
        </div>
      )}

      {/* Cover */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={name}
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
          <div className="absolute -top-6 left-0 w-full h-6 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="bg-black/70 px-3 pt-2 pb-1">
            <div className="text-sm font-semibold text-white truncate">{name}</div>
            <div className="text-xs text-white/70 truncate">by {artist}</div>
            {yearStart && (
              <div className="text-[10px] text-subtle truncate">
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

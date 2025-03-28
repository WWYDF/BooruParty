'use client';
import { useState, useEffect } from "react";
import EditPostModal from "./EditPost";
import { AnimatePresence } from "framer-motion";
import { PencilSimple, Tag } from "@phosphor-icons/react";

import Image from "next/image";
import Link from "next/link";

const AVATAR_URL = "https://placehold.co/48x48";

export type Props = {
  post: {
    id: number;
    uploadedBy: string;
    anonymous: boolean;
    safety: string;
    sources: string[];
    notes: string | null;
    createdAt: string;
    score: number;
    postTags: {
      tag: {
        name: string;
        parentTag: {
          category: {
            name: string;
            color: string;
          };
        };
      };
    }[];
  };
};

type UploaderInfo = {
  username: string;
  avatar?: string;
  layout?: string;
};

export default function PostMetadata({ post }: Props) {
  const [editing, setEditing] = useState(false);
  const [uploader, setUploader] = useState<UploaderInfo | null>(null);
  const [tagGroups, setTagGroups] = useState<Record<string, { name: string; color: string }[]>>({});

  useEffect(() => {
    if (post.anonymous) return;
    const fetchUploader = async () => {
      const res = await fetch(`/api/users/${post.uploadedBy}`);
      if (res.ok) {
        const data = await res.json();
        setUploader(data);
      }
    };
    fetchUploader();
  }, [post.anonymous, post.uploadedBy]);

  useEffect(() => {
    const grouped: Record<string, { name: string; color: string }[]> = {};

    for (const pt of post.postTags) {
      const name = pt.tag.name;
      const category = pt.tag.parentTag.category;
      if (!category?.name) continue;

      if (!grouped[category.name]) grouped[category.name] = [];
      grouped[category.name].push({ name, color: category.color });
    }

    setTagGroups(grouped);
  }, [post.postTags]);

  const displayName = post.anonymous ? "Anonymous" : uploader?.username || post.uploadedBy;
  const displayAvatar = post.anonymous ? AVATAR_URL : uploader?.avatar || AVATAR_URL;

  return (
    <div className="flex flex-col gap-4 text-sm text-subtle">
      <div className="flex items-center gap-3">
        <Image
          src={displayAvatar}
          alt="Uploader avatar"
          width={48}
          height={48}
          className="rounded-full border border-secondary-border"
        />
        <div>
          <p className="text-base text-white font-semibold">{displayName}</p>
          <p className="text-xs text-subtle">{new Date(post.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
        <p><span className="text-white font-medium">Safety:</span> {post.safety}</p>
        <p><span className="text-white font-medium">Score:</span> {post.score}</p>
        <p className="col-span-2">
          <span className="text-white font-medium">Sources:</span>{" "}
          {post.sources.length ? (
            <span className="flex flex-wrap gap-2">
              {post.sources.map((src, i) => (
                <Link key={i} href={src} target="_blank" className="text-accent underline break-all">
                  {src}
                </Link>
              ))}
            </span>
          ) : "None"}
        </p>
        <p className="col-span-2">
          <span className="text-white font-medium">Notes:</span>{" "}
          {post.notes || "None"}
        </p>
      </div>

      <button
        onClick={() => setEditing(true)}
        className="text-subtle hover:text-accent text-sm flex items-center gap-1 mt-2"
      >
        <PencilSimple size={16} /> Edit post
      </button>

      {Object.keys(tagGroups).length > 0 && (
        <div className="flex flex-col gap-4 mt-2">
          {Object.entries(tagGroups).map(([category, tags]) => (
            <div key={category}>
              <p className="text-white text-sm font-medium mb-1">{category}</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <Link
                    key={i}
                    href={`/dashboard/tags/${tag.name}`}
                    className="flex items-center gap-1 text-sm border border-secondary-border px-2 py-1 rounded-full hover:opacity-90"
                    style={{ color: tag.color }}
                  >
                    <Tag size={14} /> {tag.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <EditPostModal
            post={post}
            onClose={() => setEditing(false)}
            onSuccess={() => location.reload()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

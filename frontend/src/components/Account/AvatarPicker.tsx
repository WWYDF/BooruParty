'use client';

import { useEffect, useRef, useState } from "react";
import { CameraIcon, TrashIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { APIUpload, errorText, useSend } from "@/core/api";

const MAX_AVATAR_MB = 5; // matches MAX_AVATAR_BYTES on the API
const DEFAULT_AVATAR = "/i/user.png";

// Uploads as soon as a file is picked; avatars apply immediately like the privacy toggle
export default function AvatarPicker({ avatar, canEdit, onChange }: {
  avatar: string | null;
  canEdit: boolean;
  onChange: (avatar: string | null) => void;
}) {
  const send = useSend();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null); // local file while uploading
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  // Free the object URL once it's replaced or the card unmounts
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const busy = progress !== null || removing;

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast("Avatars must be an image.", "error");
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) return toast(`Avatars can be at most ${MAX_AVATAR_MB} MB.`, "error");

    setPreview(URL.createObjectURL(file));
    setProgress(0);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await APIUpload("/api/avatars/change", form, setProgress, "PUT");
      if (res.status !== 200) return toast(errorText(res.data), "error");
      onChange(res.data.avatar);
      toast("Avatar updated", "success");
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setPreview(null);
      setProgress(null);
    }
  };

  const remove = async () => {
    setRemoving(true);
    const ok = await send("/api/avatars/reset", "DELETE");
    setRemoving(false);
    if (ok === null) return;
    onChange(null);
    toast("Avatar removed", "success");
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-16 w-16 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview ?? avatar ?? DEFAULT_AVATAR}
          alt=""
          className="h-full w-full rounded-full border border-secondary-border object-cover"
        />
        {progress !== null && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-xs font-medium text-white tabular-nums">
            {Math.round(progress * 100)}%
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<CameraIcon size={16} />}
            onClick={() => input.current?.click()}
            loading={progress !== null}
            disabled={!canEdit || busy}
            title={canEdit ? undefined : "Missing permission: profile.edit.avatar"}
          >
            Change avatar
          </Button>
          {avatar && (
            <Button icon={<TrashIcon size={16} />} onClick={remove} loading={removing} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          {canEdit ? `Square-cropped. Max ${MAX_AVATAR_MB} MB.` : "Your role can't change avatars."}
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // so picking the same file again still fires onChange
          if (file) upload(file);
        }}
      />
    </div>
  );
}

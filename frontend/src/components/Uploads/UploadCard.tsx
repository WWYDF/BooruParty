'use client';

import { CheckIcon, CheckCircleIcon, WarningIcon, VideoCameraIcon, TagIcon } from '@phosphor-icons/react';
import { formatStorageFromBytes } from '@/core/formats';
import { SAFETY_STYLES, UploadItem } from '../../core/types/uploads';

type Props = {
  item: UploadItem;
  selected: boolean;                      // outlined: picked for editing, or the file uploading right now
  selectable: boolean;                    // false = no checkbox/Review, clicks do nothing (sent files, or the queue is running)
  onClick: (e: React.MouseEvent) => void; // selection (shift/ctrl handled by the page)
  onToggle: () => void;                  // checkbox: add/remove just this card
  onReview: () => void;                  // duplicate: open the comparison modal
};

export default function UploadCard({ item, selected, selectable, onClick, onToggle, onReview }: Props) {
  const { status } = item;
  const safety = SAFETY_STYLES[item.safety];
  const ext = item.file.name.split('.').pop()?.toUpperCase() ?? '?';
  const stop = (e: React.MouseEvent) => e.stopPropagation(); // buttons inside the card shouldn't change selection

  return (
    <div
      onClick={selectable ? onClick : undefined}
      className={`group relative select-none overflow-hidden rounded-xl border bg-secondary transition ${
        selectable ? 'cursor-pointer' : 'cursor-default'
      } ${
        selected
          ? 'border-accent ring-2 ring-accent/40'
          : `border-secondary-border ${selectable ? 'hover:border-zinc-600' : ''}`
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-zinc-900">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.file.name} draggable={false} className="h-full w-full object-cover" />
        ) : item.thumbnailFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-subtle">
            <span className="text-lg font-semibold">{ext}</span>
            <span className="text-[10px]">No preview available</span>
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-zinc-800" />
        )}

        {/* Checkbox */}
        {selectable && (
          <button
            onClick={(e) => { stop(e); onToggle(); }}
            className={`absolute left-2 top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded border transition ${
              selected
                ? 'border-accent bg-accent text-black'
                : 'border-zinc-500 bg-black/50 text-transparent opacity-0 group-hover:opacity-100'
            }`}
            title={selected ? 'Deselect' : 'Select'}
          >
            <CheckIcon size={12} weight="bold" />
          </button>
        )}

        {/* Safety + type badges */}
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {item.file.type.startsWith('video/') && (
            <span className="rounded bg-black/60 p-1 text-white" title="Video">
              <VideoCameraIcon size={12} />
            </span>
          )}
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${safety.badge}`} title={safety.label}>
            {safety.short}
          </span>
        </div>

        {item.tags.length > 0 && (
          <span
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
            title={item.tags.map((t) => t.name).join(', ')}
          >
            <TagIcon size={10} /> {item.tags.length}
          </span>
        )}

        {/* Status overlays */}
        {status.state === 'uploading' && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
            <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${Math.round(status.progress * 100)}%` }} />
          </div>
        )}

        {status.state === 'processing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">
            <span className="animate-pulse">Processing...</span>
          </div>
        )}

        {status.state === 'done' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 backdrop-blur-xs text-green-400">
            <CheckCircleIcon size={28} weight="fill" />
            <a
              href={`/post/${status.postId}`}
              target="_blank"
              rel="noreferrer"
              onClick={stop}
              className="text-xs text-white underline hover:text-accent font-medium"
            >
              Post #{status.postId}
            </a>
          </div>
        )}

        {status.state === 'duplicate' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-yellow-300">
            <WarningIcon size={24} weight="fill" />
            <span className="text-xs">Duplicate of #{status.postId}</span>
            {selectable && (
              <button
                onClick={(e) => { stop(e); onReview(); }}
                className="cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-white hover:bg-zinc-700"
              >
                Review
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-white" title={item.file.name}>{item.file.name}</p>
        {status.state === 'error' ? (
          <p className="truncate text-[11px] text-red-400" title={status.message}>{status.message}</p>
        ) : (
          <p className="text-[11px] text-subtle">
            {formatStorageFromBytes(item.file.size)}
            {status.state === 'uploading' && ` · ${Math.round(status.progress * 100)}%`}
          </p>
        )}
      </div>
    </div>
  );
}

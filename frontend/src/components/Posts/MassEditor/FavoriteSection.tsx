'use client';

import { useState } from 'react';
import { HeartBreakIcon, HeartIcon } from '@phosphor-icons/react';
import Button from '@/components/UI/Button';
import { useToast } from '@/components/UI/Toast';
import { useSend } from '@/core/api';
import { BulkResult, MassEditChange } from '@/core/types/posts';
import Section from './Section';
import { reportBulk } from './shared';

type Props = {
  postIds: number[];
  allFavorited: boolean; // every selected post is already favorited
  autoLike: boolean;     // new favorites also get liked (the user has posts.vote)
  onApplied: (change: MassEditChange) => void;
};

export default function FavoriteSection({ postIds, allFavorited, autoLike, onApplied }: Props) {
  const toast = useToast();
  const send = useSend();
  const [busy, setBusy] = useState<boolean | null>(null); // the favorited value being sent

  const favorite = async (favorited: boolean) => {
    setBusy(favorited);
    const result = await send<BulkResult>('/api/posts/bulk/favorite', 'PUT', { postIds, favorited });
    setBusy(null);
    if (!result) return;

    reportBulk(toast, favorited ? 'Favorited' : 'Unfavorited', result);
    if (result.updated.length) onApplied({ favorited: { ids: result.updated, favorited, autoLike } });
  };

  return (
    <Section title="Favorite" hint="New favorites also like the post, same as favoriting one at a time." instant>
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<HeartIcon size={16} weight={allFavorited ? 'fill' : 'regular'} />}
          className={allFavorited ? 'bg-amber-400! text-black! hover:bg-amber-500!' : ''}
          loading={busy === true}
          disabled={busy !== null}
          onClick={() => favorite(true)}
        >
          Favorite all
        </Button>
        <Button icon={<HeartBreakIcon size={16} />} loading={busy === false} disabled={busy !== null} onClick={() => favorite(false)}>
          Unfavorite all
        </Button>
      </div>
    </Section>
  );
}

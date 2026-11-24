'use client';

import { useState } from 'react';
import { HeartBreakIcon, HeartIcon } from '@phosphor-icons/react';
import Button from '@/components/UI/Button';
import { useToast } from '@/components/UI/Toast';
import { useSend } from '@/core/api';
import { BulkResult } from '@/core/types/posts';
import Section from './Section';
import { reportBulk } from './shared';

export default function FavoriteSection({ postIds }: { postIds: number[] }) {
  const toast = useToast();
  const send = useSend();
  const [busy, setBusy] = useState<boolean | null>(null); // the favorited value being sent

  const favorite = async (favorited: boolean) => {
    setBusy(favorited);
    const result = await send<BulkResult>('/api/posts/bulk/favorite', 'PUT', { postIds, favorited });
    setBusy(null);
    if (result) reportBulk(toast, favorited ? 'Favorited' : 'Unfavorited', result);
  };

  return (
    <Section title="Favorite" hint="New favorites also like the post, same as favoriting one at a time." instant>
      <div className="flex flex-wrap gap-2">
        <Button icon={<HeartIcon size={16} />} loading={busy === true} disabled={busy !== null} onClick={() => favorite(true)}>
          Favorite all
        </Button>
        <Button icon={<HeartBreakIcon size={16} />} loading={busy === false} disabled={busy !== null} onClick={() => favorite(false)}>
          Unfavorite all
        </Button>
      </div>
    </Section>
  );
}

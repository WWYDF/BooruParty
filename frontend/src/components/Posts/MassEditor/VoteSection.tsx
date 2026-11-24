'use client';

import { useState } from 'react';
import { ThumbsDownIcon, ThumbsUpIcon, XIcon } from '@phosphor-icons/react';
import Button from '@/components/UI/Button';
import { useToast } from '@/components/UI/Toast';
import { useSend } from '@/core/api';
import { BulkResult, VoteValue } from '@/core/types/posts';
import Section from './Section';
import { reportBulk } from './shared';

export default function VoteSection({ postIds }: { postIds: number[] }) {
  const toast = useToast();
  const send = useSend();
  const [busy, setBusy] = useState<VoteValue | null>(null);

  const vote = async (value: VoteValue, verb: string) => {
    setBusy(value);
    const result = await send<BulkResult>('/api/posts/bulk/vote', 'PUT', { postIds, value });
    setBusy(null);
    if (result) reportBulk(toast, verb, result);
  };

  return (
    <Section title="Vote" instant>
      <div className="flex flex-wrap gap-2">
        <Button icon={<ThumbsUpIcon size={16} />} loading={busy === 1} disabled={busy !== null} onClick={() => vote(1, 'Liked')}>
          Like all
        </Button>
        <Button icon={<ThumbsDownIcon size={16} />} loading={busy === -1} disabled={busy !== null} onClick={() => vote(-1, 'Disliked')}>
          Dislike all
        </Button>
        <Button icon={<XIcon size={16} />} loading={busy === 0} disabled={busy !== null} onClick={() => vote(0, 'Cleared your vote on')}>
          Clear votes
        </Button>
      </div>
    </Section>
  );
}

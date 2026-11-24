'use client';

import { useState } from 'react';
import { ThumbsDownIcon, ThumbsUpIcon, XIcon } from '@phosphor-icons/react';
import Button from '@/components/UI/Button';
import { useToast } from '@/components/UI/Toast';
import { useSend } from '@/core/api';
import { BulkResult, MassEditChange, VoteValue } from '@/core/types/posts';
import Section from './Section';
import { reportBulk } from './shared';

type Props = {
  postIds: number[];
  sharedVote: VoteValue | null; // the vote every selected post already has (null = mixed)
  onApplied: (change: MassEditChange) => void;
};

export default function VoteSection({ postIds, sharedVote, onApplied }: Props) {
  const toast = useToast();
  const send = useSend();
  const [busy, setBusy] = useState<VoteValue | null>(null);

  const vote = async (value: VoteValue, verb: string) => {
    setBusy(value);
    const result = await send<BulkResult>('/api/posts/bulk/vote', 'PUT', { postIds, value });
    setBusy(null);
    if (!result) return;

    reportBulk(toast, verb, result);
    if (result.updated.length) onApplied({ voted: { ids: result.updated, value } });
  };

  return (
    <Section title="Vote" instant>
      <div className="flex flex-wrap gap-2">
        {/* Filled in when every selected post already has that vote */}
        <Button
          variant={sharedVote === 1 ? 'success' : 'secondary'}
          icon={<ThumbsUpIcon size={16} weight={sharedVote === 1 ? 'fill' : 'regular'} />}
          loading={busy === 1}
          disabled={busy !== null}
          onClick={() => vote(1, 'Liked')}
        >
          Like all
        </Button>
        <Button
          variant={sharedVote === -1 ? 'danger' : 'secondary'}
          icon={<ThumbsDownIcon size={16} weight={sharedVote === -1 ? 'fill' : 'regular'} />}
          loading={busy === -1}
          disabled={busy !== null}
          onClick={() => vote(-1, 'Disliked')}
        >
          Dislike all
        </Button>
        <Button icon={<XIcon size={16} />} loading={busy === 0} disabled={busy !== null} onClick={() => vote(0, 'Cleared your vote on')}>
          Clear votes
        </Button>
      </div>
    </Section>
  );
}

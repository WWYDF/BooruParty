'use client';

import { useState } from 'react';
import { TrashIcon } from '@phosphor-icons/react';
import Button from '@/components/UI/Button';
import ConfirmModal from '@/components/UI/Modals/ConfirmModal';
import { useToast } from '@/components/UI/Toast';
import { useSend } from '@/core/api';
import { BulkResult, MassEditChange } from '@/core/types/posts';
import Section from './Section';
import { plural, reportBulk } from './shared';

type Props = {
  postIds: number[];
  onApplied: (change: MassEditChange) => void;
  onClose: () => void;
  className?: string;
};

export default function DeleteSection({ postIds, onApplied, onClose, className = '' }: Props) {
  const toast = useToast();
  const send = useSend();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteAll = async () => {
    setConfirming(false);
    setDeleting(true);
    const result = await send<BulkResult>('/api/posts/bulk', 'DELETE', { postIds });
    setDeleting(false);
    if (!result) return;

    reportBulk(toast, 'Deleted', result);
    if (result.updated.length) {
      onApplied({ deleted: result.updated });
      onClose();
    }
  };

  return (
    <Section title="Delete posts" hint="Posts you aren't allowed to delete are skipped." instant className={className}>
      <div>
        <Button variant="danger" icon={<TrashIcon size={16} />} loading={deleting} onClick={() => setConfirming(true)}>
          Delete {plural(postIds.length)}
        </Button>
      </div>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={deleteAll}
        title={`Delete ${plural(postIds.length)}?`}
        description="This permanently deletes them and their files. It can't be undone."
        confirmText="Delete"
      />
    </Section>
  );
}

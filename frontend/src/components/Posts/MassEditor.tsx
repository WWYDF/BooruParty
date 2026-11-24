'use client';

import { useState } from 'react';
import { WarningIcon } from '@phosphor-icons/react';
import InfoModal from '@/components/UI/Modals/InfoModal';
import { useUser } from '@/components/UserProvider';
import { MassEditChange, MAX_BULK_POSTS } from '@/core/types/posts';
import EditorsTab from './MassEditor/EditorsTab';
import UsersTab from './MassEditor/UsersTab';
import { plural } from './MassEditor/shared';

type Props = {
  open: boolean;
  onClose: () => void;
  postIds: number[]; // selected posts, in the order the feed shows them (pools append in this order)
  onApplied: (change: MassEditChange) => void;
};

type Tab = 'editors' | 'users';

export default function MassEditor({ open, onClose, postIds, onApplied }: Props) {
  const { user } = useUser();
  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false;

  const canUsers = hasPerm('posts.vote') || hasPerm('posts.favorite') || hasPerm('collections.manage.own');
  const canEditors =
    hasPerm('posts.edit.own') || hasPerm('posts.edit.others') ||
    hasPerm('posts.delete.own') || hasPerm('posts.delete.others') ||
    hasPerm('pool.manage');

  // Editors come first for anyone who can edit; everyone else only gets Users
  const tabs: Tab[] = [...(canEditors ? ['editors' as const] : []), ...(canUsers ? ['users' as const] : [])];
  const [tab, setTab] = useState<Tab | null>(null); // null = the first tab this user has
  const activeTab = tab && tabs.includes(tab) ? tab : tabs[0];

  const tooMany = postIds.length > MAX_BULK_POSTS;

  return (
    <InfoModal
      open={open}
      onClose={onClose}
      title={`Edit ${plural(postIds.length)}`}
      // Most of the screen in both directions. The body is a flex column so the lists can stretch into the spare height
      className="sm:max-w-2xl! md:max-w-4xl! lg:max-w-272! max-h-[90vh]! md:h-[84vh]"
      bodyClassName="flex flex-col"
    >
      {tabs.length === 0 ? (
        <p className="text-sm text-subtle">Your account doesn't have permission to change posts in bulk.</p>
      ) : (
        <>
          {tabs.length > 1 && (
            <div className="mb-4 flex shrink-0 gap-1 border-b border-secondary-border">
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition ${
                    activeTab === t ? 'border-accent text-white' : 'border-transparent text-subtle hover:text-white'
                  }`}
                >
                  {t === 'editors' ? 'Editors' : 'Users'}
                </button>
              ))}
            </div>
          )}

          {tooMany ? (
            <p className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-300">
              <WarningIcon size={16} className="shrink-0" />
              You can change at most {MAX_BULK_POSTS} posts at once. Deselect {postIds.length - MAX_BULK_POSTS} to continue.
            </p>
          ) : activeTab === 'users' ? (
            <UsersTab postIds={postIds} hasPerm={hasPerm} />
          ) : (
            <EditorsTab postIds={postIds} hasPerm={hasPerm} onApplied={onApplied} onClose={onClose} />
          )}
        </>
      )}
    </InfoModal>
  );
}

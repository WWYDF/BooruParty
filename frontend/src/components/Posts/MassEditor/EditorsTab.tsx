import { MassEditChange } from '@/core/types/posts';
import EditForm from './EditForm';
import PoolSection from './PoolSection';
import DeleteSection from './DeleteSection';

type Props = {
  postIds: number[];
  hasPerm: (perm: string) => boolean;
  onApplied: (change: MassEditChange) => void;
  onClose: () => void;
};

// The Apply form on top (natural height), then the instant sections taking the rest
export default function EditorsTab({ postIds, hasPerm, onApplied, onClose }: Props) {
  const canEdit = hasPerm('posts.edit.own') || hasPerm('posts.edit.others');
  const canDelete = hasPerm('posts.delete.own') || hasPerm('posts.delete.others');
  const canPools = hasPerm('pool.manage');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {canEdit && (
        <EditForm postIds={postIds} canCreateTags={hasPerm('tags.create')} onApplied={onApplied} onClose={onClose} />
      )}

      {(canPools || canDelete) && (
        <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
          {canPools && <PoolSection postIds={postIds} />}
          {canDelete && (
            <DeleteSection
              postIds={postIds}
              onApplied={onApplied}
              onClose={onClose}
              className={canPools ? 'shrink-0 lg:w-96' : ''}
            />
          )}
        </div>
      )}
    </div>
  );
}

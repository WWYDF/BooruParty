import { MassEditChange, PostViewerState, VoteValue } from '@/core/types/posts';
import VoteSection from './VoteSection';
import FavoriteSection from './FavoriteSection';
import CollectionSection from './CollectionSection';

type Props = {
  postIds: number[];
  viewers: (PostViewerState | null)[]; // the user's state on each selected post
  hasPerm: (perm: string) => boolean;
  onApplied: (change: MassEditChange) => void;
};

// Votes, favorites, collections. Each button applies right away and the modal stays open.
export default function UsersTab({ postIds, viewers, hasPerm, onApplied }: Props) {
  // The vote every selected post shares (null = mixed), and whether all are favorited
  const votes = viewers.map((v) => v?.vote ?? 0);
  const sharedVote: VoteValue | null = votes.length > 0 && votes.every((v) => v === votes[0]) ? votes[0] : null;
  const allFavorited = viewers.length > 0 && viewers.every((v) => v?.favorited);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex min-h-0 flex-1 flex-col gap-6 py-2 md:flex-row">
        <div className="shrink-0 space-y-6 md:w-1/2">
          {hasPerm('posts.vote') && <VoteSection postIds={postIds} sharedVote={sharedVote} onApplied={onApplied} />}
          {hasPerm('posts.favorite') && (
            <FavoriteSection
              postIds={postIds}
              allFavorited={allFavorited}
              autoLike={hasPerm('posts.vote')} // the server auto-likes new favorites only with posts.vote
              onApplied={onApplied}
            />
          )}
        </div>

        {hasPerm('collections.manage.own') && <CollectionSection postIds={postIds} />}
      </div>
    </div>
  );
}

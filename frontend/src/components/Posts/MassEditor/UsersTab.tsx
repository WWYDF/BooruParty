import { LightningIcon } from '@phosphor-icons/react';
import VoteSection from './VoteSection';
import FavoriteSection from './FavoriteSection';
import CollectionSection from './CollectionSection';

type Props = {
  postIds: number[];
  hasPerm: (perm: string) => boolean;
};

// Votes, favorites, collections. Each button applies right away and the modal stays open.
export default function UsersTab({ postIds, hasPerm }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex min-h-0 flex-1 flex-col gap-6 py-2 md:flex-row">
        <div className="shrink-0 space-y-6 md:w-1/2">
          {hasPerm('posts.vote') && <VoteSection postIds={postIds} />}
          {hasPerm('posts.favorite') && <FavoriteSection postIds={postIds} />}
        </div>

        {hasPerm('collections.manage.own') && <CollectionSection postIds={postIds} />}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BookmarksIcon, SparkleIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon } from '@phosphor-icons/react';
import CollectionPopup from '@/components/Collections/CollectionPopup';
import { useUser } from '@/components/UserProvider';
import { useToast } from '@/components/UI/Toast';
import { API, errorText } from '@/core/api';
import { formatDuration } from '@/core/formats';
import { OwnCollection } from '@/core/types/collections';
import {
  BoostCooldownError,
  BoostResponse,
  FavoriteResponse,
  PostDetail,
  PostViewerState,
  VoteResponse,
  VoteValue,
} from '@/core/types/posts';

type Props = {
  post: PostDetail;
  onChange: (patch: Partial<PostDetail>) => void; // merges the server's answer into the page's post (score, counts, viewer)
};

const buttonBase =
  'flex cursor-pointer items-center gap-2 rounded-full border border-secondary-border px-3 py-1.5 text-sm transition md:hover:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-50';
const idle = 'bg-secondary-border text-subtle';

// Upvote / Favorite / Downvote, plus Boost and Collection (opens CollectionPopup).
export default function PostVoting({ post, onChange }: Props) {
  const { user, setUser } = useUser();
  const toast = useToast();
  const busy = useRef(false); // one request at a time; clicks meanwhile are ignored (not disabled, so the buttons don't flash)

  const viewer = post.viewer; // null = guest
  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false;
  const canVote = !!viewer && hasPerm('posts.vote');
  const canFavorite = !!viewer && hasPerm('posts.favorite');
  const canBoost = !!viewer && hasPerm('posts.boost');
  const canCollect = !!viewer && hasPerm('collections.manage.own');

  // Your collections, each saying whether this post is in it. Loaded up front so the button can show it,
  // and so the popup opens instantly. The popup edits this list in place.
  const [collections, setCollections] = useState<OwnCollection[] | null>(null);
  const [collectionsFailed, setCollectionsFailed] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  useEffect(() => {
    setCollections(null);
    setCollectionsFailed(false);
    setCollectionsOpen(false);
    if (!canCollect) return;

    let cancelled = false;
    API(`/api/collections/own?postId=${post.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { collections: OwnCollection[] }) => { if (!cancelled) setCollections(data.collections); })
      .catch(() => { if (!cancelled) setCollectionsFailed(true); });
    return () => { cancelled = true; };
  }, [post.id, canCollect]);

  const updateCollections = useCallback(
    (update: (prev: OwnCollection[]) => OwnCollection[]) => setCollections((prev) => (prev ? update(prev) : prev)),
    [],
  );
  const closeCollections = useCallback(() => setCollectionsOpen(false), []); // stable, so the popup's listeners aren't re-added every render
  const collected = collections?.some((c) => c.hasPost) ?? false;

  // Boost cooldown: a live countdown to the user's nextBoostAt (ticks only while one is running)
  const nextBoostAt = user?.boost?.nextBoostAt ? new Date(user.boost.nextBoostAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (nextBoostAt === null || nextBoostAt <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= nextBoostAt) clearInterval(timer); // cooldown over: the button turns back into "Boost" by itself
    }, 1000);
    return () => clearInterval(timer);
  }, [nextBoostAt]);

  const boostRemaining = nextBoostAt !== null ? nextBoostAt - now : 0;
  const onCooldown = boostRemaining > 0;
  const canUndoBoost = onCooldown && user?.boost?.activeBoostPostId === post.id;

  // Flip the button right away, then apply the server's answer (or put the button back if it failed)
  const send = async <T,>(
    path: 'vote' | 'favorite',
    body: object,
    optimistic: PostViewerState,
    apply: (data: T) => Partial<PostDetail>,
  ) => {
    if (!viewer || busy.current) return;
    busy.current = true;
    onChange({ viewer: optimistic });

    try {
      const res = await API(`/api/posts/${post.id}/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onChange({ viewer });
        toast(errorText(data), 'error');
        return;
      }
      onChange(apply(data));
    } catch {
      onChange({ viewer });
      toast('The server could not be reached', 'error');
    } finally {
      busy.current = false;
    }
  };

  // Clicking the active vote again removes it
  const vote = (value: 1 | -1) => {
    if (!viewer) return;
    const next: VoteValue = viewer.vote === value ? 0 : value;
    send<VoteResponse>('vote', { value: next }, { ...viewer, vote: next }, (data) => ({
      score: data.score,
      viewer: { ...viewer, vote: data.myVote },
    }));
  };

  // A new favorite also upvotes (server side); unfavoriting leaves the vote alone
  const favorite = () => {
    if (!viewer) return;
    const next = !viewer.favorited;
    const optimisticVote: VoteValue = next && canVote ? 1 : viewer.vote;
    send<FavoriteResponse>('favorite', { favorited: next }, { vote: optimisticVote, favorited: next }, (data) => ({
      score: data.score,
      favoriteCount: data.favoriteCount,
      viewer: { vote: data.myVote, favorited: data.favorited },
    }));
  };

  // Boost, or undo the active boost on this post. Not optimistic: the cooldown comes from the server's clock.
  const toggleBoost = async () => {
    if (!viewer || !user || busy.current) return;

    // On cooldown with the boost elsewhere: say where it is, so they can go undo it there if they'd rather boost this one
    if (onCooldown && !canUndoBoost) {
      const active = user.boost?.activeBoostPostId;
      toast(
        active
          ? `Your boost is on post #${active}. Undo it there to boost this one instead, or wait ${timer}.`
          : `The post you boosted was deleted. You can boost again in ${timer}.`,
        'info',
      );
      return;
    }

    busy.current = true;

    try {
      const res = await API(`/api/posts/${post.id}/boost`, { method: canUndoBoost ? 'DELETE' : 'PUT' });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const { boostCount, nextBoostAt, activeBoostPostId } = data as BoostResponse;
        onChange({ boostCount });
        setUser({ ...user, boost: { nextBoostAt, activeBoostPostId } }); // every post's button sees the new cooldown
        return;
      }

      // Our cooldown info was stale (e.g. boosted in another tab): show the real one
      if (res.status === 429) {
        setUser({ ...user, boost: { ...user.boost, nextBoostAt: (data as BoostCooldownError).nextBoostAt } });
      }
      toast(errorText(data), 'error');
    } catch {
      toast('The server could not be reached', 'error');
    } finally {
      busy.current = false;
    }
  };

  const guestTitle = viewer ? undefined : 'Log in to vote and favorite';
  const upvoted = viewer?.vote === 1;
  const downvoted = viewer?.vote === -1;
  const favorited = viewer?.favorited ?? false;
  const timer = formatDuration(boostRemaining);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center gap-2">
        <button
          onClick={() => vote(1)}
          disabled={!canVote}
          title={guestTitle ?? (upvoted ? 'Remove upvote' : 'Upvote this post')}
          className={`${buttonBase} ${upvoted ? 'bg-green-400/10 text-green-400' : idle}`}
        >
          <ThumbsUpIcon size={18} weight={upvoted ? 'fill' : 'regular'} />
          Upvote
        </button>

        <button
          onClick={favorite}
          disabled={!canFavorite}
          title={guestTitle ?? (favorited ? 'Unfavorite this post' : 'Favorite this post')}
          className={`${buttonBase} ${favorited ? 'bg-yellow-400/10 text-yellow-400' : idle}`}
        >
          <StarIcon size={18} weight={favorited ? 'fill' : 'regular'} />
          Favorite
        </button>

        <button
          onClick={() => vote(-1)}
          disabled={!canVote}
          title={guestTitle ?? (downvoted ? 'Remove downvote' : 'Downvote this post')}
          className={`${buttonBase} ${downvoted ? 'bg-red-400/10 text-red-400' : idle}`}
        >
          <ThumbsDownIcon size={18} weight={downvoted ? 'fill' : 'regular'} />
          Downvote
        </button>
      </div>

      <div className="flex justify-center gap-2">
        <button
          onClick={toggleBoost}
          disabled={!canBoost}
          title={
            guestTitle ??
            (canUndoBoost
              ? 'Take back your boost (you can boost again right away)'
              : onCooldown
                ? 'On cooldown: click to see which post you boosted'
                : 'Boost this post')
          }
          // On cooldown elsewhere it only explains itself (toast), so it looks disabled while staying clickable.
          // Classes swapped rather than stacked: cursor-pointer + cursor-not-allowed together is a coin flip in Tailwind.
          className={`tabular-nums ${
            onCooldown && !canUndoBoost
              ? 'flex cursor-not-allowed items-center gap-2 rounded-full border border-secondary-border px-3 py-1.5 text-sm opacity-50'
              : buttonBase
          } ${canUndoBoost ? 'bg-cyan-400/10 text-cyan-400' : idle}`}
        >
          <SparkleIcon size={18} weight={canUndoBoost ? 'fill' : 'regular'} />
          {canUndoBoost ? `Boosted` : onCooldown ? `${timer}` : 'Boost'}
        </button>

        {/* Relative wrapper: the popup hangs under the button, and clicks on the button don't count as "outside" */}
        <div className="relative">
          <button
            onClick={() => setCollectionsOpen((o) => !o)}
            disabled={!canCollect}
            aria-expanded={collectionsOpen}
            title={guestTitle ?? (collected ? 'Saved in a collection: click to change' : 'Save to a collection')}
            className={`${buttonBase} ${collected ? 'bg-accent/10 text-purple-400' : idle}`}
          >
            <BookmarksIcon size={18} weight={collected ? 'fill' : 'regular'} />
            Collection
          </button>

          <AnimatePresence>
            {collectionsOpen && (
              <CollectionPopup
                postId={post.id}
                collections={collections}
                failed={collectionsFailed}
                onChange={updateCollections}
                onClose={closeCollections}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

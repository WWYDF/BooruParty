'use client';

import { useEffect, useRef, useState } from 'react';
import { SparkleIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon } from '@phosphor-icons/react';
import { useUser } from '@/components/UserProvider';
import { useToast } from '@/components/UI/Toast';
import { API, errorText } from '@/core/api';
import { formatDuration } from '@/core/formats';
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

// Upvote / Favorite / Downvote, plus Boost. Collections come back once their API exists.
export default function PostVoting({ post, onChange }: Props) {
  const { user, setUser } = useUser();
  const toast = useToast();
  const busy = useRef(false); // one request at a time; clicks meanwhile are ignored (not disabled, so the buttons don't flash)

  const viewer = post.viewer; // null = guest
  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false;
  const canVote = !!viewer && hasPerm('posts.vote');
  const canFavorite = !!viewer && hasPerm('posts.favorite');
  const canBoost = !!viewer && hasPerm('posts.boost');

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
    if (onCooldown && !canUndoBoost) return;
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
          disabled={!canBoost || (onCooldown && !canUndoBoost)}
          title={
            guestTitle ??
            (canUndoBoost
              ? 'Take back your boost (you can boost again right away)'
              : onCooldown
                ? 'You can boost one post per cooldown'
                : 'Boost this post')
          }
          className={`${buttonBase} tabular-nums ${canUndoBoost ? 'bg-cyan-400/10 text-cyan-400' : idle}`}
        >
          <SparkleIcon size={18} weight={canUndoBoost ? 'fill' : 'regular'} />
          {canUndoBoost ? `Boost` : onCooldown ? `${timer}` : 'Boost'}
        </button>
      </div>
    </div>
  );
}

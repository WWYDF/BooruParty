import PostDisplay from "@/components/clientSide/Posts/Individual/PostDisplay";
import PostMetadata, { canEdit } from "@/components/clientSide/Posts/Individual/PostMetadata";
import PostNavigator from "@/components/clientSide/Posts/Individual/PostNavigator";
import PostCommentForm from "@/components/clientSide/Posts/Individual/PostCommentForm";
import PostCommentList from "@/components/clientSide/Posts/Individual/PostCommentList";
import { Comments } from "@/core/types/comments";
import { cookies } from "next/headers";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { Metadata } from "next";
import { resolveFileType } from "@/core/dictionary";
import { Post } from "@/core/types/posts";
import { formatStorageFromBytes } from "@/core/formats";
import { Tag } from "@/core/types/tags";
import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";

async function fetchPostData(postId: string) {
  const cookieStore = cookies();
  const cookieHeader = (await cookieStore).getAll()
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${postId}`, {
    cache: "no-store",
    headers: {
      Cookie: cookieHeader,
    },
  });
  if (!res.ok) {
    const data = await res.json();
    const error = data?.error || "Failed to fetch post";
    throw new Error(error);
  }
  return res.json();
}

async function fetchComments(postId: string): Promise<Comments[]> {
  const cookieStore = cookies();
  const secure = (await cookieStore).get("__Secure-next-auth.session-token")?.value;
  const fallback = (await cookieStore).get("next-auth.session-token")?.value;

  let cookieHeader = "";

  if (secure) {
    cookieHeader = `__Secure-next-auth.session-token=${secure}`;
  } else if (fallback) {
    cookieHeader = `next-auth.session-token=${fallback}`;
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/comments?postId=${postId}`, {
    cache: "no-store",
    headers: {
      Cookie: cookieHeader
    }

  });

  const response = await res.json();
  const rawComments: Comments[] = response.formattedComments;

  return rawComments;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const prams = await params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/metadata/posts/${prams.id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return {
      title: 'Error',
      description: 'Something went wrong fetching metadata.',
    };
  }

  const data = await res.json();

  if (!data || !data.title || !data.description) {
    console.log('3')
    return {
      title: `Post #${prams.id}`,
      description: `Guest viewing is disabled for this site, please login to view this post.`,
      openGraph: {  // The preview image for Discord, Twitter, etc.
        images: [
          {
            url: '/i/private.png',
            width: 500,
            height: 500
          }
        ]
      }
    };
  }

  return {
    title: `${data.title}`,
    description: `${data.description}`,
    openGraph: {  // The preview image for Discord, Twitter, etc.
      images: [
        {
          url: `${data.previewUrl}`
        }
      ]
    }
  };
}

export default async function PostPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ pool?: string }>;
}) {

  const { id } = await params;
  const poolId = (await searchParams)?.pool;
  const session = await auth();

  let blurUnsafeEmbeds = true;

  if (session?.user) {
    const prefs = await prisma.userPreferences.findUnique({
      where: { id: session.user.id },
      select: { blurUnsafeEmbeds: true },
    });

    blurUnsafeEmbeds = prefs?.blurUnsafeEmbeds ?? true;
  }

  const postId = id;
  const postPromise = fetchPostData(postId);
  const commentsPromise = fetchComments(postId);
  const perms = await checkPermissions([
    'comment_create',
    'comment_vote',
    'post_edit_others', // For showing anonymous post authors (req. for moderation)
    'post_edit_own'
  ]);

  const canComment = perms['comment_create'];
  const canVote = perms['comment_vote'];
  const canEditOthersPosts = perms['post_edit_others'];
  const canEditOwnPosts = perms['post_edit_own'];

  const passPerms: canEdit = {
    ownPosts: canEditOwnPosts,
    otherPosts: canEditOthersPosts
  }

  // Retrieve datas
  const [postResult, commentsResult] = await Promise.allSettled([
    postPromise,
    commentsPromise,
  ]);

  if (postResult.status !== "fulfilled") {
    const errMsg = postResult.reason?.message?.toLowerCase() ?? "";
  
    let title = "Failed to load post";
    let description = "Something went wrong while fetching the post.";
  
    if (errMsg.includes("not found") || errMsg.includes("404")) {
      title = "Post Not Found";
      description = "The post you're looking for doesn’t exist or has been removed.";
    } else if (errMsg.includes("unauthorized") || errMsg.includes("forbidden") || errMsg.includes("403")) {
      title = "Access Denied";
      description = "You do not have permission to view this post.";
    }
  
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-red-400">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-base text-subtle max-w-md">{description}</p>
      </main>
    );
  }

  const postData = postResult.value;
  const comments = commentsResult.status === 'fulfilled' ? commentsResult.value : [];
  const post: Post = postData.post;

  let artistText = '';
  const allTags = post.tags.flatMap(group => group.tags);
  const firstArtist: Tag | undefined = allTags.find(
    tag => tag.category?.name === "Artist" || tag.category?.name === "Artists"
  );
  if (firstArtist) {
    artistText = ` by ${firstArtist.name}`;
  }
    
  let fileTypeText = '';
  const fileType = resolveFileType(`.${post.fileExt}`);
  if (fileType != 'other') { fileTypeText = ` ${fileType}` }
  const desc = `View this ${formatStorageFromBytes(post.fileSize ?? 0)}${fileTypeText}`

  return (
    <main className="grid grid-cols-1 lg:grid-cols-[375px_1fr] gap-6 p-4">
      <meta name="description" content={desc} />
      <meta property="og:title" content={`Post #${post.id}${artistText} | ${process.env.NEXT_PUBLIC_SITE_NAME}`} />
      <meta property="og:description" content={desc} />

      {/* LEFT COLUMN - Metadata */}
      <div className="order-3 lg:order-1 lg:col-span-1 mt-6 lg:mt-0 border-r border-zinc-900">
        <PostMetadata post={postData.post} user={postData.user} editPerms={passPerms} userId={session?.user.id} />
      </div>

      {/* RIGHT COLUMN - Main content + Comments */}
      <div className="order-1 lg:order-2 space-y-6">
        <PostNavigator postId={postData.post.id} poolId={poolId ? parseInt(poolId) : undefined} />
        <PostDisplay post={postData.post} user={postData.user} />

        {/* Comments - In column 2 only */}
        <section className="order-4 pt-4 space-y-4">
          <h2 className="text-accent text-lg">Comments</h2>
          {canComment && <PostCommentForm postId={postData.post.id} />}
          <PostCommentList comments={comments} loading={false} error={null} blurUnsafeEmbeds={blurUnsafeEmbeds} parentPostSafety={postData.post.safety} canVoteOnComments={canVote} />
        </section>                                                        {/* Get from user preferences later */}
      </div>
    </main>
  );
}

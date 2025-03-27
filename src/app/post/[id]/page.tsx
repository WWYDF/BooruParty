import PostPageClient from "@/components/clientSide/Posts/Individual/PostPage";


type Props = {
  params: { id: string };
};

export default function PostPage({ params }: Props) {
  return <PostPageClient postId={params.id} />;
}

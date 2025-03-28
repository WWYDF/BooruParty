import PostPageClient from "@/components/clientSide/Posts/Individual/PostPageClient";


type Props = {
  params: Promise<{ id: string }>;
};

export default async function PostPage(props: Props) {
  const params = await props.params;
  return <PostPageClient postId={params.id} />;
}

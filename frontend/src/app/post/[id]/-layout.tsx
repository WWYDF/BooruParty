// app/post/[id]/layout.tsx
import { Metadata } from 'next';
import { ReactNode } from 'react';

export default function PostIdLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return {
    title: `Post #${params.id}`,
    description: `Viewing post ${params.id}`,
  };
}
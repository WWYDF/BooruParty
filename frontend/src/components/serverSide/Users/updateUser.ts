import { SafetyType } from "@prisma/client";

export async function updateUser(
  username: string,
  data: Partial<{
    username: string;
    email: string;
    password: string;
    description?: string;
    layout: 'GRID' | 'COLLAGE';
    theme: 'DARK' | 'LIGHT';
    postsPerPage: number;
    avatar: string;
    blurUnsafeEmbeds: boolean,
    defaultSafety: SafetyType[],
    blacklistedTags: number[],
    flipNavigators: boolean;
    profileBackground: number;
  }>
) {

  if (data.email === '') {
    delete data.email;
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/${username}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update user');
  }

  return await res.json();
}
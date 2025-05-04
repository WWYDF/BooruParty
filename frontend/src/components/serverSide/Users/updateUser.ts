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
  }>
) {
  const res = await fetch(`/api/users/${username}`, {
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
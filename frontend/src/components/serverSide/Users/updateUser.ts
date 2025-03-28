export async function updateUser(data: Partial<{
    username: string;
    email: string;
    password: string;
    layout: 'GRID' | 'COLLAGE';
    theme: 'DARK' | 'LIGHT';
    avatar: string;
}>) {
    const res = await fetch('/api/users', {
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
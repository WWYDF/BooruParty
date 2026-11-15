const API_Endpoint = process.env.NEXT_PUBLIC_FASTIFY;

let refreshing: Promise<boolean> | null = null;

// Only one refresh runs at a time
function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_Endpoint}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => { refreshing = null; })
  }
  return refreshing;
}

export async function API(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () => fetch(`${API_Endpoint}${path}`, { ...init, credentials: 'include' });

  let res = await doFetch();
  if (res.status === 401 && !path.startsWith('/api/auth')) {
    if (await refreshSession()) res = await doFetch();
  }
  return res;
}
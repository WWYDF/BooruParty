export const API_Endpoint = process.env.NEXT_PUBLIC_FASTIFY;

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

export type UploadResponse = { status: number; data: any };

// fetch() can't report upload progress, so file uploads use XMLHttpRequest instead
function xhrUpload(path: string, body: FormData, onProgress?: (fraction: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_Endpoint}${path}`);
    xhr.withCredentials = true; // same as fetch's credentials: 'include'
    xhr.responseType = 'json';  // non-JSON bodies come back as null
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => resolve({ status: xhr.status, data: xhr.response ?? {} });
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(body);
  });
}

// Like API(), but for multipart uploads with progress. Same refresh-and-retry on 401.
export async function APIUpload(path: string, body: FormData, onProgress?: (fraction: number) => void): Promise<UploadResponse> {
  let res = await xhrUpload(path, body, onProgress);
  if (res.status === 401 && await refreshSession()) {
    onProgress?.(0);
    res = await xhrUpload(path, body, onProgress);
  }
  return res;
}

export const errorText = (data: { error?: string; hint?: string }) =>
  data.hint ? `${data.error}: ${data.hint}` : data.error ?? 'Something went wrong';
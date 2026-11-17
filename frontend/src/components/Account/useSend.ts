'use client';

import { useToast } from "@/components/UI/Toast";
import { API, errorText } from "@/core/api";

// JSON request that toasts the API's error and returns the body (null on failure)
export function useSend() {
  const toast = useToast();

  return async <T>(path: string, method: string, body?: object): Promise<T | null> => {
    try {
      const res = await API(path, {
        method,
        ...(body && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return null;
      }
      return data as T;
    } catch {
      toast("The server could not be reached", "error");
      return null;
    }
  };
}

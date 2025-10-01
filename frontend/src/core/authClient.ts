'use client';

import { getSession } from 'next-auth/react';

export const browserPrefsKey = 'browserPreferences';

export async function getClientSession() {
  const session = await getSession(); // pulls session from client cookies
  return session;
}

export function loadPreferences() {
  try {
    const saved = localStorage.getItem("browserPreferences")
    return saved
      ? (JSON.parse(saved) as {
          layout: "GRID" | "COLLAGE"
          theme: "DARK" | "LIGHT"
          postsPerPage: number
          flipNavigators: boolean
        })
      : null
  } catch {
    return null
  }
}
'use server'

import { cookies } from "next/headers";

type SessionPatch = {
  username?: string;
  avatar?: string;
  // add more later (e.g. email, locale…)
};

export async function refreshAuth(patch: SessionPatch = {}): Promise<void> {
  // POSTing an empty object `{}` is perfectly fine ─ it just triggers a rebuild
  await fetch(`${process.env.NEXTAUTH_URL}/api/auth/session?update`, {
    method: "POST",
    headers: {
      cookie: cookies().toString(),
      "content-type": "application/json",
    },
    body: JSON.stringify(patch),
  });
}
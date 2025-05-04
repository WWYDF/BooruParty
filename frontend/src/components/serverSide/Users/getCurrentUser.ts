'use client'

import { UserSelf } from "@/core/types/users";

export async function getCurrentUser(): Promise<UserSelf> {
    const res = await fetch(`/api/users/self`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  
    if (!res.ok) {
      throw new Error('Failed to load user info');
    }
  
    return await res.json();
}
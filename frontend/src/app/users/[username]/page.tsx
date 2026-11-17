import { Metadata } from "next";
import UserProfile from "@/components/Users/Profile/UserProfile";
import { API_Endpoint } from "@/core/api";
import { UserProfile as Profile } from "@/core/types/users";

// No cookies on purpose: this is what a guest (or Discord's embed bot) is allowed to see
async function fetchProfile(username: string): Promise<Profile | null> {
  try {
    const res = await fetch(`${API_Endpoint}/api/users/${username}`, { next: { revalidate: 60 } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params; // already URL-encoded
  const user = await fetchProfile(username);
  if (!user) return { title: "User not found" };

  const title = `${user.username}'s Profile`;
  const description = [
    user.about,
    `Role: ${user.role.name}`,
    `Member Since: ${new Date(String(user.createdAt)).toLocaleDateString()}`,
  ].filter(Boolean).join("\n");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: user.avatar ? [{ url: user.avatar }] : [],
    },
  };
}

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <UserProfile username={decodeURIComponent(username)} />;
}

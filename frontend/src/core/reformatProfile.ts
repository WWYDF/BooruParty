export function setAvatarUrl(avatar: string | null | undefined): string {
  const baseUrl = process.env.NEXT_PUBLIC_FASTIFY ?? "http://localhost:3005";
  return avatar ? `${baseUrl}${avatar}` : "";
}
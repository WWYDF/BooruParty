import Link from "next/link";
import { formatRelativeTime } from "@/core/formats";
import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { cookies } from "next/headers";

type User = {
  id: string;
  username: string;
  avatar: string;
  description: string | null;
  role: { name: string };
  createdAt: string;
  lastLogin: string;
  _count: {
    favorites: number;
    comments: number;
  };
};

async function getUsersData(page: number) {
  const cookieStore = cookies();
  const cookieHeader = (await cookieStore).getAll()
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users?page=${page}`, {
    cache: "no-store",
    headers: {
      Cookie: cookieHeader,
    },
  });

  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

// export async function GET(
//   req: NextRequest,
//   context: { params: Promise<{ username: string }> }
// ) {
//   const { username } = await context.params;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const prams = await searchParams;
  const page = parseInt(prams.page || "1");
  const { users, totalPages }: { users: User[]; totalPages: number } = await getUsersData(page);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>

      {users.length === 0 ? (
        <p className="text-subtle text-sm">No users found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {users.map((user) => (
            <Link
              href={`/users/${user.username}`}
              key={user.id}
              className="bg-secondary rounded-xl p-4 hover:bg-secondary-border transition flex flex-col items-center text-center"
            >
              <img
                src={user.avatar || `/user.png`}
                alt={user.username}
                className="w-20 h-20 rounded-full object-cover mb-3"
              />
              <div className="flex items-center justify-center text-accent font-semibold">
                {user.username}
                <RoleBadge role={user.role.name} variant="badge" />
              </div>

              {user.description && (
                <div className="text-xs text-zinc-600 mt-1 mb-1 italic max-w-[90%]">
                  {user.description}
                </div>
              )}

              <div className="text-subtle text-sm mt-1">
                Last seen: {formatRelativeTime(user.lastLogin)}
              </div>
              <div className="text-subtle text-sm">
                Registered: {formatRelativeTime(user.createdAt)}
              </div>

              <div className="text-xs text-zinc-500 mt-2">
                ❤️ {user._count.favorites} favorites • 💬 {user._count.comments} comments
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2 pt-4 text-sm">
        {Array.from({ length: totalPages }, (_, i) => {
          const targetPage = i + 1;
          const href = targetPage === 1 ? "/users" : `/users?page=${targetPage}`;
          return (
            <Link
              key={i}
              href={href}
              className={`px-3 py-1 rounded border ${
                page === targetPage
                  ? "bg-accent border-accent text-white"
                  : "border-zinc-700 hover:bg-zinc-800 text-subtle"
              }`}
            >
              {targetPage}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

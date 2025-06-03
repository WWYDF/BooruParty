import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { Metadata } from 'next';
import { prisma } from '@/core/prisma';
import { setAvatarUrl } from '@/core/reformatProfile';

const inter = Inter({ subsets: ['latin'] });
let avatar = '';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const prams = await params;
  let user = await prisma.user.findUnique({
    where: { username: prams.username },
    select: {
      username: true,
      avatar: true,
      description: true,
      role: {
        select: {
          name: true,
          color: true,
        }
      },
      createdAt: true,
      _count: {
        select: {
          posts: true,
          comments: true,
          favorites: true
        }
      }
    }
  });

  if (!user) {
    return { title: 'User not found' };
  }

  avatar = setAvatarUrl(user.avatar);
  let motto = '';
  if (user.description) { motto = `${user.description}\n` }
  const description = `${motto}Role: ${user.role?.name ?? 'Member'}\nPosts: ${user._count.posts}\nFavorites: ${user._count.favorites}\nComments: ${user._count.comments}\nMember Since: ${new Date(user.createdAt).toLocaleDateString()}`;

  return {
    title: `${user.username}'s Profile`,
    description: `${description}`,
    openGraph: {
      title: `${user.username}'s Profile`,
      description: `${description}`,
      url: `${user.avatar}`,
    },
  };
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
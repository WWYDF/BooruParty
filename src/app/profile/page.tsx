import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Navbar from '@/components/clientSide/Navbar';
import { auth } from '@/core/auth';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/login'); // protect this page
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <section className="p-10 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-accent mb-4">
          Welcome, {session.user.username} 👋
        </h1>
        <div className="space-y-2">
          <p>
            <span className="font-medium text-subtle">Username:</span>{' '}
            {session.user.username}
          </p>
          <p>
            <span className="font-medium text-subtle">Email:</span>{' '}
            {session.user.email}
          </p>
          <p className="text-subtle text-sm">
            This is your profile page. More dashboard features coming soon.
          </p>
        </div>
      </section>
    </main>
  );
}

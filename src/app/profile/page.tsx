import Navbar from '@/components/clientSide/Navbar';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <section className="p-10 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-accent mb-4">Your Dashboard</h1>
        <p className="text-subtle">
          This is your profile/dashboard area. In the future, this will show your uploads, settings, and more.
        </p>
      </section>
    </main>
  );
}

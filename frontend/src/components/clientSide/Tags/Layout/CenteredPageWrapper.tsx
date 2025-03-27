export default function CenteredPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="bg-secondary p-6 rounded-2xl shadow space-y-6">
        {children}
      </div>
    </div>
  );
}


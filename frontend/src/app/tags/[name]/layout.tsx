import TagSubNavbar from "@/components/Tags/Layout/TagSubNavbar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  params: Promise<{ name: string }>;
};

export default async function Layout({ children, params }: Props) {
  const { name } = await params;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="bg-secondary p-6 rounded-2xl shadow space-y-6">
        <div className="space-y-6">
        <h1 className="text-3xl font-bold text-accent">{decodeURIComponent(name)}</h1>
          <TagSubNavbar tag={name} />
        </div>
        {children}
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Tag = {
  id: number;
  names: string[];
  category?: { 
    name: string;
    color: string;
};
  implications: { id: number; names: string[] }[];
  suggestions: { id: number; names: string[] }[];
};

export default function TagSummaryPage() {
  const { name } = useParams<{ name: string }>();
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;

    fetch(`/api/tags/${name}`)
      .then((res) => {
        if (!res.ok) throw new Error("Tag not found");
        return res.json();
      })
      .then((data) => setTag(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error || !tag) return <p className="text-red-500">{error || "Tag not found."}</p>;

  const aliases = tag.names.slice(1);

  return (
    <div className="space-y-4">
        <h1 className="text-xl font-bold text-accent">
            {tag.names[0]}
            {aliases.length > 0 && (
            <span className="text-subtle font-normal"> ({aliases.join(", ")})</span>
            )}
        </h1>

        <div className="text-sm">
            <span className="text-subtle">Category:</span>{" "}
            {tag.category ? (
                <a
                href={`/dashboard/tags/categories`}
                style={{ color: tag.category.color }}
                className="hover:underline transition"
                >
                {tag.category.name}
                </a>
            ) : (
                <span className="italic text-muted-foreground">(none)</span>
            )}
        </div>

        {tag.implications.length > 0 && (
            <div className="text-sm">
            <span className="text-subtle">Implications:</span>{" "}
            {tag.implications.map((imp, i) => (
                <span key={imp.id}>
                <a href={`/dashboard/tag/${imp.names[0]}`} className="text-accent hover:underline">
                    {imp.names[0]}
                </a>
                {i < tag.implications.length - 1 && ", "}
                </span>
            ))}
            </div>
        )}

        {tag.suggestions.length > 0 && (
            <div className="text-sm">
            <span className="text-subtle">Suggestions:</span>{" "}
            {tag.suggestions.map((sug, i) => (
                <span key={sug.id}>
                <a href={`/dashboard/tag/${sug.names[0]}`} className="text-accent hover:underline">
                    {sug.names[0]}
                </a>
                {i < tag.suggestions.length - 1 && ", "}
                </span>
            ))}
            </div>
        )}

        <div className="border-t border-secondary-border pt-4 text-subtle text-sm text-muted-foreground">
            <p>This tag has no description yet.</p>
            <p className="mt-2">
            This tag has <a className="text-accent hover:underline" href="#">1 usage(s)</a>.
            </p>
        </div>
        </div>

  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-secondary p-4 rounded-xl space-y-1 border border-secondary-border">
      <div className="text-subtle text-sm">{title}</div>
      {children}
    </div>
  );
}

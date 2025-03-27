"use client";

import { useEffect, useState } from "react";

type Tag = {
  id: number;
  names: string[];
  category?: { name: string };
  implications: { id: number; names: string[] }[];
  suggestions: { id: number; names: string[] }[];
};

export default function TagSummaryClient({ name }: { name: string }) {
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tags/${name}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setTag(data);
      })
      .catch(() => {
        setTag(null);
      })
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!tag) return <p className="text-red-500">Tag not found.</p>;

  const aliases = tag.names.slice(1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-accent">{tag.names[0]}</h1>

      <Card title="Category">
        {tag.category?.name || <span className="italic text-muted-foreground">None</span>}
      </Card>

      <Card title="Aliases">
        {aliases.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {aliases.map((alias) => (
              <span
                key={alias}
                className="px-2 py-0.5 text-sm rounded bg-secondary-border"
              >
                {alias}
              </span>
            ))}
          </div>
        ) : (
          <div className="italic text-muted-foreground">No aliases</div>
        )}
      </Card>

      <Card title="Implications">
        {tag.implications.length > 0 ? (
          <ul className="list-disc list-inside">
            {tag.implications.map((imp) => (
              <li key={imp.id}>
                <a className="text-accent hover:underline" href={`/dashboard/tag/${imp.names[0]}`}>
                  {imp.names[0]}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="italic text-muted-foreground">No implications</div>
        )}
      </Card>

      <Card title="Suggestions">
        {tag.suggestions.length > 0 ? (
          <ul className="list-disc list-inside">
            {tag.suggestions.map((sug) => (
              <li key={sug.id}>
                <a className="text-accent hover:underline" href={`/dashboard/tag/${sug.names[0]}`}>
                  {sug.names[0]}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="italic text-muted-foreground">No suggestions</div>
        )}
      </Card>
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

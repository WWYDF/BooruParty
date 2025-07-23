"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Tag } from "@/core/types/tags";

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

  function formatDescription(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
  
    const parts = text.split(urlRegex);
  
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            className="text-accent hover:underline break-words"
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        );
      } else {
        return <span key={index}>{part}</span>;
      }
    });
  }  

  if (loading) return <p className="text-zinc-600">Loading...</p>;
  if (error || !tag) return <p className="text-red-500">{error || "Tag not found."}</p>;

  const aliases = tag.aliases ?? [];
  const implications = tag.implications ?? [];
  const suggestions = tag.suggestions ?? [];

  return (
    <div className="space-y-6">
      <div className="text-sm space-y-2">
        <div>
          <span className="text-subtle">Category:</span>{" "}
          <a
            href={`/dashboard/categories`}
            style={{ color: tag.category.color }}
            className="hover:underline"
          >
            {tag.category.name}
          </a>
        </div>

        <div>
          <span className="text-subtle">Aliases:</span>{" "}
          {aliases.length > 0
            ? aliases.map((a, i) => (
              <span key={a.id} className="text-subtle">
                <a
                  key={a.id}
                  href={`/tags/${encodeURIComponent(a.alias)}`}
                  className="text-accent hover:underline"
                >
                  {a.alias}
                </a>
                {i < aliases.length - 1 && ", "}
              </span>
            ))
          : <span className="text-zinc-600">(none)</span>}
        </div>

        <div>
          <span className="text-subtle">Implications:</span>{" "}
          {implications.length > 0 ? (
            implications.map((imp, i) => (
              <span key={imp.id} className="text-subtle">
                <a
                  href={`/tags/${encodeURIComponent(imp.name)}`}
                  style={{ color: imp.category.color }}
                  className="hover:underline"
                >
                  {imp.name}
                </a>
                {i < implications.length - 1 && ", "}
              </span>
            ))
          ) : (
            <span className="text-zinc-600">(none)</span>
          )}
        </div>

        <div>
          <span className="text-subtle">Suggestions:</span>{" "}
          {suggestions.length > 0 ? (
            suggestions.map((sugg, i) => (
              <span key={sugg.id} className="text-subtle">
                <a
                  href={`/tags/${encodeURIComponent(sugg.name)}`}
                  style={{ color: sugg.category.color }}
                  className="hover:underline"
                >
                  {sugg.name}
                </a>
                {i < suggestions.length - 1 && ", "}
              </span>
            ))
          ) : (
            <span className="text-zinc-600">(none)</span>
          )}
        </div>
      </div>

      <hr className="border-secondary-border" />

      <div className="text-subtle text-sm text-muted-foreground space-y-2">
      <p>{tag.description ? formatDescription(tag.description) : "This tag has no description yet."}</p>
        <p>
          This tag has{" "}
          <a className="text-accent hover:underline" href={`/posts?query=${tag.name}`}>
            {tag._count?.posts ?? 0} usage(s)
          </a>.
        </p>
      </div>
    </div>
  );
}

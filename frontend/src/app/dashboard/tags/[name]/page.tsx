"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TagSubNavbar from "@/components/clientSide/Tags/Layout/TagSubNavbar";

export type Tag = {
  id: number;
  name: string;
  description: string;
  category: {
    id: number;
    name: string;
    color: string;
    order: number;
    updatedAt: Date;
  };
  aliases: { id: number; alias: string }[];
  implications: { id: number; name: string }[];
  suggestions: { id: number; name: string }[];
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

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error || !tag) return <p className="text-red-500">{error || "Tag not found."}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-accent">{tag.name}</h1>
      
      <TagSubNavbar tag={tag.name} />

      <div className="text-sm space-y-2">
        <div>
          <span className="text-subtle">Category:</span>{" "}
          <a
            href={`/dashboard/tags/categories`}
            style={{ color: tag.category.color }}
            className="hover:underline"
          >
            {tag.category.name}
          </a>
        </div>

        <div>
          <span className="text-subtle">Aliases:</span>{" "}
          {tag.aliases.length > 0
            ? tag.aliases.map((a, i) => (
              <a
                key={a.id}
                href={`/dashboard/tags/${encodeURIComponent(a.alias)}`}
                className="text-accent hover:underline"
              >
                {a.alias}{i < tag.aliases.length - 1 && ", "}
              </a>
            ))
          : <span className="text-zinc-600">(none)</span>}
        </div>

        <div>
          <span className="text-subtle">Implications:</span>{" "}
          {tag.implications.length > 0
            ? tag.implications.map((imp, i) => (
                <a
                  key={imp.id}
                  href={`/dashboard/tags/${encodeURIComponent(imp.name)}`}
                  className="text-accent hover:underline"
                >
                  {imp.name}{i < tag.implications.length - 1 && ", "}
                </a>
              ))
            : <span className="text-zinc-600">(none)</span>}
        </div>

        <div>
          <span className="text-subtle">Suggestions:</span>{" "}
          {tag.suggestions.length > 0
            ? tag.suggestions.map((sugg, i) => (
                <a
                  key={sugg.id}
                  href={`/dashboard/tags/${encodeURIComponent(sugg.name)}`}
                  className="text-accent hover:underline"
                >
                  {sugg.name}{i < tag.suggestions.length - 1 && ", "}
                </a>
              ))
            : <span className="text-zinc-600">(none)</span>}
        </div>
      </div>

      <hr className="border-secondary-border" />

      <div className="text-subtle text-sm text-muted-foreground space-y-2">
      <p>{tag.description ? formatDescription(tag.description) : "This tag has no description yet."}</p>
        <p>
          This tag has{" "}
          <a className="text-accent hover:underline" href="#">
            0 usage(s)
          </a>.
        </p>
      </div>
    </div>
  );
}

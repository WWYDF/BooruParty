"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImportSession } from "@prisma/client";
import { formatDuration } from "@/core/formats";

const IMPORTERS = [{ key: "szuru", label: "Szurubooru" }];

export default function ImportSoftwares({ previous }: { previous: ImportSession[] }) {
  const [importer, setImporter] = useState("szuru");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousSessions] = useState(previous);

  const router = useRouter();

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/system/import/szuru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, username, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      router.push(`/dashboard/import/status?id=${data.sessionId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-white">Import Data</h1>

      <div>
        <label className="text-sm text-zinc-400">Import Source</label>
        <select
          value={importer}
          onChange={(e) => setImporter(e.target.value)}
          className="w-full mt-1 bg-secondary border border-secondary-border p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
        >
          {IMPORTERS.map((imp) => (
            <option key={imp.key} value={imp.key}>
              {imp.label}
            </option>
          ))}
        </select>
      </div>

      {importer === "szuru" && (
        <>
          <div>
            <label className="text-sm text-zinc-400">Szurubooru URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full mt-1 bg-secondary border border-secondary-border p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
              placeholder="https://szuru.example.com"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1 bg-secondary border border-secondary-border p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-secondary border border-secondary-border p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
            />
          </div>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleStart}
        disabled={loading}
        className="bg-darkerAccent px-4 py-2 rounded text-white hover:bg-darkerAccent/80 transform disabled:opacity-40"
      >
        {loading ? "Starting..." : "Start Import"}
      </button>

      {previous.length > 0 && (
        <div className="pt-8 space-y-2">
          <h2 className="text-xl font-semibold text-white">Previous Imports</h2>
          <div className="space-y-1">
            {previous.map((imp) => (
              <div
                key={imp.id}
                className="flex items-center justify-between border border-zinc-800 rounded p-3 bg-zinc-900"
              >
                <div>
                  <div className="text-sm font-semibold text-white">Type: {imp.type}</div>
                  <div className="text-xs text-zinc-400">
                    Status: {imp.status} — {new Date(imp.createdAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-zinc-400">
                    Duration: {imp.duration ? formatDuration(imp.duration) : "—"}
                  </div>
                </div>
                <a
                  href={`/dashboard/import/status?id=${imp.id}`}
                  className="text-sm bg-darkerAccent px-3 py-1 rounded text-white hover:bg-darkerAccent/80"
                >
                  View Logs
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

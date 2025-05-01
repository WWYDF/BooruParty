"use client";

import { useState } from "react";

export default function SetupForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setStatus("loading");
    setError(null);

    const res = await fetch("/api/system/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });

    if (res.ok) {
      setStatus("success");
      location.href = "/login"; // Redirect after setup
    } else {
      const json = await res.json();
      setError(json.error || "Something went wrong");
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="bg-zinc-900 p-6 rounded-lg space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-800 text-white focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Username</label>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-800 text-white focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-800 text-white focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-accent hover:bg-orange-600 text-white font-semibold py-2 rounded"
      >
        {status === "loading" ? "Setting up..." : "Complete Setup"}
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  );
}

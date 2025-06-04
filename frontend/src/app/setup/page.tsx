"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DISALLOWED_USERNAMES } from "@/core/dictionary";
import { useToast } from "@/components/clientSide/Toast";

type Step = "SITE_SETTINGS" | "ADMIN_ACCOUNT" | "FINISH";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("SITE_SETTINGS");
  const [existingUser, setExistingUser] = useState<boolean | null>(null);
  const [siteName, setSiteName] = useState("Imageboard");
  const [accent, setAccent] = useState("#FFBB3D");
  const [darkerAccent, setDarkerAccent] = useState("#BB8624");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/system/setup")
      .then((res) => res.json())
      .then((data) => {
        if (data.setupComplete) router.push("/");
        setExistingUser(data.userExists);
        if (data.userExists) setStep("SITE_SETTINGS");
      });
  }, []);

  const handleNext = () => {
    if (step === "SITE_SETTINGS") {
      setStep(existingUser ? "FINISH" : "ADMIN_ACCOUNT");
      return;
    }
  
    if (step === "ADMIN_ACCOUNT") {
      if (DISALLOWED_USERNAMES.includes(username.trim().toLowerCase())) {
        toast("That username is not allowed. Please choose another.", 'error');
        return;
      }
  
      setStep("FINISH");
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    const res = await fetch("/api/system/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteName,
        accent,
        darkerAccent,
        email,
        username,
        password
      })
    });

    if (res.ok) {
      router.push("/login");
    } else {
      const json = await res.json();
      toast(json.error || "Something went wrong", 'error');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex justify-center items-center p-4">
      <div className="w-full max-w-lg bg-zinc-900 p-6 rounded-xl space-y-6">
        {step === "SITE_SETTINGS" && (
          <>
            <h1 className="text-2xl font-bold">Site Settings</h1>
            <label className="block">
              <span className="text-sm">Site Name</span>
              <input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full mt-1 p-2 bg-zinc-800 rounded text-white focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </label>
            <label className="block">
              <span className="text-sm">Accent Color</span>
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="mt-1 w-16 h-10"
              />
            </label>
            <label className="block">
              <span className="text-sm">Darker Accent</span>
              <input
                type="color"
                value={darkerAccent}
                onChange={(e) => setDarkerAccent(e.target.value)}
                className="mt-1 w-16 h-10"
              />
            </label>
            <button onClick={handleNext} className="w-full bg-yellow-600 hover:bg-yellow-600/80 transition py-2 mt-4 rounded text-white font-semibold">
              Continue
            </button>
          </>
        )}

        {step === "ADMIN_ACCOUNT" && (
          <>
            <h1 className="text-2xl font-bold">Create Admin Account</h1>
            <label className="block">
              <span className="text-sm">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 p-2 bg-zinc-800 rounded text-white focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </label>
            <label className="block">
              <span className="text-sm">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full mt-1 p-2 bg-zinc-800 rounded text-white focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </label>
            <label className="block">
              <span className="text-sm">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 p-2 bg-zinc-800 rounded text-white focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </label>
            <button onClick={handleNext} className="w-full bg-yellow-600 hover:bg-yellow-600/80 transition py-2 mt-4 rounded text-white font-semibold">
              Continue
            </button>
          </>
        )}

        {step === "FINISH" && (
          <>
            <h1 className="text-2xl font-bold">Confirm & Submit</h1>
            <p className="text-subtle">You're ready to initialize the site.</p>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-yellow-600 hover:bg-yellow-600/80 transition py-2 mt-4 rounded text-white font-semibold"
            >
              {loading ? "Setting up..." : "Finish Setup"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

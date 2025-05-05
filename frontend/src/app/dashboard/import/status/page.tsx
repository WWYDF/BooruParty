"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CaretCircleDown } from "@phosphor-icons/react";
import { formatDuration } from "@/core/formats";

type ImportLog = {
  timestamp: string;
  level: string;
  message: string;
};

type ImportSession = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  duration?: number;
  logs: ImportLog[];
};

export default function ImportStatusPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [session, setSession] = useState<ImportSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const search = window.location.search; // e.g., "?id=abc123"
    const params = new URLSearchParams(search);
    const id = params.get("id");
    setSessionId(id);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
  
    let interval: NodeJS.Timeout;
    let pollRate = 500;
  
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/system/import?id=${sessionId}`);
        const data = await res.json();
  
        if (!res.ok) throw new Error(data.error || "Failed to fetch logs");
  
        setSession(data);
  
        // If it's done, turn off polling to not spam lol
        if (["COMPLETED", "ERROR"].includes(data.status)) {
          clearInterval(interval);
        }
      } catch (err: any) {
        setError(err.message);
        clearInterval(interval);
      }
    };
  
    fetchLogs();
    interval = setInterval(fetchLogs, pollRate);
  
    return () => clearInterval(interval);
  }, [sessionId]);


  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (!logContainerRef.current || !autoScroll) return;

    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [session?.logs]);

  // Track user scroll intent
  const handleScroll = () => {
    if (!logContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 20;
    setAutoScroll(atBottom);
  };


  if (!sessionId) {
    return <div className="p-8 text-red-400">Missing session ID.</div>;
  }

  if (error) {
    return <div className="p-8 text-red-400">Error: {error}</div>;
  }

  if (!session) {
    return <div className="p-8 text-subtle">Loading data...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-white">Import Status</h1>
      <div className="text-subtle text-sm">Session ID: {session?.id}</div>
      <div className="text-subtle text-sm">Status: <span className={`font-semibold ${session?.status === "COMPLETED" ? "text-green-400" : session?.status === "ERROR" ? "text-red-400" : "text-yellow-400"}`}>{session?.status}</span></div>

      <div className="text-subtle text-xs">
        Duration: {formatDuration(Number(session.duration ?? 0))}
      </div>

      {/* Log Viewer */}
      <div className="relative">
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="bg-zinc-900 border border-zinc-700 rounded p-4 h-[400px] overflow-y-auto text-sm space-y-2 font-mono"
        >
          {session?.logs.map((log, i) => {
            const levelTag = log.level.toUpperCase();
            const levelColor =
              log.level === "error"
                ? "text-red-400"
                : log.level === "warn"
                ? "text-yellow-400"
                : log.level === "success"
                ? "text-green-400"
                : "text-blue-400"; // info

            return (
              <div key={i} className="flex gap-2 items-start whitespace-pre-wrap">
                <span className="text-zinc-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`${levelColor} shrink-0 font-semibold`}>[{levelTag}]</span>
                <span className="text-zinc-200">{log.message}</span>
              </div>
            );
          })}
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {!autoScroll && (
            <motion.button
              key="scroll-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => {
                if (logContainerRef.current) {
                  logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                  setAutoScroll(true);
                }
              }}
              className="absolute bottom-3 right-3 p-2 rounded-full bg-zinc-800 shadow-lg hover:bg-zinc-700 transition text-white"
              >
              <CaretCircleDown size={20} weight='fill' />
            </motion.button>
          )}
        </AnimatePresence>
      </div>


      {session?.status === "COMPLETED" && (
        <p className="text-green-400 font-semibold pt-4">Import completed successfully.</p>
      )}

      {session?.status === "ERROR" && (
        <p className="text-red-400 font-semibold pt-4">Import failed. Check the logs above.</p>
      )}
    </div>
  );
}

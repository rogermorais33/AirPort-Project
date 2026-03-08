"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listSessions } from "@/lib/api";
import type { Session } from "@/lib/types";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSessions(100)
      .then((items) => setSessions(items))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Sessions</h1>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/90 text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">Session</th>
              <th className="px-3 py-2 text-left">Device</th>
              <th className="px-3 py-2 text-left">Mode</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Started</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="border-t border-zinc-800 bg-zinc-950/70">
                <td className="px-3 py-2">
                  <Link href={`/sessions/${session.id}`} className="text-emerald-300 hover:underline">
                    {session.id.slice(0, 8)}...
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-300">{session.device_id.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-zinc-300">{session.mode}</td>
                <td className="px-3 py-2 text-zinc-300">{session.active ? "active" : "closed"}</td>
                <td className="px-3 py-2 text-zinc-400">{new Date(session.started_at).toLocaleString()}</td>
              </tr>
            ))}
            {sessions.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={5}>
                  Nenhuma sessão registrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

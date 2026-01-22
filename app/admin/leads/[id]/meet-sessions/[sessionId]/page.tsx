"use client";

import LiveCoachingPanel from "@/components/leads/LiveCoachingPanel";
import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ApiResp<T> = { data: T | null; error: string | null };

type MeetSession = {
  id: string;
  lead_id: string;
  meet_url: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function isUuidLike(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default function MeetSessionPage() {
  const params = useParams() as { id?: string; sessionId?: string };

  const leadId = params?.id;
  const sessionId = params?.sessionId;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<MeetSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchSession() {
    if (!leadId || !sessionId) return;

    const r = await fetch(`/api/admin/leads/${leadId}/meet-sessions/${sessionId}`, {
      cache: "no-store",
    });
    const j = (await r.json()) as ApiResp<MeetSession>;
    if (j.error) throw new Error(j.error);
    setSession(j.data);
  }

  useEffect(() => {
    if (!leadId || !sessionId) return;

    if (!isUuidLike(leadId) || !isUuidLike(sessionId)) {
      setError("URL inválida: leadId o sessionId no es UUID.");
      setLoading(false);
      return;
    }

    let alive = true;

    const load = async () => {
      try {
        setError(null);
        setLoading(true);
        await fetchSession();
      } catch (e: unknown) {
        if (!alive) return;
        const error = e instanceof Error ? e : new Error("Error desconocido");
        setError(error.message);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, sessionId]);

  if (!leadId || !sessionId) {
    return (
      <PageContainer>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Lead ID o Session ID no disponible
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Live Coaching — Meet Session</h1>
              <div className="mt-1 text-sm text-slate-600">
                Lead: <span className="font-mono">{leadId}</span> · Session:{" "}
                <span className="font-mono">{sessionId}</span>
              </div>
            </div>
            <Link
              href={`/admin/leads/${leadId}`}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Volver al Lead
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
            Cargando…
          </div>
        )}

        {!loading && session && (
          <LiveCoachingPanel
            leadId={leadId}
            sessionId={sessionId}
            meetUrl={session.meet_url}
          />
        )}
      </div>
    </PageContainer>
  );
}

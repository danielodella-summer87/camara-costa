"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MeetEvent = {
  id: string;
  meet_session_id: string;
  type: string | null;
  reason: string | null;
  payload: any;
  event_at: string | null;
  created_at: string | null;
};

type ApiResp<T> = { data: T | null; error: string | null };

function fmt(ts?: string | null) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-background">
      {children}
    </span>
  );
}

function Light({ on, color }: { on: boolean; color: "green" | "yellow" | "red" }) {
  const base =
    "h-4 w-4 rounded-full border shadow-sm transition-opacity";
  const cls =
    color === "green"
      ? "bg-green-500 border-green-600"
      : color === "yellow"
      ? "bg-yellow-400 border-yellow-500"
      : "bg-red-500 border-red-600";
  return <div className={`${base} ${cls} ${on ? "opacity-100" : "opacity-20"}`} />;
}

function getSignalFromPayload(payload: any): "green" | "yellow" | "red" | null {
  const s = payload?.signal;
  if (s === "green" || s === "yellow" || s === "red") return s;
  return null;
}

export default function LiveCoachingPanel({
  leadId,
  sessionId,
}: {
  leadId: string;
  sessionId: string;
}) {
  const [events, setEvents] = useState<MeetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  async function fetchEvents() {
    try {
      setErr(null);
      const res = await fetch(
        `/api/admin/leads/${leadId}/meet-sessions/${sessionId}/events`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ApiResp<MeetEvent[]>;
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setEvents(json.data ?? []);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error("Error desconocido");
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  }

  function findSupportedMimeType(): string | null {
    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];
    for (const mimeType of preferredTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return null;
  }

  async function startTranscription() {
    if (!sessionId || sessionId.trim().length === 0) {
      setMicError("sessionId no disponible");
      return;
    }

    try {
      setMicError(null);

      // UX: Mensaje antes de abrir selector
      setMicError("Se abrirá el selector. Elegí 'Pestaña de Chrome' (Google Meet) y activá 'Compartir audio'.");

      // Capturar audio de pestaña/sistema usando getDisplayMedia
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: true,
      } as any);
      displayStreamRef.current = displayStream;

      // Validar que hay audio tracks
      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length === 0) {
        displayStream.getTracks().forEach((t) => t.stop());
        throw new Error("No se pudo capturar audio. En el selector elegí 'Pestaña de Chrome' y activá 'Compartir audio'.");
      }

      // Limpiar mensaje de instrucciones
      setMicError(null);

      // (Opcional) Capturar también micrófono del usuario
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;
      } catch (micError) {
        // Micrófono es opcional, continuar sin él
        console.warn("No se pudo capturar micrófono (opcional):", micError);
      }

      // Mezclar streams usando AudioContext
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();

      // Conectar displayStream (audio de pestaña) a destination
      const sysSource = audioCtx.createMediaStreamSource(displayStream);
      sysSource.connect(destination);

      // Conectar micStream (si existe) a destination
      let micSource: MediaStreamAudioSourceNode | null = null;
      if (micStream) {
        micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      // Stream final mezclado
      const mixedStream = destination.stream;
      streamRef.current = mixedStream;

      // Encontrar mimeType soportado
      const mimeType = findSupportedMimeType();
      if (!mimeType) {
        displayStream.getTracks().forEach((t) => t.stop());
        if (micStream) micStream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        setMicError("No hay codec de audio soportado en este navegador");
        return;
      }

      // Crear MediaRecorder con stream final
      const recorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      console.log("RECORDER MIME:", recorder.mimeType);

      // Handler para chunks de audio
      recorder.ondataavailable = async (event: BlobEvent) => {
        // Ignorar blobs de size 0
        if (!event.data || event.data.size === 0) {
          return;
        }

        if (event.data && event.data.size > 0) {
          // DEBUG TRANSCRIBE: Logs de diagnóstico en cliente
          const blob = event.data;
          console.log("AUDIO BLOB SIZE:", blob.size);
          console.log("AUDIO BLOB TYPE:", blob.type);
          console.log("[DEBUG TRANSCRIBE CLIENT] Blob recibido:", {
            type: blob.type,
            size: blob.size,
            mimeType: mimeType,
            sizeKB: (blob.size / 1024).toFixed(2),
          });

          // DEBUG TRANSCRIBE: Validación de tamaño mínimo
          if (blob.size < 2000) {
            const errorMsg = `Audio vacío o demasiado corto (${blob.size} bytes). Se requiere al menos 2000 bytes.`;
            console.warn("[DEBUG TRANSCRIBE CLIENT]", errorMsg);
            setMicError(errorMsg);
            return;
          }

          try {
            // DEBUG TRANSCRIBE: Log antes de enviar
            console.log("[DEBUG TRANSCRIBE CLIENT] Enviando a servidor:", {
              sessionId,
              blobType: blob.type,
              blobSize: blob.size,
              contentType: blob.type || mimeType,
            });

            const res = await fetch(
              `/api/admin/meet-sessions/${sessionId}/transcribe`,
              {
                method: "POST",
                body: event.data,
                headers: {
                  "Content-Type": event.data.type || mimeType,
                },
              }
            );

            // DEBUG TRANSCRIBE: Log respuesta del servidor
            console.log("[DEBUG TRANSCRIBE CLIENT] Respuesta del servidor:", {
              ok: res.ok,
              status: res.status,
              statusText: res.statusText,
            });

            if (!res.ok) {
              const json = (await res.json()) as ApiResp<unknown>;
              const errorMsg = json.error || `HTTP ${res.status}`;
              console.error("[DEBUG TRANSCRIBE CLIENT] Error del servidor:", errorMsg);
              setMicError(`Error transcribiendo: ${errorMsg}`);
              // NO detener automáticamente, solo mostrar error
            } else {
              console.log("[DEBUG TRANSCRIBE CLIENT] Transcripción exitosa");
            }
            // Si es exitoso, el evento se agregará al feed automáticamente por el polling
          } catch (fetchError: unknown) {
            const error =
              fetchError instanceof Error
                ? fetchError
                : new Error("Error desconocido en fetch");
            setMicError(`Error de red: ${error.message}`);
            // NO detener automáticamente
          }
        }
      };

      // Iniciar grabación con chunks cada 2 segundos
      recorder.start(2000);
      setIsTranscribing(true);
    } catch (error: unknown) {
      const err =
        error instanceof Error ? error : new Error("Error desconocido");
      
      // Limpiar recursos en caso de error
      if (displayStreamRef.current) {
        displayStreamRef.current.getTracks().forEach((t) => t.stop());
        displayStreamRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicError("Permisos de captura de pantalla/audio denegados");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setMicError("No se encontró fuente de audio");
      } else {
        setMicError(err.message || `Error accediendo a audio: ${err.message}`);
      }
      setIsTranscribing(false);
    }
  }

  function stopTranscription() {
    // Detener MediaRecorder
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    // Detener todos los tracks de displayStream
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((track) => track.stop());
      displayStreamRef.current = null;
    }

    // Detener todos los tracks de micStream (si existe)
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // Cerrar AudioContext (si existe)
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    // Limpiar streamRef
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsTranscribing(false);
  }

  useEffect(() => {
    fetchEvents();
    timerRef.current = window.setInterval(fetchEvents, 2000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      // Cleanup: si se desmonta y está transcribiendo, detener
      if (isTranscribing) {
        stopTranscription();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, sessionId]);

  const lastSignal = useMemo(() => {
    // buscamos el último evento tipo signal que tenga payload.signal válido
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev?.type === "signal") {
        const s = getSignalFromPayload(ev.payload);
        if (s) return s;
      }
    }
    return "green" as const; // default
  }, [events]);

  const lastHint = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev?.type === "hint") return ev;
    }
    return null;
  }, [events]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Semáforo */}
      <div className="lg:col-span-1 rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Semáforo Estratégico</h2>
          <Pill>{loading ? "cargando…" : "en vivo (polling)"}</Pill>
        </div>

        <div className="flex items-center gap-3">
          <Light on={lastSignal === "green"} color="green" />
          <span className="text-sm">🟢 Verde</span>
        </div>
        <div className="flex items-center gap-3">
          <Light on={lastSignal === "yellow"} color="yellow" />
          <span className="text-sm">🟡 Amarillo</span>
        </div>
        <div className="flex items-center gap-3">
          <Light on={lastSignal === "red"} color="red" />
          <span className="text-sm">🔴 Rojo</span>
        </div>

        <div className="pt-2 border-t space-y-1">
          <div className="text-xs text-muted-foreground">Estado actual</div>
          <div className="text-base font-semibold">
            {lastSignal === "green"
              ? "Verde (controlado)"
              : lastSignal === "yellow"
              ? "Amarillo (fricción/oportunidad)"
              : "Rojo (momento crítico)"}
          </div>
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="text-xs text-muted-foreground">Última indicación (si existe)</div>
          {lastHint ? (
            <div className="text-sm">
              <div className="font-medium">{lastHint.payload?.title ?? "—"}</div>
              <div className="text-muted-foreground">{lastHint.payload?.detail ?? ""}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {fmt(lastHint.event_at ?? lastHint.created_at)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Todavía no hay hints.</div>
          )}
        </div>

        {err ? (
          <div className="pt-2 text-sm text-red-600">
            Error: {err}
          </div>
        ) : null}

        <div className="pt-2 space-y-2">
          <button
            onClick={fetchEvents}
            className="px-3 py-2 rounded-md border hover:bg-muted text-sm w-full"
          >
            Refrescar ahora
          </button>

          {/* Botón de transcripción */}
          <button
            onClick={isTranscribing ? stopTranscription : startTranscription}
            className={`px-3 py-2 rounded-md border text-sm w-full font-medium ${
              isTranscribing
                ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                : "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100"
            }`}
          >
            {isTranscribing ? "Detener Transcripción" : "Iniciar Transcripción"}
          </button>

          {/* Indicador de estado */}
          {isTranscribing && (
            <div className="text-xs text-center text-muted-foreground">
              🎙️ Transcribiendo…
            </div>
          )}

          {/* Error de micrófono */}
          {micError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              ⚠️ {micError}
            </div>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="lg:col-span-2 rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Feed de eventos</h2>
          <Pill>{events.length} eventos</Pill>
        </div>

        <div className="space-y-2 max-h-[65vh] overflow-auto pr-2">
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay eventos todavía (deberías ver al menos el “inicio_sesion”).
            </div>
          ) : (
            [...events].reverse().map((ev) => (
              <div key={ev.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Pill>{ev.type ?? "—"}</Pill>
                    {ev.reason ? <Pill>{ev.reason}</Pill> : null}
                    {ev.type === "signal" ? (
                      <Pill>signal: {getSignalFromPayload(ev.payload) ?? "—"}</Pill>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(ev.event_at ?? ev.created_at)}
                  </div>
                </div>

                {(ev.payload?.title || ev.payload?.detail) && (
                  <div className="mt-2 text-sm">
                    {ev.payload?.title ? (
                      <div className="font-medium">{ev.payload.title}</div>
                    ) : null}
                    {ev.payload?.detail ? (
                      <div className="text-muted-foreground">{ev.payload.detail}</div>
                    ) : null}
                  </div>
                )}

                {/* payload crudo (útil para debug) */}
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Ver payload
                  </summary>
                  <pre className="text-xs mt-2 whitespace-pre-wrap">
{JSON.stringify(ev.payload ?? {}, null, 2)}
                  </pre>
                </details>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
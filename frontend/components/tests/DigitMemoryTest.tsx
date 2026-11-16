"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ExerciseIntro } from "@/components/tests/shared/ExerciseIntro";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import {
  challengeEngineErrorMessage,
  challengeEnginesService,
} from "@/lib/api/challenge-engines.service";
import { isApiError } from "@/lib/api/errors";

type DigitMemoryTestProps = {
  sessionPlayerId: string;
  stepIndex?: number;
  stepTotal?: number;
};

type Phase = "intro" | "showing" | "input" | "saving" | "error";

function wait(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), ms);
  }).then(() => {
    if (signal.cancelled) throw new Error("cancelled");
  });
}

export function DigitMemoryTest({
  sessionPlayerId: _sessionPlayerId,
  stepIndex,
  stepTotal,
}: DigitMemoryTestProps) {
  const router = useRouter();
  const tokenRef = useRef("");
  const signal = useRef({ cancelled: false });
  const [phase, setPhase] = useState<Phase>("intro");
  const [level, setLevel] = useState(1);
  const [length, setLength] = useState(3);
  const [digit, setDigit] = useState<number | null>(null);
  const [entry, setEntry] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const busy = useRef(false);

  useLeaveGuard(phase === "showing" || phase === "input");

  useEffect(() => {
    const current = signal.current;
    return () => {
      current.cancelled = true;
    };
  }, []);

  const advance = async () => {
    const { loadPlayerSession } = await import("@/lib/sessions/player-session");
    const { fetchPlayerProgressV2 } = await import("@/lib/sessions/player-v2");
    const stored = loadPlayerSession();
    if (!stored) throw new Error("Session joueur introuvable.");
    const progress = await fetchPlayerProgressV2(stored.code);
    if (progress.allDone || !progress.nextExercise) {
      router.replace(`/play/${progress.session.code}?done=1`);
    } else {
      router.replace(`/play/${progress.session.code}/${progress.nextExercise}`);
    }
  };

  const playLevel = async (token: string) => {
    setPhase("showing");
    let current = token;
    for (;;) {
      const data = await challengeEnginesService.digitReveal(current);
      current = data.token;
      tokenRef.current = current;
      setDigit(data.digit);
      await wait(800, signal.current);
      setDigit(null);
      if (data.answer) {
        setEntry([]);
        setPhase("input");
        return;
      }
      await wait(300, signal.current);
    }
  };

  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    setMessage("");
    try {
      const data = await challengeEnginesService.digitStart();
      tokenRef.current = data.token;
      setLevel(data.level);
      setLength(data.length);
      await playLevel(data.token);
    } catch (error) {
      if (signal.current.cancelled) return;
      if (isApiError(error) && error.status === 409) {
        await advance();
        return;
      }
      setPhase("error");
      setMessage(challengeEngineErrorMessage(error));
    } finally {
      busy.current = false;
    }
  };

  const confirm = async () => {
    if (busy.current || entry.length === 0) return;
    busy.current = true;
    setPhase("saving");
    try {
      const data = await challengeEnginesService.digitAnswer(
        tokenRef.current,
        entry,
      );
      if (!data.finished) {
        setLevel(data.level ?? 1);
        setLength(data.length ?? 3);
        setMessage("");
        await playLevel(data.token ?? "");
        return;
      }
      setMessage(
        data.exact
          ? "Séquence retenue."
          : "Séquence interrompue. Passage à la suite…",
      );
      await advance();
    } catch (error) {
      if (signal.current.cancelled) return;
      setPhase("error");
      setMessage(challengeEngineErrorMessage(error));
    } finally {
      busy.current = false;
    }
  };

  return (
    <section className="flex flex-col gap-4">
      {phase === "intro" || phase === "error" ? (
        <ExerciseIntro
          slug="digit-memory"
          title="Mémoire numérique séquentielle"
          tip="Un chiffre à la fois, puis la même suite."
          stepIndex={stepIndex}
          stepTotal={stepTotal}
        >
          <p className="text-center text-sm text-muted">
            Mémorise les chiffres dans l&apos;ordre, puis réécris-les.
          </p>
          <p className="text-center text-sm text-muted" dir="rtl">
            احفظ الأرقام بالترتيب، ثم أعد كتابتها.
          </p>
          {message ? <p className="text-center text-sm text-danger">{message}</p> : null}
          <Button onClick={start}>{phase === "error" ? "Réessayer" : "Démarrer l'exercice"}</Button>
        </ExerciseIntro>
      ) : null}

      {phase === "showing" ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface">
          <p className="text-sm text-muted">Niveau {level} · {length} chiffres</p>
          <p className="text-7xl font-bold tabular-nums text-brand">{digit ?? ""}</p>
        </div>
      ) : null}

      {phase === "input" || phase === "saving" ? (
        <div className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted">
            Niveau {level} · {entry.length}/{length}
          </p>
          <p className="min-h-14 max-w-full break-words px-2 text-center text-3xl font-bold tracking-[0.16em] text-brand sm:text-4xl sm:tracking-[0.3em]">
            {entry.join(" ")}
          </p>
          <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
              <Button
                key={value}
                variant="secondary"
                disabled={phase === "saving" || entry.length >= length}
                onClick={() => setEntry((current) => current.length >= length ? current : [...current, value])}
              >
                {value}
              </Button>
            ))}
            <Button variant="secondary" disabled={phase === "saving"} onClick={() => setEntry((current) => current.slice(0, -1))}>
              Effacer
            </Button>
            <Button
              variant="secondary"
              disabled={phase === "saving" || entry.length >= length}
              onClick={() => setEntry((current) => current.length >= length ? current : [...current, 0])}
            >
              0
            </Button>
            <Button disabled={phase === "saving" || entry.length !== length} onClick={confirm}>
              Valider
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

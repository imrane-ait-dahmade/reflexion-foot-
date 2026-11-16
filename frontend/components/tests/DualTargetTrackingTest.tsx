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
import { DUAL_HIGHLIGHT_MS } from "@/lib/tests/dual-target-tracking/config";
import {
  createOrbs,
  stepOrbs,
  type Orb,
} from "@/lib/tests/dual-target-tracking/motion";

type DualTargetTrackingTestProps = {
  sessionPlayerId: string;
  sessionId: string;
  stepIndex?: number;
  stepTotal?: number;
};

type Challenge = {
  level: number;
  totalLevels: number;
  objects: number;
  durationMs: number;
  speed: number;
};

type Phase = "intro" | "highlight" | "move" | "pick" | "saving" | "error";

export function DualTargetTrackingTest({
  sessionPlayerId: _sessionPlayerId,
  sessionId,
  stepIndex,
  stepTotal,
}: DualTargetTrackingTestProps) {
  const router = useRouter();
  const tokenRef = useRef("");
  const orbsRef = useRef<Orb[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [highlight, setHighlight] = useState<number[]>([]);
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const highlightTimer = useRef<number | null>(null);

  useLeaveGuard(phase === "highlight" || phase === "move" || phase === "pick");

  useEffect(() => {
    return () => {
      if (highlightTimer.current != null) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "move" || !challenge) return;
    let frame = 0;
    let previous = performance.now();
    const started = previous;
    const tick = (now: number) => {
      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      orbsRef.current = stepOrbs(orbsRef.current, delta);
      setOrbs(orbsRef.current);
      if (now - started >= challenge.durationMs) {
        setHighlight([]);
        setSelected([]);
        setPhase("pick");
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [challenge, phase]);

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

  const beginRound = (token: string, next: Challenge & { highlightIds: number[] }) => {
    const { highlightIds, ...publicChallenge } = next;
    tokenRef.current = token;
    setChallenge(publicChallenge);
    setHighlight(highlightIds);
    const created = createOrbs(sessionId, next.level);
    orbsRef.current = created;
    setOrbs(created);
    setSelected([]);
    setPhase("highlight");
    if (highlightTimer.current != null) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => {
      setHighlight([]);
      setPhase("move");
    }, DUAL_HIGHLIGHT_MS);
  };

  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    setMessage("");
    try {
      const data = await challengeEnginesService.dualStart();
      beginRound(data.token, data.challenge);
    } catch (error) {
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
    if (busy.current || selected.length !== 2) return;
    busy.current = true;
    setPhase("saving");
    try {
      const data = await challengeEnginesService.dualSubmit(
        tokenRef.current,
        selected,
      );
      if (!data.finished) {
        if (!data.token || !data.challenge) {
          throw new Error("Réponse serveur incomplète.");
        }
        beginRound(data.token, data.challenge);
        return;
      }
      await advance();
    } catch (error) {
      setPhase("pick");
      setMessage(challengeEngineErrorMessage(error));
    } finally {
      busy.current = false;
    }
  };

  const toggle = (id: number) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  };

  return (
    <section className="flex flex-col gap-4">
      {phase === "intro" || phase === "error" ? (
        <ExerciseIntro
          slug="dual-target-tracking"
          title="Suivi de deux cibles mobiles"
          tip="Deux cibles, puis le mouvement."
          stepIndex={stepIndex}
          stepTotal={stepTotal}
        >
          <p className="text-center text-sm text-muted">
            Deux ballons sont colorés au départ. Ils redeviennent identiques aux autres : retiens-les, suis-les, puis désigne-les.
          </p>
          <p className="text-center text-sm text-muted" dir="rtl">
            بالونان ملوّنان في البداية، ثم يصبحان مثل البقية. تذكّرهما وحدّدهما بعد التوقف.
          </p>
          {message ? <p className="text-center text-sm text-danger">{message}</p> : null}
          <Button onClick={start}>{phase === "error" ? "Réessayer" : "Démarrer l'exercice"}</Button>
        </ExerciseIntro>
      ) : null}

      {challenge && phase !== "intro" && phase !== "error" ? (
        <>
          <p className="text-center text-sm text-muted">
            Niveau {challenge.level}/{challenge.totalLevels}
            {phase === "highlight" ? " · Mémorise les deux ballons colorés" : null}
            {phase === "move" ? " · Suis les deux cibles" : null}
            {phase === "pick" ? " · Choisis les deux cibles" : null}
          </p>
          <div className="relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden rounded-2xl border border-brand/40 bg-black">
            {orbs.map((orb) => {
              const marked = highlight.includes(orb.id);
              const chosen = selected.includes(orb.id);
              return (
                <button
                  key={orb.id}
                  type="button"
                  disabled={phase !== "pick"}
                  aria-label={phase === "pick" ? `Objet ${orb.id + 1}` : "Cible"}
                  onClick={() => toggle(orb.id)}
                  className={`absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold ${
                    marked
                      ? "bg-brand text-white"
                      : chosen
                        ? "bg-white text-black ring-4 ring-brand"
                        : "bg-white text-black"
                  }`}
                  style={{ left: `${orb.x * 100}%`, top: `${orb.y * 100}%` }}
                >
                  {phase === "pick" ? orb.id + 1 : ""}
                </button>
              );
            })}
          </div>
          {message ? <p className="text-center text-sm text-danger">{message}</p> : null}
          {phase === "pick" || phase === "saving" ? (
            <Button disabled={selected.length !== 2 || phase === "saving"} onClick={confirm}>
              Valider les deux cibles
            </Button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

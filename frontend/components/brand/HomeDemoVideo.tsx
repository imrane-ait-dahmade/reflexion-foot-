"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Play, X } from "lucide-react";

const DEMO_SRC = "/demo-cognitif-connexion.mp4";
const DEMO_POSTER = "/demo-cognitif-connexion.jpg";

/**
 * Home demo opens in a popup. The mp4 loads only after the visitor starts play.
 */
export function HomeDemoVideo({
  className = "",
}: {
  className?: string;
} = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setStarted(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      const video = videoRef.current;
      if (video) {
        video.pause();
      }
    };
  }, [close, open]);

  const start = async () => {
    setStarted(true);
    const video = videoRef.current;
    if (!video) return;
    try {
      video.load();
      await video.play();
    } catch {
      // Native controls remain available.
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative mx-auto block w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface text-left ${className}`}
        whileHover={reduceMotion ? undefined : { scale: 1.01 }}
        whileTap={reduceMotion ? undefined : { scale: 0.99 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        aria-haspopup="dialog"
      >
        <span className="relative block aspect-video bg-black md:aspect-auto md:h-[min(34vh,17.5rem)] lg:h-[min(38vh,20rem)]">
          <Image
            src={DEMO_POSTER}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover opacity-80 transition group-hover:opacity-90"
            priority
          />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white sm:gap-3">
            <span className="flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition group-hover:scale-105 sm:size-16">
              <Play className="size-6 fill-current sm:size-7" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-wide">
              Voir la démo
            </span>
          </span>
        </span>
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Démonstration Cognitif Connexion Foot"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 28, scale: 0.97 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 16, scale: 0.98 }
              }
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              className="flex w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-background p-3 shadow-2xl sm:p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-base font-semibold sm:text-lg">
                  Démo en direct
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted hover:text-foreground"
                  aria-label="Fermer"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  controls={started}
                  playsInline
                  preload="none"
                  poster={DEMO_POSTER}
                  aria-label="Démonstration Cognitif Connexion Foot"
                >
                  {started ? <source src={DEMO_SRC} type="video/mp4" /> : null}
                </video>

                {!started ? (
                  <button
                    type="button"
                    onClick={start}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-white transition hover:bg-black/40"
                  >
                    <span className="flex size-16 items-center justify-center rounded-full bg-brand text-white">
                      <Play className="size-7 fill-current" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold tracking-wide">
                      Lancer la vidéo
                    </span>
                  </button>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

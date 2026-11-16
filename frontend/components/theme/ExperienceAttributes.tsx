"use client";

import { useEffect } from "react";
import type { ExperienceMode } from "@/lib/theme/constants";

type ExperienceAttributesProps = {
  experience: ExperienceMode;
  /** Hides site footer for full-screen exercise flows. */
  immersive?: boolean;
};

/** Sets data-experience on <html> for CSS and keeps cleanup on unmount. */
export function ExperienceAttributes({
  experience,
  immersive = false,
}: ExperienceAttributesProps) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-experience");
    root.setAttribute("data-experience", experience);
    root.classList.toggle("player-immersive", immersive && experience === "player");

    return () => {
      if (previous) root.setAttribute("data-experience", previous);
      else root.removeAttribute("data-experience");
      root.classList.remove("player-immersive");
    };
  }, [experience, immersive]);

  return null;
}

"use client";

import { useEffect } from "react";

/** Warns before leaving the page while a test is in progress. */
export function useLeaveGuard(active: boolean, message = "Le test est en cours. Quitter annulera ta tentative.") {
  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active, message]);
}

export function coachOwnsPlayer(coachId: string, ownerCoachId: string | null) {
  return Boolean(coachId) && coachId === ownerCoachId;
}

export function textDirection(language: "fr" | "ar") {
  return language === "ar" ? "rtl" : "ltr";
}

const recentRetries = new Map<string, number>();

export function allowManualRetry(key: string, now = Date.now(), windowMs = 15_000) {
  const previous = recentRetries.get(key) ?? 0;
  if (now - previous < windowMs) return false;
  recentRetries.set(key, now);
  return true;
}

export function resetRetryWindow() {
  recentRetries.clear();
}

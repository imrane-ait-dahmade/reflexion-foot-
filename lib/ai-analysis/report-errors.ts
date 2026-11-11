export type ReportLanguage = "fr" | "ar";

const MESSAGES = {
  fr: {
    incomplete_response:
      "Le rapport a été coupé avant la fin. Relance pour le générer à nouveau.",
    empty_response:
      "Le rapport n'a pas pu être rédigé. Relance dans un moment.",
    invalid_schema:
      "Le rapport n'a pas pu être finalisé. Relance pour réessayer.",
    unknown_metric_key:
      "Le rapport n'a pas pu être finalisé. Relance pour réessayer.",
    missing_language:
      "Le rapport était incomplet. Relance pour le générer à nouveau.",
    report_type_mismatch:
      "Le rapport n'a pas pu être finalisé. Relance pour réessayer.",
    schema_optional_field:
      "Le service d'analyse a un problème temporaire. Relance dans un moment.",
    missing_api_key:
      "L'analyse n'est pas configurée pour le moment.",
    provider_error:
      "Le service d'analyse est indisponible. Relance dans un moment.",
    rate_limit:
      "Trop de tentatives. Attends quelques secondes puis relance.",
    network:
      "Pas de connexion. Vérifie ton réseau puis relance.",
    disabled: "L'analyse IA est désactivée.",
    incomplete_player:
      "Le rapport se génère quand le joueur a terminé tous ses exercices.",
    generic: "Le rapport n'a pas pu être créé. Relance pour réessayer.",
    pending: "Analyse en cours. Merci de patienter.",
    not_eligible: "Les données ne permettent pas encore de générer ce rapport.",
  },
  ar: {
    incomplete_response: "التقرير قُطع قبل الاكتمال. أعد المحاولة.",
    empty_response: "تعذر كتابة التقرير. أعد المحاولة بعد قليل.",
    invalid_schema: "تعذر إنهاء التقرير. أعد المحاولة.",
    unknown_metric_key: "تعذر إنهاء التقرير. أعد المحاولة.",
    missing_language: "التقرير كان غير مكتمل. أعد المحاولة.",
    report_type_mismatch: "تعذر إنهاء التقرير. أعد المحاولة.",
    schema_optional_field: "خدمة التحليل تواجه مشكلة مؤقتة. أعد المحاولة بعد قليل.",
    missing_api_key: "التحليل غير مُعدّ حالياً.",
    provider_error: "خدمة التحليل غير متاحة. أعد المحاولة بعد قليل.",
    rate_limit: "محاولات كثيرة. انتظر ثوانٍ ثم أعد المحاولة.",
    network: "لا يوجد اتصال. تحقق من الشبكة ثم أعد المحاولة.",
    disabled: "تحليل الذكاء الاصطناعي متوقف.",
    incomplete_player: "يُنشأ التقرير عندما يُنهي اللاعب كل التمارين.",
    generic: "تعذر إنشاء التقرير. أعد المحاولة.",
    pending: "التحليل قيد الإنجاز. يرجى الانتظار.",
    not_eligible: "المعطيات لا تسمح بعد بإنشاء هذا التقرير.",
  },
} as const;

type MessageKey = keyof (typeof MESSAGES)["fr"];

function keyFromCode(code: string | null | undefined): MessageKey {
  if (!code) return "generic";
  const lower = code.toLowerCase();
  if (lower in MESSAGES.fr) return lower as MessageKey;
  if (lower.includes("incomplete")) return "incomplete_response";
  if (lower.includes("empty")) return "empty_response";
  if (lower.includes("schema") || lower.includes("invalid")) return "invalid_schema";
  if (lower.includes("rate") || lower.includes("429")) return "rate_limit";
  if (lower.includes("api key") || lower.includes("missing_api")) return "missing_api_key";
  if (lower.includes("network") || lower.includes("fetch")) return "network";
  if (lower.includes("disabled")) return "disabled";
  return "provider_error";
}

/** Coach-facing text for a failed or blocked AI report. Never shows raw codes. */
export function friendlyReportError(
  code: string | null | undefined,
  language: ReportLanguage = "fr",
  reason?: string | null,
) {
  if (reason && language === "fr" && /[àâéèêëïîôùûüç]/i.test(reason)) {
    return reason;
  }
  if (reason && language === "ar" && /[\u0600-\u06FF]/.test(reason)) {
    return reason;
  }
  return MESSAGES[language][keyFromCode(code)];
}

export function friendlyApiError(message: string, language: ReportLanguage = "fr") {
  const lower = message.toLowerCase();
  if (lower.includes("désactiv") || lower.includes("disabled")) {
    return MESSAGES[language].disabled;
  }
  if (lower.includes("terminé tous") || lower.includes("incomplete")) {
    return MESSAGES[language].incomplete_player;
  }
  if (lower.includes("quelques secondes") || lower.includes("429")) {
    return MESSAGES[language].rate_limit;
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return MESSAGES[language].network;
  }
  if (/[àâéèêëïîôùûüç]/i.test(message) && language === "fr") return message;
  if (/[\u0600-\u06FF]/.test(message) && language === "ar") return message;
  return MESSAGES[language].generic;
}

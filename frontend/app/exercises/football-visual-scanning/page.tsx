import { redirect } from "next/navigation";

/** Free play disabled — the coach assigns this exercise in a session. */
export default function FootballVisualScanningPage() {
  redirect("/join");
}

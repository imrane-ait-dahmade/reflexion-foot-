import { redirect } from "next/navigation";

/** Free tests disabled — join a session with a code. */
export default function DigitMemoryPage() {
  redirect("/join");
}

import { ExperienceAttributes } from "@/components/theme/ExperienceAttributes";

/** Marks all /coach/* routes as the coach experience (theme stays independent). */
export default function CoachAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ExperienceAttributes experience="coach" />
      {children}
    </>
  );
}

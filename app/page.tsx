import { redirect } from "next/navigation";
import { accessibleAdvisorIds, requireUser } from "@/lib/authz";

/** Sends each role to its home screen. Advisors land on Today once Phase 3 ships. */
export default async function Home() {
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin");

  const ids = await accessibleAdvisorIds(user);
  if (user.role === "advisor" && Array.isArray(ids) && ids.length === 1) {
    redirect(`/advisors/${ids[0]}/settings`);
  }
  redirect("/advisors");
}

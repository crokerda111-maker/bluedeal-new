import { redirect } from "next/navigation";

// Hot deals is now operated as a community-style board.
// Keep /hot as a stable entry point, but use /community/hotdeal as the canonical board.
export const dynamic = "force-dynamic";

export default function HotPage() {
  redirect("/community/hotdeal");
}

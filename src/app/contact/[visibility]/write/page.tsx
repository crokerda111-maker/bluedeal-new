import { redirect } from "next/navigation";

export default function LegacyContactWritePage({ params }: { params: { visibility: string } }) {
  const vis = params.visibility === "private" ? "private" : "public";
  redirect(`/contact/write?vis=${vis}`);
}

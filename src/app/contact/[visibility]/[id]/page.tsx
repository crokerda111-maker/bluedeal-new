import { redirect } from "next/navigation";

export default function LegacyContactDetailPage({ params }: { params: { id: string } }) {
  redirect(`/contact/${params.id}`);
}

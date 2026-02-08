import { Suspense } from "react";
import ContactWriteClient from "./ContactWriteClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>로딩 중…</div>}>
      <ContactWriteClient />
    </Suspense>
  );
}

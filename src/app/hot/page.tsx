import { Suspense } from "react";
import HotClient from "./HotClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>로딩 중…</div>}>
      <HotClient />
    </Suspense>
  );
}

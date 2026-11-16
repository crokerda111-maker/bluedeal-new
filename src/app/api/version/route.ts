import { NextResponse } from "next/server";
import { version } from "../../../../package.json";

export const dynamic = "force-dynamic";

export function GET() {
  const gitCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? "";

  return NextResponse.json(
    {
      service: "BLUEDEAL",
      version,
      commit: /^[a-f0-9]{40}$/i.test(gitCommit) ? gitCommit : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

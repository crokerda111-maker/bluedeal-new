"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { SITE_URL } from "../../lib/site";

const untrackedPaths = /^\/(?:account|admin|contact|login|signup)(?:\/|$)|\/write\/?$/;

function publicPageView(event: BeforeSendEvent) {
  const url = new URL(event.url, window.location.origin);
  if (url.origin !== SITE_URL || untrackedPaths.test(url.pathname)) return null;
  return { ...event, url: url.origin + url.pathname };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={publicPageView} />;
}

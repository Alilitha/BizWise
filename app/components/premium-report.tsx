"use client";

import { ShieldCheck } from "lucide-react";
import { PremiumInsights } from "./business-coach";
import { PremiumDashboard } from "./premium-dashboard";
import { TextbookGenerator, type Authorize } from "./textbook-generator";
import type { BusinessMetrics } from "../premium/metrics";

export type PremiumAccess = { kind: "checking" } | { kind: "locked" } | { kind: "subscribed"; expires: string } | { kind: "demo"; reference: string };

export function PremiumReport({ access, shopName, businessType, metrics, onUpgrade, authorize }: {
  access: PremiumAccess; shopName: string; businessType: string; metrics: BusinessMetrics; onUpgrade: () => void; authorize: Authorize;
}) {
  if (access.kind === "checking") return <div className="card"><p className="muted" role="status">Checking your Premium access…</p></div>;
  if (access.kind === "locked") return <PremiumInsights onUpgrade={onUpgrade}/>;
  return <div className="stack">
    <p className="pm-access-banner" role="status"><ShieldCheck size={16}/>{access.kind === "subscribed"
      ? `Premium subscription active until ${new Date(access.expires).toLocaleDateString("en-ZA")}.`
      : `Premium unlocked in demo mode on this browser (reference ${access.reference}). No payment was taken.`}</p>
    <PremiumDashboard shopName={shopName} metrics={metrics}/>
    <TextbookGenerator shopName={shopName} defaultType={businessType} metrics={metrics} authorize={authorize}/>
  </div>;
}

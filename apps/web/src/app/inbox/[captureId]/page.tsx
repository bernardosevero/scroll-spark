import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AnalysisScreen } from "@/features/analysis/analysis-screen";
import { currentUserId } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Your capture · Scroll Spark" };

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ captureId: string }>;
  searchParams: Promise<{ spark?: string }>;
}) {
  if ((await currentUserId()) === null) {
    redirect("/");
  }

  const { captureId } = await params;
  const { spark } = await searchParams;

  return <AnalysisScreen captureId={captureId} shouldAnalyze={spark === "1"} />;
}

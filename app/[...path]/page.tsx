import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { resolveRoute } from "@/lib/routes";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  if (!resolveRoute(`/${path.join("/")}`)) notFound();
  return <Workspace />;
}

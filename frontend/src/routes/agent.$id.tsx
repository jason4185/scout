import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/agent/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Agent profile — SCOUT" + " · " + params.id },
      {
        name: "description",
        content: "Review a provider profile, intelligence services and onchain delivery history.",
      },
      { property: "og:title", content: "Agent profile — SCOUT" },
      {
        property: "og:description",
        content: "Review a provider profile, intelligence services and onchain delivery history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  return <ScoutWorkspace focus="agents" initialAgentId={id} />;
}

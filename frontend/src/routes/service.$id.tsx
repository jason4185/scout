import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/service/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Intelligence service — SCOUT" + " · " + params.id },
      {
        name: "description",
        content: "Review intelligence scope, live pricing and frozen subscriber policies.",
      },
      { property: "og:title", content: "Intelligence service — SCOUT" },
      {
        property: "og:description",
        content: "Review intelligence scope, live pricing and frozen subscriber policies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  return <ScoutWorkspace focus="marketplace" initialServiceId={id} />;
}

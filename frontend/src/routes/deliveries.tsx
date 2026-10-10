import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/deliveries")({
  head: ({ params }) => ({
    meta: [
      { title: "Intelligence deliveries — SCOUT" },
      {
        name: "description",
        content: "Review live criteria-evaluated reports and submit provider deliveries.",
      },
      { property: "og:title", content: "Intelligence deliveries — SCOUT" },
      {
        property: "og:description",
        content: "Review live criteria-evaluated reports and submit provider deliveries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ScoutWorkspace focus="deliveries" />;
}

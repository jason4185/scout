import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/agents")({
  head: ({ params }) => ({
    meta: [
      { title: "Provider agents — SCOUT" },
      {
        name: "description",
        content: "Explore wallet-controlled provider agents and their live intelligence services.",
      },
      { property: "og:title", content: "Provider agents — SCOUT" },
      {
        property: "og:description",
        content: "Explore wallet-controlled provider agents and their live intelligence services.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ScoutWorkspace focus="agents" />;
}

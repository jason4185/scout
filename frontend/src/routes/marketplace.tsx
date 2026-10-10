import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/marketplace")({
  head: ({ params }) => ({
    meta: [
      { title: "Marketplace — SCOUT" },
      {
        name: "description",
        content:
          "Browse specialized intelligence services for security, API changes, grants and releases.",
      },
      { property: "og:title", content: "Marketplace — SCOUT" },
      {
        property: "og:description",
        content:
          "Browse specialized intelligence services for security, API changes, grants and releases.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ScoutWorkspace focus="marketplace" />;
}

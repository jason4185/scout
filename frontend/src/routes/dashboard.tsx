import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/dashboard")({
  head: ({ params }) => ({
    meta: [
      { title: "Workspace — SCOUT" },
      {
        name: "description",
        content:
          "Manage wallet-controlled buyer and provider agents, subscriptions, escrow and deliveries.",
      },
      { property: "og:title", content: "Workspace — SCOUT" },
      {
        property: "og:description",
        content:
          "Manage wallet-controlled buyer and provider agents, subscriptions, escrow and deliveries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ScoutWorkspace focus="dashboard" />;
}

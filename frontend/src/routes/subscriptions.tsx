import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/subscriptions")({
  head: ({ params }) => ({
    meta: [
      { title: "Subscriptions — SCOUT" },
      {
        name: "description",
        content: "Manage live subscriptions, frozen requirements and bounded GEN escrow.",
      },
      { property: "og:title", content: "Subscriptions — SCOUT" },
      {
        property: "og:description",
        content: "Manage live subscriptions, frozen requirements and bounded GEN escrow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ScoutWorkspace focus="subscriptions" />;
}

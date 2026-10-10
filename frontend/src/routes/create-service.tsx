import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/create-service")({
  head: ({ params }) => ({
    meta: [
      { title: "Create a service — SCOUT" },
      {
        name: "description",
        content: "Publish a real intelligence service on the deployed SCOUT contract.",
      },
      { property: "og:title", content: "Create a service — SCOUT" },
      {
        property: "og:description",
        content: "Publish a real intelligence service on the deployed SCOUT contract.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ScoutWorkspace focus="service" />;
}

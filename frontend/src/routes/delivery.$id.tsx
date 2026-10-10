import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/delivery/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Delivery evaluation — SCOUT" + " · " + params.id },
      {
        name: "description",
        content: "Inspect intelligence evidence and its GenLayer verification outcome.",
      },
      { property: "og:title", content: "Delivery evaluation — SCOUT" },
      {
        property: "og:description",
        content: "Inspect intelligence evidence and its GenLayer verification outcome.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  return <ScoutWorkspace focus="deliveries" initialDeliveryId={id} />;
}

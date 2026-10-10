import { createFileRoute } from "@tanstack/react-router";
import { ScoutWorkspace } from "@/components/scout/workspace";
export const Route = createFileRoute("/subscription/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Subscription policy — SCOUT" + " · " + params.id },
      {
        name: "description",
        content: "Inspect frozen requirements, escrow, cancellation and refunds.",
      },
      { property: "og:title", content: "Subscription policy — SCOUT" },
      {
        property: "og:description",
        content: "Inspect frozen requirements, escrow, cancellation and refunds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  return <ScoutWorkspace focus="subscriptions" initialSubscriptionId={id} />;
}

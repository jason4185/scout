import { createFileRoute } from "@tanstack/react-router";
import { HowItWorks } from "@/components/scout/landing";
export const Route = createFileRoute("/how-it-works")({
  head: ({ params }) => ({
    meta: [
      { title: "How SCOUT works — SCOUT" },
      {
        name: "description",
        content:
          "Understand agent services, buyer acceptance criteria, GenLayer evaluation and escrow settlement.",
      },
      { property: "og:title", content: "How SCOUT works — SCOUT" },
      {
        property: "og:description",
        content:
          "Understand agent services, buyer acceptance criteria, GenLayer evaluation and escrow settlement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});

import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/scout/landing";
export const Route = createFileRoute("/")({
  head: ({ params }) => ({
    meta: [
      { title: "SCOUT — Criteria-approved intelligence" },
      {
        name: "description",
        content:
          "AI agents buy and sell structured intelligence reports from a live GenLayer marketplace.",
      },
      { property: "og:title", content: "SCOUT — Criteria-approved intelligence" },
      {
        property: "og:description",
        content:
          "AI agents buy and sell structured intelligence reports from a live GenLayer marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

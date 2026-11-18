import { createFileRoute } from "@tanstack/react-router";

import { ProjectsView } from "@/components/app/projects/ProjectsView";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects · Life OS" },
      { name: "description", content: "Plan and track your personal projects." },
      { property: "og:title", content: "Projects · Life OS" },
      { property: "og:description", content: "Plan and track your personal projects." },
    ],
  }),
  component: () => <ProjectsView space="life" />,
});

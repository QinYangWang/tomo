import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider as AriaRouter } from "react-aria-components";
import { Root } from "./App.tsx";
import "./app.css";
import { qc } from "./queries.ts";
import { AccountPage, SettingsPage, SettingsRoot } from "./settings/Settings.tsx";
import { ShellProvider } from "./store.tsx";
import { ChatView } from "./views/Chat.tsx";
import { HomeView } from "./views/Home.tsx";
import { ProjectsView } from "./views/Projects.tsx";

const root = createRootRoute({ component: Root });
const routes = [
  createRoute({ getParentRoute: () => root, path: "/", component: HomeView }),
  createRoute({
    getParentRoute: () => root,
    path: "/chat",
    validateSearch: (s: Record<string, unknown>): { c?: string } => (typeof s.c === "string" && s.c !== "home" ? { c: s.c } : {}),
    component: function Chat() {
      const { c } = chat.useSearch();
      return <ChatView key={c ?? "home"} c={c} />;
    },
  }),
  createRoute({ getParentRoute: () => root, path: "/projects", component: () => <ProjectsView /> }),
  createRoute({ getParentRoute: () => root, path: "/projects/$id", component: function P() { return <ProjectsView id={project.useParams().id} />; } }),
  createRoute({ getParentRoute: () => root, path: "/settings", component: SettingsRoot }),
  createRoute({ getParentRoute: () => root, path: "/settings/$page", component: function S() { return <SettingsPage page={page.useParams().page} />; } }),
  createRoute({ getParentRoute: () => root, path: "/settings/accounts/$account", component: function A() { return <AccountPage account={account.useParams().account} />; } }),
] as const;
const [, chat, , project, , page, account] = routes;
const router = createRouter({ routeTree: root.addChildren([...routes]), defaultPreload: false });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ShellProvider>
        <AriaRouter navigate={(to) => router.navigate({ to: to as string })}>
          <RouterProvider router={router} />
        </AriaRouter>
      </ShellProvider>
    </QueryClientProvider>
  </StrictMode>,
);

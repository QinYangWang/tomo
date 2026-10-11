import { useQuery, QueryClient } from "@tanstack/react-query";
import { api, enc } from "./api.ts";
import type { Conversation, Memory, Panel, Project, Schedule, Settings, Skill } from "./types.ts";

export const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: false } } });

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/api/settings") });
export const useSchedules = () => useQuery({ queryKey: ["schedules"], queryFn: () => api<Schedule[]>("/api/schedules") });
export const useSkills = () => useQuery({ queryKey: ["skills"], queryFn: () => api<Skill[]>("/api/skills") });
export const useConversations = () => useQuery({ queryKey: ["conversations"], queryFn: () => api<Conversation[]>("/api/conversations") });
export const useMemories = (q = "", scope = "") =>
  useQuery({
    queryKey: ["memories", scope, q],
    queryFn: () => api<Memory[]>(`/api/memories?${new URLSearchParams({ ...(q && { q }), ...(scope && { scope }) })}`),
    placeholderData: (prev) => prev,
  });
// Panels poll while Tomo is building one.
export const usePanels = () =>
  useQuery({ queryKey: ["panels"], queryFn: () => api<Panel[]>("/api/panels"), refetchInterval: (q) => (q.state.data?.some((p) => p.status === "building") ? 3000 : false) });
export const useProjects = () => useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/api/projects") });
export const useProject = (id?: string) =>
  useQuery({ queryKey: ["project", id], queryFn: () => api<Project>(`/api/projects/${enc(id!)}`), enabled: !!id });
export const useModels = (provider: string) =>
  useQuery({ queryKey: ["models", provider], queryFn: () => api<{ id: string; name: string }[]>(`/api/settings/models?provider=${enc(provider)}`), enabled: !!provider, staleTime: Infinity });

export const invalidate = (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
export const hasKey = (s?: Settings) => !!s?.providers.some((p) => p.key.set || p.fromEnv);

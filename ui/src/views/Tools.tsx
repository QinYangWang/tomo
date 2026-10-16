// The rail's own pages: 定时 (upcoming runs), 记忆 (a searchable list), 技能 (a card grid).
import { useEffect, useState } from "react";
import { BoltIcon, CalendarDaysIcon, LightbulbIcon, SearchIcon } from "@/components/icons";
import { Button } from "@/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "@/ui/empty-state";
import { IconChip } from "@/ui/icon-chip";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/ui/input-group";
import { SettingsGroup, SettingsRow, SettingsRowControl, SettingsRowDescription, SettingsRowText, SettingsRowTitle } from "@/ui/settings-section";
import { api, enc } from "../api.ts";
import { Head, Page } from "../components/parts.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { ago, when } from "../lib.ts";
import { invalidate, useMemories, useSchedules, useSkills } from "../queries.ts";
import { TOOLS } from "../settings/shared.ts";
import { toast } from "../store.tsx";

const ToolHead = ({ k }: { k: keyof typeof TOOLS }) => <Head title={TOOLS[k]![0]} desc={TOOLS[k]![2]} />;

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <EmptyState variant="outline" size="lg">
      <EmptyStateIcon>{icon}</EmptyStateIcon>
      <EmptyStateTitle>{title}</EmptyStateTitle>
      <EmptyStateDescription>{sub}</EmptyStateDescription>
    </EmptyState>
  );
}

const KIND: Record<string, string> = { once: "一次", interval: "重复", daily: "每天", cron: "重复" };
export function SchedulesView() {
  const list = useSchedules().data;
  return (
    <>
      <TopBar title="定时" />
      <Page narrow id="v-tool">
        <ToolHead k="schedules" />
        {list && (list.length ? (
          <SettingsGroup id="schedules">
            {list.map((s) => (
              <SettingsRow key={s.id} data-schedule={s.id}>
                <SettingsRowText>
                  <SettingsRowTitle>{s.title}</SettingsRowTitle>
                  <SettingsRowDescription className="tabular-nums">{s.next_run ? when(s.next_run) : "已结束"} · {KIND[s.kind] ?? "重复"}</SettingsRowDescription>
                </SettingsRowText>
                <SettingsRowControl>
                  <Button variant="ghost" size="sm" onClick={async () => { await api(`/api/schedules/${enc(s.id)}`, { method: "DELETE" }); toast("已删除"); invalidate("schedules"); }}>删除</Button>
                </SettingsRowControl>
              </SettingsRow>
            ))}
          </SettingsGroup>
        ) : <Empty icon={<CalendarDaysIcon />} title="还没有定时" sub="在对话里说「每天 8 点提醒我…」" />)}
      </Page>
    </>
  );
}

export function MemoryView() {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const list = useMemories(dq).data;
  return (
    <>
      <TopBar title="记忆" />
      <Page narrow id="v-tool">
        <ToolHead k="memory" />
        <InputGroup>
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput id="memSearch" placeholder="搜索" aria-label="搜索记忆" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
        {list && (list.length ? (
          <SettingsGroup id="memList">
            {list.map((m) => (
              <SettingsRow key={m.id} data-memory={m.id}>
                <SettingsRowText>
                  <SettingsRowTitle className="font-normal">{m.content}</SettingsRowTitle>
                  <SettingsRowDescription>{m.confidence === "inferred" ? "猜的" : "你说的"} · {ago(m.updated_at)}</SettingsRowDescription>
                </SettingsRowText>
                <SettingsRowControl>
                  <Button variant="ghost" size="sm" onClick={async () => { await api(`/api/memories/${m.id}`, { method: "DELETE" }); toast("已忘掉"); invalidate("memories"); }}>忘掉</Button>
                </SettingsRowControl>
              </SettingsRow>
            ))}
          </SettingsGroup>
        ) : dq ? <EmptyState size="sm"><EmptyStateDescription>没找到</EmptyStateDescription></EmptyState> : <Empty icon={<LightbulbIcon />} title="还没有记忆" sub="聊得越多，Tomo 越懂你" />)}
      </Page>
    </>
  );
}

export function SkillsView() {
  const sk = useSkills().data;
  return (
    <>
      <TopBar title="技能" />
      <Page id="v-tool">
        <ToolHead k="skills" />
        {sk && (sk.length ? (
          <div id="skills" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sk.map((s) => (
              <Card key={s.name} data-skill={s.name}>
                <CardHeader>
                  <IconChip tone="primary"><BoltIcon /></IconChip>
                  <CardTitle>{s.name}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : <Empty icon={<BoltIcon />} title="还没有技能" sub="常做的事，Tomo 会自己学会" />)}
      </Page>
    </>
  );
}

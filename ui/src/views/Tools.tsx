// The rail's own pages: 定时 (a timeline), 记忆 (a searchable list), 技能 (a card grid). Each has its own layout.
import { Btn, Input } from "../components/kit.tsx";
import { useEffect, useState } from "react";
import { api, enc } from "../api.ts";
import { TopBar } from "../components/TopBar.tsx";
import { Empty, Grow, Group, Page, PageHead, Row, Sub } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { ago, when } from "../lib.ts";
import { invalidate, useMemories, useSchedules, useSkills } from "../queries.ts";
import { TOOLS } from "../settings/shared.ts";
import { toast } from "../store.tsx";

function Head({ k }: { k: keyof typeof TOOLS }) {
  const [name, , desc] = TOOLS[k]!;
  return <PageHead title={name} desc={desc} />;
}

const KIND: Record<string, string> = { once: "一次", interval: "重复", daily: "每天", cron: "重复" };
export function SchedulesView() {
  const list = useSchedules().data;
  return (
    <>
      <TopBar title="定时" />
      <Page narrow id="v-tool">
        <Head k="schedules" />
        {list && (list.length ? (
          <ol className="timeline relative ml-2 flex flex-col gap-2 border-l border-border-strong pl-6">
            {list.map((s) => (
              <li key={s.id} className="tlRow relative flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="absolute top-1/2 -left-[31px] size-2.5 -translate-y-1/2 rounded-full bg-primary ring-4 ring-background" />
                <span className="tlWhen w-28 shrink-0 text-sm font-medium tabular-nums">{s.next_run ? when(s.next_run) : "已结束"}</span>
                <span className="tlBody flex min-w-0 flex-1 flex-col"><b className="truncate text-sm font-medium">{s.title}</b><span className="text-xs text-muted-foreground">{KIND[s.kind] ?? "重复"}</span></span>
                <Btn kind="danger" onClick={async () => { await api(`/api/schedules/${enc(s.id)}`, { method: "DELETE" }); toast("已删除"); invalidate("schedules"); }}>删除</Btn>
              </li>
            ))}
          </ol>
        ) : <Empty icon="clock" title="还没有定时" sub="在对话里说「每天 8 点提醒我…」" />)}
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
        <Head k="memory" />
        <Input className="searchBox mb-4" placeholder="搜索" value={q} onChange={setQ} leftIcon={<Icon name="search" size={16} />} classNames={{ field: "bg-card", input: "pl-9" }} />
        {list && (list.length ? (
          <Group className="memList">
            {list.map((m) => (
              <Row key={m.id}>
                <Grow>{m.content}<Sub>{m.confidence === "inferred" ? "猜的" : "你说的"} · {ago(m.updated_at)}</Sub></Grow>
                <Btn kind="danger" onClick={async () => { await api(`/api/memories/${m.id}`, { method: "DELETE" }); toast("已忘掉"); invalidate("memories"); }}>忘掉</Btn>
              </Row>
            ))}
          </Group>
        ) : dq ? <div className="empty py-10 text-center text-sm text-muted-foreground">没找到</div> : <Empty icon="brain" title="还没有记忆" sub="聊得越多，Tomo 越懂你" />)}
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
        <Head k="skills" />
        {sk && (sk.length ? (
          <div className="skillGrid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sk.map((s) => (
              <div key={s.name} className="skill flex flex-col gap-2 rounded-3xl border border-border bg-card p-5">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon name="skill" size={18} /></span>
                <b className="text-sm font-semibold">{s.name}</b><span className="text-sm leading-6 text-muted-foreground">{s.description}</span>
              </div>
            ))}
          </div>
        ) : <Empty icon="skill" title="还没有技能" sub="常做的事，Tomo 会自己学会" />)}
      </Page>
    </>
  );
}

// The rail's own pages: 定时 (a timeline), 记忆 (a searchable list), 技能 (a card grid). Each has its own layout.
import { useEffect, useState } from "react";
import { api, enc } from "../api.ts";
import { TopBar } from "../components/TopBar.tsx";
import { Icon } from "../icons.tsx";
import { ago, when } from "../lib.ts";
import { invalidate, useMemories, useSchedules, useSkills } from "../queries.ts";
import { TOOLS } from "../settings/shared.ts";
import { toast } from "../store.tsx";

function Head({ k }: { k: keyof typeof TOOLS }) {
  const [name, , desc] = TOOLS[k]!;
  return <header className="toolHead"><h1 className="serif">{name}</h1><p>{desc}</p></header>;
}

const KIND: Record<string, string> = { once: "一次", interval: "重复", daily: "每天", cron: "重复" };
export function SchedulesView() {
  const list = useSchedules().data;
  return (
    <>
      <TopBar title="定时" />
      <div className="scroll"><div className="page narrow" id="v-tool">
        <Head k="schedules" />
        {list && (list.length ? (
          <div className="timeline">
            {list.map((s) => (
              <div key={s.id} className="tlRow">
                <span className="tlWhen">{s.next_run ? when(s.next_run) : "已结束"}</span>
                <span className="tlBody"><b>{s.title}</b><span className="muted small">{KIND[s.kind] ?? "重复"}</span></span>
                <button className="dangerBtn" onClick={async () => { await api(`/api/schedules/${enc(s.id)}`, { method: "DELETE" }); toast("已删除"); invalidate("schedules"); }}>删除</button>
              </div>
            ))}
          </div>
        ) : <div className="toolEmpty"><Icon name="clock" size={28} /><b>还没有定时</b><span>在对话里说「每天 8 点提醒我…」</span></div>)}
      </div></div>
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
      <div className="scroll"><div className="page narrow" id="v-tool">
        <Head k="memory" />
        <input className="searchBox" placeholder="搜索" value={q} onChange={(e) => setQ(e.target.value)} />
        {list && (list.length ? (
          <div className="group memList">
            {list.map((m) => (
              <div key={m.id} className="item">
                <span className="grow">{m.content}<div className="muted small">{m.confidence === "inferred" ? "猜的" : "你说的"} · {ago(m.updated_at)}</div></span>
                <button className="dangerBtn" onClick={async () => { await api(`/api/memories/${m.id}`, { method: "DELETE" }); toast("已忘掉"); invalidate("memories"); }}>忘掉</button>
              </div>
            ))}
          </div>
        ) : dq ? <div className="empty">没找到</div> : <div className="toolEmpty"><Icon name="brain" size={28} /><b>还没有记忆</b><span>聊得越多，Tomo 越懂你</span></div>)}
      </div></div>
    </>
  );
}

export function SkillsView() {
  const sk = useSkills().data;
  return (
    <>
      <TopBar title="技能" />
      <div className="scroll"><div className="page" id="v-tool">
        <Head k="skills" />
        {sk && (sk.length ? (
          <div className="skillGrid">
            {sk.map((s) => <div key={s.name} className="skill"><Icon name="skill" size={18} /><b>{s.name}</b><span>{s.description}</span></div>)}
          </div>
        ) : <div className="toolEmpty"><Icon name="skill" size={28} /><b>还没有技能</b><span>常做的事，Tomo 会自己学会</span></div>)}
      </div></div>
    </>
  );
}

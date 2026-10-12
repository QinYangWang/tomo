// First-run guide: who you are, then an AI provider. Both steps can be skipped; settings has the rest.
import { Btn, Input } from "../components/kit.tsx";
import { useState } from "react";
import { api } from "../api.ts";
import { Icon } from "../icons.tsx";
import { Group, KV } from "../components/ui.tsx";
import { cn } from "@/lib/utils";
import { invalidate } from "../queries.ts";
import type { Settings } from "../types.ts";
import { ready, testProvider, useProviderAsDefault } from "./shared.ts";

// On OpenRouter, start people on a free model that handles tools well, else any free one.
const FREE_PICKS = [/nemotron-3-super.*:free$/, /gemma-4-31b.*:free$/, /:free$/];
const prefer = (id: string) => {
  if (id !== "openrouter") return undefined;
  return (m: { id: string }, list?: { id: string }[]) => FREE_PICKS.find((re) => list?.some((x) => re.test(x.id)))?.test(m.id) ?? false;
};

export function Onboarding({ S, onDone }: { S: Settings; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const P = S.profile ?? {};
  const [f, setF] = useState({ nickname: P.nickname ?? "", name: P.name ?? "", work: P.work ?? "" });
  const [pick, setPick] = useState(S.providers.find(ready)?.id ?? S.providers[0]!.id);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<{ text: string; ok: boolean } | null>(null);
  const p = S.providers.find((x) => x.id === pick)!;
  const finish = async () => {
    await api("/api/settings/onboarded", { method: "PUT", body: { done: true } });
    await invalidate("settings");
    onDone();
  };
  const dots = <div className="obDots flex justify-center gap-1.5">{[0, 1].map((i) => <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "on w-5 bg-foreground" : "w-1.5 bg-foreground/20")} />)}</div>;
  if (step === 0)
    return (
      <div id="onboard" className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-brand-bg p-5">
        <div className="obCard flex w-full max-w-md flex-col gap-3 rounded-[28px] border border-border bg-background/80 p-7 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.25)] backdrop-blur-xl">
          {dots}
          <span className="obIcon mx-auto mt-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon name="user" size={26} /></span>
          <h1 className="text-center text-2xl font-semibold tracking-tight">先认识一下</h1>
          <p className="mb-2 text-center text-sm text-muted-foreground">Tomo 会这样称呼你</p>
          <Group className="mb-2">
            {([["nickname", "称呼", "Tomo 怎么叫你"], ["name", "姓名", "你的名字"], ["work", "工作", "职位和公司"]] as const).map(([k, l, ph], i) => (
              <KV key={k} label={l} id={`ob-${k}`} autoFocus={i === 0} value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            ))}
          </Group>
          <Btn big id="obNext" onClick={async () => { await api("/api/settings/profile", { method: "PUT", body: f }); setStep(1); }}>下一步</Btn>
          <Btn kind="link" onClick={() => setStep(1)}>跳过</Btn>
        </div>
      </div>
    );
  const go = async () => {
    if (!key.trim() && !ready(p)) return setM({ text: "先粘贴密钥", ok: false });
    setBusy(true);
    if (key.trim()) {
      const r = await api(`/api/settings/providers/${pick}`, { method: "PUT", body: { key: key.trim() } });
      if (r.error) return setBusy(false), setM({ text: r.error, ok: false });
    }
    if (S.model.provider !== pick || key.trim()) await useProviderAsDefault(pick, prefer(pick));
    setM({ text: "测试中…", ok: true });
    const t = await testProvider(pick);
    setBusy(false);
    if (!t.ok) return setM({ text: t.error ?? "失败", ok: false });
    setM({ text: `能用了 ✓ ${t.model}`, ok: true });
    setTimeout(finish, 700);
  };
  return (
    <div id="onboard" className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-brand-bg p-5">
      <div className="obCard flex w-full max-w-md flex-col gap-3 rounded-[28px] border border-border bg-background/80 p-7 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.25)] backdrop-blur-xl">
        {dots}
        <span className="obIcon mx-auto mt-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon name="ai" size={26} /></span>
        <h1 className="text-center text-2xl font-semibold tracking-tight">选一个 AI 模型</h1>
        <p className="mb-2 text-center text-sm text-muted-foreground">选一家，粘贴密钥（API Key）</p>
        <div className="provGrid grid grid-cols-2 gap-2">
          {S.providers.map((x) => (
            <button
              key={x.id} type="button" data-pv={x.id} onClick={() => (setPick(x.id), setM(null))}
              className={cn("flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors", x.id === pick ? "on border-primary bg-primary/[0.06] text-foreground ring-1 ring-primary" : "border-border bg-card hover:border-border-strong")}
            >{x.label}{ready(x) && <span className="text-success"><Icon name="tick" size={14} /></span>}</button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Input type="password" id="obKey" autoComplete="off" value={key} onChange={setKey} classNames={{ field: "bg-background" }} placeholder={ready(p) ? "已保存，可直接完成" : `${p.label} 的密钥`} />
          <span className="px-1 text-xs text-muted-foreground">{p.hint}</span>
        </div>
        {m && <span className={cn("msg px-1 text-xs", m.ok ? "ok text-success" : "err text-destructive")}>{m.text}</span>}
        <Btn big id="obGo" disabled={busy} onClick={go}>{ready(p) && S.model.provider === pick && !key ? "完成" : "保存并试用"}</Btn>
        <Btn kind="link" id="obSkip" onClick={finish}>以后再说</Btn>
      </div>
    </div>
  );
}

// First-run guide: who you are, then an AI provider. Both steps can be skipped; settings has the rest.
import { Btn, Input } from "../components/kit.tsx";
import { useState } from "react";
import { api } from "../api.ts";
import { Icon } from "../icons.tsx";
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
  const dots = <div className="obDots">{[0, 1].map((i) => <span key={i} className={i === step ? "on" : ""} />)}</div>;
  if (step === 0)
    return (
      <div id="onboard">
        <div className="obCard">
          {dots}
          <span className="obIcon"><Icon name="user" size={26} /></span>
          <h1 className="serif">先认识一下</h1>
          <p className="muted">Tomo 会这样称呼你</p>
          <div className="group">
            {([["nickname", "称呼", "Tomo 怎么叫你"], ["name", "姓名", "你的名字"], ["work", "工作", "职位和公司"]] as const).map(([k, l, ph], i) => (
              <label key={k} className="item kv"><span className="k">{l}</span><input id={`ob-${k}`} autoFocus={i === 0} value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
            ))}
          </div>
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
    <div id="onboard">
      <div className="obCard">
        {dots}
        <span className="obIcon"><Icon name="ai" size={26} /></span>
        <h1 className="serif">选一个 AI 模型</h1>
        <p className="muted">选一家，粘贴密钥（API Key）</p>
        <div className="provGrid">
          {S.providers.map((x) => (
            <button key={x.id} data-pv={x.id} className={x.id === pick ? "on" : ""} onClick={() => (setPick(x.id), setM(null))}>{x.label}{ready(x) && <Icon name="tick" size={14} />}</button>
          ))}
        </div>
        <div className="group">
          <div className="field">
            <Input type="password" id="obKey" autoComplete="off" value={key} onChange={setKey} classNames={{ field: "bg-card" }} placeholder={ready(p) ? "已保存，可直接完成" : `${p.label} 的密钥`} />
            <span className="muted small">{p.hint}</span>
          </div>
        </div>
        {m && <span className={`msg ${m.ok ? "ok" : "err"}`}>{m.text}</span>}
        <Btn big id="obGo" disabled={busy} onClick={go}>{ready(p) && S.model.provider === pick && !key ? "完成" : "保存并试用"}</Btn>
        <Btn kind="link" id="obSkip" onClick={finish}>以后再说</Btn>
      </div>
    </div>
  );
}

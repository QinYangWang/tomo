// First-run guide: who you are, then an AI provider. Both steps can be skipped; settings has the rest.
import { useState } from "react";
import { BotIcon, CheckIcon, UserIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/ui/card";
import { Field, FieldDescription } from "@/ui/field";
import { IconChip } from "@/ui/icon-chip";
import { Input } from "@/ui/input";
import { PasswordInput } from "@/ui/password-input";
import { SettingsGroup, SettingsRow, SettingsRowControl, SettingsRowText, SettingsRowTitle } from "@/ui/settings-section";
import { api } from "../api.ts";
import { Msg, type Flash } from "../components/parts.tsx";
import { invalidate } from "../queries.ts";
import type { Settings } from "../types.ts";
import { ready, testProvider, useProviderAsDefault } from "./shared.ts";

// On OpenRouter, start people on a free model that handles tools well, else any free one.
const FREE_PICKS = [/nemotron-3-super.*:free$/, /gemma-4-31b.*:free$/, /:free$/];
const prefer = (id: string) => {
  if (id !== "openrouter") return undefined;
  return (m: { id: string }, list?: { id: string }[]) => FREE_PICKS.find((re) => list?.some((x) => re.test(x.id)))?.test(m.id) ?? false;
};

/** Two dots: which step of the guide this is. */
const Dots = ({ step }: { step: number }) => (
  <div className="flex justify-center gap-1.5" aria-label={`第 ${step + 1} 步，共 2 步`}>
    {[0, 1].map((i) => <span key={i} className={cn("h-1.5 rounded-full transition-[width,background-color] duration-200", i === step ? "w-5 bg-foreground" : "w-1.5 bg-foreground/16")} />)}
  </div>
);

function Frame({ step, icon, title, desc, children, footer }: { step: number; icon: React.ReactNode; title: string; desc: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div id="onboard" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-shell p-5">
      <Card size="lg" className="obCard w-full max-w-md">
        <CardHeader className="justify-items-center text-center">
          <Dots step={step} />
          <IconChip tone="primary" size="xl" className="mt-3">{icon}</IconChip>
          <CardTitle className="mt-2 text-2xl tracking-tight">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">{children}</CardContent>
        <CardFooter className="flex-col">{footer}</CardFooter>
      </Card>
    </div>
  );
}

export function Onboarding({ S, onDone }: { S: Settings; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const P = S.profile ?? {};
  const [f, setF] = useState({ nickname: P.nickname ?? "", name: P.name ?? "", work: P.work ?? "" });
  const [pick, setPick] = useState(S.providers.find(ready)?.id ?? S.providers[0]!.id);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<Flash>(null);
  const p = S.providers.find((x) => x.id === pick)!;
  const finish = async () => {
    await api("/api/settings/onboarded", { method: "PUT", body: { done: true } });
    await invalidate("settings");
    onDone();
  };
  if (step === 0)
    return (
      <Frame
        step={0} icon={<UserIcon />} title="先认识一下" desc="Tomo 会这样称呼你"
        footer={<>
          <Button id="obNext" size="lg" className="w-full" onClick={async () => { await api("/api/settings/profile", { method: "PUT", body: f }); setStep(1); }}>下一步</Button>
          <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>跳过</Button>
        </>}
      >
        <SettingsGroup>
          {([["nickname", "称呼", "Tomo 怎么叫你"], ["name", "姓名", "你的名字"], ["work", "工作", "职位和公司"]] as const).map(([k, l, ph], i) => (
            <SettingsRow key={k} className="flex-nowrap">
              <SettingsRowText className="basis-12"><SettingsRowTitle>{l}</SettingsRowTitle></SettingsRowText>
              <SettingsRowControl className="flex-1"><Input id={`ob-${k}`} aria-label={l} autoFocus={i === 0} value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></SettingsRowControl>
            </SettingsRow>
          ))}
        </SettingsGroup>
      </Frame>
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
    <Frame
      step={1} icon={<BotIcon />} title="选一个 AI 模型" desc="选一家，粘贴密钥（API Key）"
      footer={<>
        <Button id="obGo" size="lg" className="w-full" disabled={busy} onClick={go}>{ready(p) && S.model.provider === pick && !key ? "完成" : "保存并试用"}</Button>
        <Button id="obSkip" variant="ghost" className="w-full" onClick={finish}>以后再说</Button>
      </>}
    >
      <div className="provGrid grid grid-cols-2 gap-2" role="radiogroup" aria-label="服务商">
        {S.providers.map((x) => (
          <Button
            key={x.id} data-pv={x.id} role="radio" aria-checked={x.id === pick} variant={x.id === pick ? "secondary" : "outline"} className="justify-between"
            onClick={() => (setPick(x.id), setM(null))}
          >{x.label}{ready(x) && <CheckIcon className="text-success" />}</Button>
        ))}
      </div>
      <Field>
        <PasswordInput id="obKey" autoComplete="off" aria-label="密钥" value={key} onChange={(e) => setKey(e.target.value)} placeholder={ready(p) ? "已保存，可直接完成" : `${p.label} 的密钥`} />
        <FieldDescription>{p.hint}</FieldDescription>
      </Field>
      <Msg m={m} />
    </Frame>
  );
}

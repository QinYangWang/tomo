// First run sets the password; afterwards this is the sign-in screen.
import { Btn, Input } from "./kit.tsx";
import { useState, type FormEvent } from "react";
import { session } from "../api.ts";

export function Gate({ setup, onDone }: { setup: boolean; onDone: (firstRun: boolean) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (setup && pw !== pw2) return setErr("两次不一样");
    const r = await (await fetch(setup ? "/api/auth/setup" : "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) })).json();
    if (!r.token) return setErr(r.error === "wrong password" ? "密码不对" : r.error);
    session.set(r.token);
    onDone(setup);
  };
  return (
    <div id="gate" className="grid min-h-dvh place-items-center bg-brand-bg px-5">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 rounded-[28px] border border-border bg-background/70 p-8 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.25)] backdrop-blur-xl">
        <div className="mark mx-auto mb-2 grid size-14 place-items-center rounded-2xl bg-foreground text-2xl font-semibold text-background">T</div>
        <h1 className="text-center text-2xl font-semibold tracking-tight">{setup ? "欢迎使用 Tomo" : "Tomo"}</h1>
        <p className="mb-3 text-center text-sm text-muted-foreground">{setup ? "先设一个登录密码" : "输入密码"}</p>
        <Input id="pw" type="password" placeholder="密码" autoFocus value={pw} onChange={setPw} classNames={{ field: "bg-background" }} />
        {setup && <Input type="password" placeholder="再输一次" value={pw2} onChange={setPw2} classNames={{ field: "bg-background" }} />}
        <p className="err min-h-5 px-1 text-xs text-destructive">{err}</p>
        <Btn type="submit" id="gateBtn" className="w-full" size="lg">{setup ? "开始" : "登录"}</Btn>
      </form>
    </div>
  );
}

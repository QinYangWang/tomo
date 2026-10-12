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
    <div id="gate">
      <form onSubmit={submit}>
        <div className="mark">T</div>
        <h1 className="serif">{setup ? "欢迎使用 Tomo" : "Tomo"}</h1>
        <p className="muted">{setup ? "先设一个登录密码" : "输入密码"}</p>
        <Input id="pw" type="password" placeholder="密码" autoFocus value={pw} onChange={setPw} classNames={{ field: "bg-card" }} />
        {setup && <Input type="password" placeholder="再输一次" value={pw2} onChange={setPw2} classNames={{ field: "bg-card" }} />}
        <p className="err">{err}</p>
        <Btn type="submit" id="gateBtn" className="w-full">{setup ? "开始" : "登录"}</Btn>
      </form>
    </div>
  );
}

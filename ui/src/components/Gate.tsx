// First run sets the password; afterwards this is the sign-in screen.
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
        <input id="pw" type="password" placeholder="密码" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        {setup && <input type="password" placeholder="再输一次" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
        <p className="err">{err}</p>
        <button className="primary" id="gateBtn">{setup ? "开始" : "登录"}</button>
      </form>
    </div>
  );
}

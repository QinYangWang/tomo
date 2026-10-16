// First run sets the password; afterwards this is the sign-in screen.
import { useState, type FormEvent } from "react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Field, FieldError, FieldGroup } from "@/ui/field";
import { IconChip } from "@/ui/icon-chip";
import { PasswordInput } from "@/ui/password-input";
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
    <div id="gate" className="grid min-h-dvh place-items-center bg-shell px-5">
      <Card size="lg" className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <IconChip tone="solid" size="xl"><span className="text-xl font-semibold">T</span></IconChip>
          <CardTitle className="mt-2 text-2xl tracking-tight">{setup ? "欢迎使用 Tomo" : "Tomo"}</CardTitle>
          <CardDescription>{setup ? "先设一个登录密码" : "输入密码"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field invalid={!!err}>
                <PasswordInput id="pw" placeholder="密码" aria-label="密码" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
                {!setup && <FieldError>{err}</FieldError>}
              </Field>
              {setup && (
                <Field invalid={!!err}>
                  <PasswordInput placeholder="再输一次" aria-label="再输一次" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                  <FieldError>{err}</FieldError>
                </Field>
              )}
              <Button type="submit" id="gateBtn" size="lg" className="w-full">{setup ? "开始" : "登录"}</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

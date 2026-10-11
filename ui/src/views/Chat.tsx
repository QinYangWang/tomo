// The owner's chats: Home (all platform DMs) plus each bound group/channel.
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { ChatPane } from "../components/ChatPane.tsx";
import { Sheet } from "../components/Sheet.tsx";
import { Icon } from "../icons.tsx";
import { useConversations } from "../queries.ts";
import { useShell } from "../store.tsx";

export function ChatView({ c = "home" }: { c?: string }) {
  const convs = useConversations().data ?? [];
  const nav = useNavigate();
  const { setChat } = useShell();
  const [pick, setPick] = useState(false);
  const label = (() => {
    const x = convs.find((v) => v.id === c || (c === "home" && v.key === "home"));
    return x && x.key !== "home" ? x.key : "Home";
  })();
  useEffect(() => setChat({ conv: c, label }), [c, label]);
  const single = convs.length <= 1;
  return (
    <>
      <div className="convbar">
        <Button className={`pill ${single ? "single" : ""}`} isDisabled={single} onPress={() => setPick(true)}>
          <span>{label}</span>
          <span className="chev"><Icon name="right" size={14} /></span>
        </Button>
      </div>
      <ChatPane
        conv={c}
        placeholder="给 Tomo 发消息"
        empty={<div className="empty">这是你和 Tomo 的 Home 对话。<br />在 Telegram、Discord、Slack 私聊它，也会出现在这里。</div>}
      />
      <Sheet open={pick} onClose={() => setPick(false)} title="切换对话" small>
        <div className="group">
          {convs.map((v) => {
            const id = v.key === "home" ? "home" : v.id;
            return (
              <button key={id} className="item" onClick={() => (setPick(false), nav({ to: "/chat", search: { c: id } }))}>
                <Icon name={v.key === "home" ? "home" : "chat"} size={18} />
                <span className="grow">{v.key === "home" ? <>Home <span className="muted small">· 所有平台的私聊</span></> : v.key}</span>
                {id === c && <Icon name="tick" size={18} />}
              </button>
            );
          })}
        </div>
        <p className="note">群聊和频道各有自己的对话，线程从频道对话分叉。</p>
      </Sheet>
    </>
  );
}

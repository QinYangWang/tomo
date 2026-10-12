// The owner's chats: Home (all platform DMs) plus each bound group/channel. The sidebar switches between them.
import { useEffect } from "react";
import { ChatPane } from "../components/ChatPane.tsx";
import { IconBtn } from "../components/kit.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { Icon } from "../icons.tsx";
import { useConversations } from "../queries.ts";
import { useShell } from "../store.tsx";

export function ChatView({ c = "home" }: { c?: string }) {
  const convs = useConversations().data ?? [];
  const { setChat, setSearch } = useShell();
  const label = (() => {
    const x = convs.find((v) => v.id === c || (c === "home" && v.key === "home"));
    return x && x.key !== "home" ? x.key : "私聊";
  })();
  useEffect(() => setChat({ conv: c, label }), [c, label]);
  return (
    <>
      <TopBar title={label}>
        <IconBtn icon="search" label="搜索" onClick={() => setSearch({ conv: c, label })} />
      </TopBar>
      <ChatPane
        conv={c}
        placeholder="发消息给 Tomo"
        empty={<div className="projStart"><b>想聊点什么？</b></div>}
      />
    </>
  );
}

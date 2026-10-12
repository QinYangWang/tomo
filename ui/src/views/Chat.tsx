// The owner's chats: Home (all platform DMs) plus each bound group/channel. The sidebar switches between them.
import { useEffect } from "react";
import { Button } from "react-aria-components";
import { ChatPane } from "../components/ChatPane.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { Icon } from "../icons.tsx";
import { useConversations } from "../queries.ts";
import { useShell } from "../store.tsx";

export function ChatView({ c = "home" }: { c?: string }) {
  const convs = useConversations().data ?? [];
  const { setChat, setSearch } = useShell();
  const label = (() => {
    const x = convs.find((v) => v.id === c || (c === "home" && v.key === "home"));
    return x && x.key !== "home" ? x.key : "Home";
  })();
  useEffect(() => setChat({ conv: c, label }), [c, label]);
  return (
    <>
      <TopBar title={label} sub={c === "home" ? "Telegram、Discord、Slack 和网页的私聊都在这里" : undefined}>
        <Button className="icon" aria-label="搜索聊天记录" onPress={() => setSearch({ conv: c, label })}><Icon name="search" size={18} /></Button>
      </TopBar>
      <ChatPane
        conv={c}
        placeholder="给 Tomo 发消息"
        empty={<div className="projStart"><b>今天想做点什么？</b></div>}
      />
    </>
  );
}

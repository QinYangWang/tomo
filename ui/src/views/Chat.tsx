// The owner's chats: Home (all platform DMs) plus each bound group/channel. The sidebar switches between them.
import { useEffect } from "react";
import { SearchIcon } from "@/components/icons";
import { EmptyState, EmptyStateTitle } from "@/ui/empty-state";
import { ChatPane } from "../components/ChatPane.tsx";
import { ToolbarButton } from "../components/parts.tsx";
import { TopBar } from "../components/TopBar.tsx";
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
        <ToolbarButton label="搜索" onClick={() => setSearch({ conv: c, label })}><SearchIcon /></ToolbarButton>
      </TopBar>
      <ChatPane
        conv={c}
        placeholder="发消息给 Tomo"
        empty={<EmptyState size="lg" className="projStart"><EmptyStateTitle>想聊点什么？</EmptyStateTitle></EmptyState>}
      />
    </>
  );
}

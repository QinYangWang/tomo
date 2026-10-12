// Hugeicons (free, stroke rounded). Name → icon, so call sites stay short.
import {
  Add01Icon, AiBrain01Icon, Archive02Icon, ArrowLeft01Icon, ArrowRight01Icon, ArrowUp02Icon, Brain02Icon, BubbleChatIcon, Cancel01Icon,
  CheckmarkCircle02Icon, Clock01Icon, CloudServerIcon, Copy01Icon, DashboardSquareAddIcon, DatabaseRestoreIcon, GitBranchIcon, Delete02Icon, DiscordIcon, Edit02Icon, Folder01Icon, Home01Icon,
  InformationCircleIcon, Link01Icon, Loading03Icon, Logout03Icon, MagicWand01Icon, MoreHorizontalIcon, Plug01Icon, RefreshIcon,
  Search01Icon, Settings01Icon, SidebarLeftIcon, SlackIcon, SparklesIcon, SquareLock02Icon, TelegramIcon, Tick02Icon, UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const ICONS = {
  home: Home01Icon, chat: BubbleChatIcon, projects: Folder01Icon, add: Add01Icon, search: Search01Icon, settings: Settings01Icon,
  sidebar: SidebarLeftIcon, send: ArrowUp02Icon, user: UserCircleIcon, clock: Clock01Icon, plug: Plug01Icon, ai: AiBrain01Icon,
  brain: Brain02Icon, skill: MagicWand01Icon, lock: SquareLock02Icon, info: InformationCircleIcon, logout: Logout03Icon,
  refresh: RefreshIcon, trash: Delete02Icon, edit: Edit02Icon, more: MoreHorizontalIcon, close: Cancel01Icon, back: ArrowLeft01Icon,
  right: ArrowRight01Icon, check: CheckmarkCircle02Icon, tick: Tick02Icon, telegram: TelegramIcon, discord: DiscordIcon,
  slack: SlackIcon, loading: Loading03Icon, dashboard: DashboardSquareAddIcon, link: Link01Icon, archive: Archive02Icon,
  sparkles: SparklesIcon, storage: CloudServerIcon, copy: Copy01Icon, git: GitBranchIcon, backup: DatabaseRestoreIcon,
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <HugeiconsIcon icon={ICONS[name]} size={size} strokeWidth={1.5} className="hi" color="currentColor" aria-hidden />;
}

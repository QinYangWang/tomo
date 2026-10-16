"use client";

import * as React from "react"

/**
 * Built-in strings the components show or announce. Strings that carry a value are functions.
 * Every component reads them from the nearest `LocaleProvider`; without one they are English.
 */
type LocaleLabels = {
  /* Overlays and notices */
  close: string
  back: string
  dismiss: string
  /* Fields */
  showPassword: string
  hidePassword: string
  clearSelection: string
  showOptions: string
  remove: string
  clear: string
  selectPlaceholder: string
  pickDate: string
  pickDates: string
  decrease: string
  increase: string
  /* Navigation */
  previousPage: string
  nextPage: string
  pagination: string
  page: (page: number) => string
  pageOf: (page: number, count: number) => string
  rowsPerPage: string
  previousMonth: string
  nextMonth: string
  presets: string
  previousSlide: string
  nextSlide: string
  breadcrumb: string
  showHiddenBreadcrumbs: string
  /* Status */
  loading: string
  working: string
  inProgress: string
  unread: string
  newActivity: string
  copy: string
  copied: string
  copyCode: string
  /* Chat */
  messageFrom: (from: string) => string
  typing: string
  jumpToLatest: string
  newMessages: string
  /* Agents */
  workingFor: (duration: string) => string
  workedFor: (duration: string) => string
  toolRunning: string
  toolDone: string
  toolFailed: string
  toolCancelled: string
  copyOutput: string
  runAgain: string
  streamingOutput: string
  finishedIn: (status: string, duration: string) => string
  sources: string
  plan: string
  copyResponse: string
  regenerate: string
  responseInterrupted: string
  goodResponse: string
  badResponse: string
  /* Composer */
  composerPlaceholder: string
  composerInput: string
  attachFiles: string
  dictate: string
  send: string
  stop: string
  filesAndFolders: string
  files: string
  commands: string
  /* Pickers */
  model: string
  mode: string
  reasoningEffort: string
  select: string
  searchPlaceholder: string
  noResults: string
  showAll: (count: number) => string
  effortLow: string
  effortLowDescription: string
  effortMedium: string
  effortMediumDescription: string
  effortHigh: string
  effortHighDescription: string
}

const en: LocaleLabels = {
  close: "Close",
  back: "Back",
  dismiss: "Dismiss",
  showPassword: "Show password",
  hidePassword: "Hide password",
  clearSelection: "Clear selection",
  showOptions: "Show options",
  remove: "Remove",
  clear: "Clear",
  selectPlaceholder: "Select…",
  pickDate: "Pick a date",
  pickDates: "Pick dates",
  decrease: "Decrease",
  increase: "Increase",
  previousPage: "Previous page",
  nextPage: "Next page",
  pagination: "Pagination",
  page: (n) => `Page ${n}`,
  pageOf: (n, count) => `Page ${n} of ${count}`,
  rowsPerPage: "Rows per page",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  presets: "Presets",
  previousSlide: "Previous slide",
  nextSlide: "Next slide",
  breadcrumb: "Breadcrumb",
  showHiddenBreadcrumbs: "Show hidden breadcrumbs",
  loading: "Loading",
  working: "Working",
  inProgress: "In progress",
  unread: "Unread",
  newActivity: "New activity",
  copy: "Copy",
  copied: "Copied",
  copyCode: "Copy code",
  messageFrom: (from) => `${from} message`,
  typing: "Typing",
  jumpToLatest: "Jump to latest",
  newMessages: "New messages",
  workingFor: (d) => `Working for ${d}`,
  workedFor: (d) => `Worked for ${d}`,
  toolRunning: "Running",
  toolDone: "Done",
  toolFailed: "Failed",
  toolCancelled: "Cancelled",
  copyOutput: "Copy output",
  runAgain: "Run again",
  streamingOutput: "Streaming output…",
  finishedIn: (status, d) => `${status} in ${d}`,
  sources: "Sources",
  plan: "Plan",
  copyResponse: "Copy response",
  regenerate: "Regenerate",
  responseInterrupted: "The response was interrupted.",
  goodResponse: "Good response",
  badResponse: "Bad response",
  composerPlaceholder: "Ask anything, @tag files/folders, or use / to show available commands",
  composerInput: "Message",
  attachFiles: "Attach files",
  dictate: "Dictate",
  send: "Send",
  stop: "Stop",
  filesAndFolders: "Files and folders",
  files: "Files",
  commands: "Commands",
  model: "Model",
  mode: "Mode",
  reasoningEffort: "Reasoning effort",
  select: "Select",
  searchPlaceholder: "Search",
  noResults: "No results",
  showAll: (n) => `Show all ${n}`,
  effortLow: "Low",
  effortLowDescription: "Fastest, for small edits",
  effortMedium: "Medium",
  effortMediumDescription: "Balanced",
  effortHigh: "High",
  effortHighDescription: "Thinks longer on hard problems",
}

const zhCN: LocaleLabels = {
  close: "关闭",
  back: "返回",
  dismiss: "忽略",
  showPassword: "显示密码",
  hidePassword: "隐藏密码",
  clearSelection: "清除选择",
  showOptions: "显示选项",
  remove: "移除",
  clear: "清除",
  selectPlaceholder: "请选择…",
  pickDate: "选择日期",
  pickDates: "选择日期范围",
  decrease: "减少",
  increase: "增加",
  previousPage: "上一页",
  nextPage: "下一页",
  pagination: "分页",
  page: (n) => `第 ${n} 页`,
  pageOf: (n, count) => `第 ${n} / ${count} 页`,
  rowsPerPage: "每页行数",
  previousMonth: "上个月",
  nextMonth: "下个月",
  presets: "预设",
  previousSlide: "上一张",
  nextSlide: "下一张",
  breadcrumb: "路径",
  showHiddenBreadcrumbs: "显示隐藏的路径",
  loading: "加载中",
  working: "处理中",
  inProgress: "进行中",
  unread: "未读",
  newActivity: "有新动态",
  copy: "复制",
  copied: "已复制",
  copyCode: "复制代码",
  messageFrom: (from) => `${from} 的消息`,
  typing: "正在输入",
  jumpToLatest: "跳到最新",
  newMessages: "新消息",
  workingFor: (d) => `已工作 ${d}`,
  workedFor: (d) => `工作了 ${d}`,
  toolRunning: "运行中",
  toolDone: "完成",
  toolFailed: "失败",
  toolCancelled: "已取消",
  copyOutput: "复制输出",
  runAgain: "重新运行",
  streamingOutput: "正在输出…",
  finishedIn: (status, d) => `${status}，用时 ${d}`,
  sources: "来源",
  plan: "计划",
  copyResponse: "复制回答",
  regenerate: "重新生成",
  responseInterrupted: "回答中断了。",
  goodResponse: "有帮助",
  badResponse: "没帮助",
  composerPlaceholder: "输入消息，@ 引用文件，/ 使用命令",
  composerInput: "消息",
  attachFiles: "添加文件",
  dictate: "语音输入",
  send: "发送",
  stop: "停止",
  filesAndFolders: "文件和文件夹",
  files: "文件",
  commands: "命令",
  model: "模型",
  mode: "模式",
  reasoningEffort: "思考强度",
  select: "选择",
  searchPlaceholder: "搜索",
  noResults: "没有结果",
  showAll: (n) => `显示全部 ${n} 个`,
  effortLow: "低",
  effortLowDescription: "最快，适合小改动",
  effortMedium: "中",
  effortMediumDescription: "兼顾速度和深度",
  effortHigh: "高",
  effortHighDescription: "难题上想得更久",
}

/** Built-in label sets, keyed by BCP 47 tag. */
const localeLabels: Record<string, LocaleLabels> = { en, "zh-CN": zhCN }

/** The built-in set for a tag: exact match first, then the language alone (`zh-Hans` → `zh-CN`). */
function labelsFor(locale: string): LocaleLabels | undefined {
  if (localeLabels[locale]) return localeLabels[locale]
  const lang = locale.toLowerCase().split(/[-_]/)[0]
  const key = Object.keys(localeLabels).find((k) => k.toLowerCase().split("-")[0] === lang)
  return key ? localeLabels[key] : undefined
}

type LocaleContextValue = { locale: string; labels: LocaleLabels }

const LocaleContext = React.createContext<LocaleContextValue>({ locale: "en", labels: en })

type LocaleProviderProps = {
  /** BCP 47 tag. Picks a built-in label set when one matches; otherwise the parent's (English at the root) stays. */
  locale?: string
  /** Overrides on top of the locale's set. Anything left out keeps its built-in string. */
  labels?: Partial<LocaleLabels>
  children?: React.ReactNode
}

/** Sets the language of every built-in label below it. Providers nest; the inner one wins per key. */
function LocaleProvider({ locale, labels, children }: LocaleProviderProps) {
  const parent = React.useContext(LocaleContext)
  const value = React.useMemo<LocaleContextValue>(() => {
    const base = (locale && labelsFor(locale)) || parent.labels
    return { locale: locale ?? parent.locale, labels: labels ? { ...base, ...stripUndefined(labels) } : base }
  }, [locale, labels, parent])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

function stripUndefined(labels: Partial<LocaleLabels>) {
  return Object.fromEntries(Object.entries(labels).filter(([, v]) => v !== undefined)) as Partial<LocaleLabels>
}

/** The current locale tag and its labels. */
function useLocale() {
  return React.useContext(LocaleContext)
}

export { LocaleProvider, useLocale, localeLabels, type LocaleLabels, type LocaleProviderProps }

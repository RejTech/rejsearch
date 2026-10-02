import { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '../lib/anysearch';
import { chatWithSearchStream } from '../lib/glm';
import { playPerk } from '../lib/sound';
import { MarkdownWithBadges } from './SearchResults';

export interface FollowUpResultGroup {
  query: string;
  results: SearchResult[];
}

interface FollowUpMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 追问会话逻辑（WAP 药丸栏与桌面模态共用）：
 * 多轮追问，回答基于当前搜索结果上下文（chatWithSearchStream）。
 */
export function useFollowUp(query: string, groups: FollowUpResultGroup[]) {
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 消息变化时滚动到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // 新的搜索发生（query 变化）时重置追问会话
  useEffect(() => {
    setMessages([]);
    setInput('');
    setLoading(false);
  }, [query]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const history = messages;
    setMessages([...history, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    try {
      await chatWithSearchStream(q, groups, history, (chunk) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      });
      // 追问回答正常完成：播放 perk 提示音
      playPerk();
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = {
          ...last,
          content: last.content || '抱歉，追问失败，请稍后重试。',
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  return { messages, input, setInput, loading, send, listRef };
}

/** 追问消息气泡（浅色玻璃 AI / 深色用户，与全站设计语言一致） */
function FollowUpBubbles({
  messages,
  loading,
  listRef,
  query,
  groups,
}: {
  messages: FollowUpMessage[];
  loading: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  groups: FollowUpResultGroup[];
}) {
  return (
    <div ref={listRef} className="scroll-fade-y min-h-0 flex-1 space-y-2.5 overflow-y-auto">
      {messages.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
          基于「{query}」的搜索结果继续提问
        </p>
      ) : (
        messages.map((m, i) => (
          <div
            key={i}
            className={`flex animate-fade-in-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-3xl p-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'border border-white/60 bg-white/80 text-gray-700 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100'
              }`}
            >
              {m.role === 'assistant' ? (
                <>
                  <MarkdownWithBadges
                    content={m.content || (loading ? '正在思考…' : '')}
                    results={groups.flatMap((g) => g.results)}
                  />
                  {loading && i === messages.length - 1 && (
                    <span className="animate-blink text-gray-400 dark:text-gray-500">▋</span>
                  )}
                </>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** 追问输入胶囊：透明输入 + 深色胶囊「提问」按钮 */
function FollowUpInput({
  input,
  setInput,
  loading,
  onSend,
}: {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onSend: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/70 p-1 pl-4 dark:border-gray-700 dark:bg-gray-800/70">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSend();
        }}
        placeholder="针对以上结果继续提问…"
        className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      <button
        onClick={onSend}
        disabled={loading || !input.trim()}
        className="shrink-0 rounded-full bg-gray-800 px-4 py-2 text-xs font-medium text-white transition-opacity disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
      >
        提问
      </button>
    </div>
  );
}

/**
 * WAP 结果页追问：结果生成完后浮于底栏上方的「追问」药丸（与底栏同宽），
 * 点击展开为追问栏（收起独占一栏 + 消息区 + 输入胶囊），可多轮追问。
 * 仅在 variant="wap" 下由 SearchResults 渲染（热搜检索工作流内嵌 SearchResults，自动同样生效）。
 */
export function FollowUpBar({
  query,
  groups,
}: {
  query: string;
  groups: FollowUpResultGroup[];
}) {
  const [open, setOpen] = useState(false);
  const fu = useFollowUp(query, groups);
  const hasResults = groups.some((g) => g.results.length > 0);

  // 新的搜索发生时收起追问栏
  useEffect(() => {
    setOpen(false);
  }, [query]);

  if (!hasResults) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.5rem)] z-30 px-4">
      {open ? (
        /* 追问栏：32px 圆角容器，收起按钮独占一栏（17px+15px 半径同心），输入胶囊 10px+22px 同心 */
        <div className="liquid-glass animate-sheet-up relative mx-auto max-w-md rounded-[32px] p-2.5">
          {/* 收起按钮独立一栏，右对齐（距容器顶/右 17px，与 32px 圆角同心） */}
          <div className="flex justify-end px-[7px] pt-[7px]">
            <button
              onClick={() => setOpen(false)}
              className="flex h-[30px] items-center rounded-full border border-gray-200/70 bg-white/70 px-3.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              收起
            </button>
          </div>

          {/* 消息区（与收起行拉开间距；flex 列 + overflow-hidden 保证滚动约束不溢出） */}
          <div className="flex max-h-[45dvh] flex-col overflow-hidden px-2 pb-2 pt-3.5">
            <FollowUpBubbles
              messages={fu.messages}
              loading={fu.loading}
              listRef={fu.listRef}
              query={query}
              groups={groups}
            />
          </div>

          {/* 输入胶囊 */}
          <div className="mt-2">
            <FollowUpInput
              input={fu.input}
              setInput={fu.setInput}
              loading={fu.loading}
              onSend={() => void fu.send()}
            />
          </div>
        </div>
      ) : (
        /* idle 态：与底栏同宽的追问药丸 */
        <button
          onClick={() => setOpen(true)}
          className="liquid-glass animate-fade-in-up mx-auto flex w-full max-w-md items-center justify-center rounded-full py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          追问
        </button>
      )}
    </div>
  );
}

/**
 * 桌面追问模态：由「AI 总体概括」卡的「AI 追问」按钮打开，
 * 居中面板（消息区 + 底部输入胶囊），逻辑与 WAP 追问栏一致。
 */
export function FollowUpModal({
  open,
  onClose,
  query,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  groups: FollowUpResultGroup[];
}) {
  const fu = useFollowUp(query, groups);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl animate-fade-in-up flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        {/* 头部：标题 + 收起（独占右侧） */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 pb-3 pt-4 dark:border-gray-700">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-gray-100">AI 追问</h3>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              基于「{query}」的搜索结果，可多轮追问
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-[30px] items-center rounded-full border border-gray-200/70 bg-white/70 px-3.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            收起
          </button>
        </div>

        {/* 消息区（flex-1 + min-h-0 约束高度，滚动不溢出） */}
        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          <FollowUpBubbles
            messages={fu.messages}
            loading={fu.loading}
            listRef={fu.listRef}
            query={query}
            groups={groups}
          />
        </div>

        {/* 输入胶囊 */}
        <div className="shrink-0 px-5 pb-4 pt-1">
          <FollowUpInput
            input={fu.input}
            setInput={fu.setInput}
            loading={fu.loading}
            onSend={() => void fu.send()}
          />
        </div>
      </div>
    </div>
  );
}

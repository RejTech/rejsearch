import { useState, useRef, useEffect, useCallback } from 'react';
import { search, SearchResult } from '../lib/anysearch';
import { extractSearchQueries, chatWithSearchStream, type FollowUpMessage } from '../lib/glm';
import { MarkdownWithBadges } from './SearchResults';
import { Watermark } from './Watermark';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** 关联的搜索结果组（仅 assistant 消息可能携带） */
  searchGroups?: Array<{ query: string; results: SearchResult[] }>;
  /** 中间步骤（仅 assistant 消息可能携带） */
  steps?: ChatStep[];
}

interface ChatStep {
  type: 'analyzing' | 'searching' | 'done';
  query?: string;
  count?: number;
  status: 'pending' | 'active' | 'done' | 'error';
}

export function ChatMode() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  /** 下一次发送是否为「话题内追问」（复用上次搜索结果，不重新搜索） */
  const [pendingFollowUp, setPendingFollowUp] = useState(false);
  /** 展开的搜索步骤 key 集合（格式 `${msgIdx}-${stepIdx}`） */
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toggleStep = (key: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** 根据步骤 query 找到对应的搜索结果组 */
  const findGroupResults = (
    msg: ChatMessage,
    query?: string,
  ): SearchResult[] => {
    if (!query || !msg.searchGroups) return [];
    const g = msg.searchGroups.find((sg) => sg.query === query);
    return g?.results ?? [];
  };

  // 自动滚动到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 收集当前 assistant 消息关联的所有结果（用于徽章渲染）
  const flattenResults = (groups?: Array<{ query: string; results: SearchResult[] }>): SearchResult[] => {
    if (!groups) return [];
    return groups.flatMap((g) => g.results);
  };

  /** 找到最近一条带 searchGroups 的 assistant 消息 */
  const findLastSearchGroups = (list: ChatMessage[]): Array<{ query: string; results: SearchResult[] }> => {
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.role === 'assistant' && m.searchGroups && m.searchGroups.length > 0) {
        return m.searchGroups;
      }
    }
    return [];
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const isFollowUp = pendingFollowUp;
    abortRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    setInput('');
    setPendingFollowUp(false);
    setIsLoading(true);

    // 用户消息
    const userMsg: ChatMessage = { role: 'user', content: text };
    // 占位 assistant 消息（后续流式更新）
    const assistantIdx = messages.length + 1;
    const placeholder: ChatMessage = isFollowUp
      ? {
          role: 'assistant',
          content: '',
          steps: [{ type: 'done', status: 'active' }],
          searchGroups: [],
        }
      : {
          role: 'assistant',
          content: '',
          steps: [{ type: 'analyzing', status: 'active' }],
          searchGroups: [],
        };

    setMessages((prev) => [...prev, userMsg, placeholder]);

    let acc = '';
    let firstChunkReceived = false;
    let timedOut = false;

    const markGeneratingDone = () => {
      setMessages((prev) => {
        const next = [...prev];
        const steps = (next[assistantIdx].steps || []).map((s) =>
          s.type === 'done' ? { ...s, status: 'done' as const } : s,
        );
        next[assistantIdx] = { ...next[assistantIdx], steps };
        return next;
      });
    };

    try {
      let groups: Array<{ query: string; results: SearchResult[] }> = [];

      if (isFollowUp) {
        // 话题内追问：复用上次的搜索结果（保留在 assistant 消息的 searchGroups 上）
        groups = findLastSearchGroups(messages);

        // 把复用的 searchGroups 也挂到当前 assistant 消息上（用于徽章渲染）
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { ...next[assistantIdx], searchGroups: groups };
          return next;
        });
      } else {
        // 新话题：提取关键词 + 搜索
        const queries = await extractSearchQueries(text);

        if (abortRef.current) return;

        // 更新步骤：分析完成，开始搜索
        const searchSteps: ChatStep[] = [
          { type: 'analyzing', status: 'done' },
          ...queries.map((q) => ({ type: 'searching' as const, query: q, status: 'pending' as const })),
        ];

        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { ...next[assistantIdx], steps: searchSteps };
          return next;
        });

        // 依次执行搜索
        for (let i = 0; i < queries.length; i++) {
          if (abortRef.current) return;

          const q = queries[i];

          // 标记当前搜索为 active
          setMessages((prev) => {
            const next = [...prev];
            const steps = [...(next[assistantIdx].steps || [])];
            steps[i + 1] = { ...steps[i + 1], status: 'active' };
            next[assistantIdx] = { ...next[assistantIdx], steps };
            return next;
          });

          try {
            const response = await search({ query: q, maxResults: 5 });
            groups.push({ query: q, results: response.results });

            // 标记完成，记录数量
            setMessages((prev) => {
              const next = [...prev];
              const steps = [...(next[assistantIdx].steps || [])];
              steps[i + 1] = { ...steps[i + 1], status: 'done', count: response.results.length };
              const sg = [...(next[assistantIdx].searchGroups || []), { query: q, results: response.results }];
              next[assistantIdx] = { ...next[assistantIdx], steps, searchGroups: sg };
              return next;
            });
          } catch {
            // 单个搜索失败标记 error，继续后续
            setMessages((prev) => {
              const next = [...prev];
              const steps = [...(next[assistantIdx].steps || [])];
              steps[i + 1] = { ...steps[i + 1], status: 'error' };
              next[assistantIdx] = { ...next[assistantIdx], steps };
              return next;
            });
          }
        }

        if (abortRef.current) return;

        // 标记"综合生成中"
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = {
            ...next[assistantIdx],
            steps: [...(next[assistantIdx].steps || []), { type: 'done', status: 'active' }],
          };
          return next;
        });
      }

      // 流式生成回复（话题内追问与新话题共用）
      const history: FollowUpMessage[] = messages
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const stream = chatWithSearchStream(
        text,
        groups,
        history,
        (chunk) => {
          if (abortRef.current) return;
          acc += chunk;
          // 收到第一个 chunk 时立即把"生成回复中"标记为 done（避免长时间 active 假卡死）
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            markGeneratingDone();
          }
          setMessages((prev) => {
            const next = [...prev];
            next[assistantIdx] = { ...next[assistantIdx], content: acc };
            return next;
          });
        },
        { signal: abortControllerRef.current?.signal },
      );

      // 首响应超时：60 秒内没有任何 chunk，自动判定失败
      const timeoutId = window.setTimeout(() => {
        if (!firstChunkReceived) {
          timedOut = true;
          abortRef.current = true;
          abortControllerRef.current?.abort();
        }
      }, 60000);

      try {
        await stream;
      } finally {
        window.clearTimeout(timeoutId);
      }

      // 兜底：若从未收到 chunk，也要把"生成回复中"标记为 done
      if (!firstChunkReceived) {
        markGeneratingDone();
      }
    } catch (err) {
      // 异常兜底
      const isAbort =
        err instanceof DOMException &&
        (err.name === 'AbortError' || err.message?.includes('aborted'));
      const fallbackContent = isAbort
        ? acc || (timedOut ? '_（GLM 响应超时，请稍后重试）_' : '_（已停止）_')
        : `生成失败：${err instanceof Error ? err.message : '未知错误'}`;

      setMessages((prev) => {
        const next = [...prev];
        const steps = (next[assistantIdx].steps || []).map((s) =>
          s.type === 'done' ? { ...s, status: 'done' as const } : s,
        );
        next[assistantIdx] = {
          ...next[assistantIdx],
          // 若已收到部分内容（acc 非空），保留已生成内容；否则显示提示
          content: acc || fallbackContent,
          steps,
        };
        return next;
      });
    } finally {
      // 清理占位消息中遗留的 active 步骤（避免 UI 卡在"分析中/搜索中/生成中"）
      setMessages((prev) => {
        const next = [...prev];
        if (next[assistantIdx]) {
          const steps = (next[assistantIdx].steps || []).map((s) =>
            s.status === 'active' || s.status === 'pending'
              ? { ...s, status: 'done' as const }
              : s,
          );
          next[assistantIdx] = { ...next[assistantIdx], steps };
        }
        return next;
      });
      setIsLoading(false);
      abortRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearChat = () => {
    setMessages([]);
    setInput('');
    setPendingFollowUp(false);
  };

  /** 点击「话题内追问」按钮：进入追问模式并聚焦输入框 */
  const enterFollowUp = useCallback(() => {
    setPendingFollowUp(true);
    inputRef.current?.focus();
  }, []);

  /** 取消追问模式 */
  const cancelFollowUp = useCallback(() => {
    setPendingFollowUp(false);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col h-[calc(100vh-180px)]">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-xs rounded-full">
            AI 对话主导
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            自然语言对话，AI 自动搜索并综合回答
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-gray-400 dark:text-gray-500 text-xs hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            清空对话
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">
              向 AI 提问，它会自动搜索并综合结果回答
            </p>
            <p className="text-gray-400 dark:text-gray-600 text-xs">
              示例：「苹果公司最新产品有哪些」「Go 语言的并发模型怎么用」「对比 React 和 Vue 的优缺点」
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 relative overflow-hidden ${
                msg.role === 'user'
                  ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 rounded-2xl rounded-tr-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-100 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap break-words relative z-10">{msg.content}</p>
              ) : (
                <>
                  {msg.content && <Watermark />}
                  <div className="relative z-10">
                  {/* 中间步骤 */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-xs space-y-1 border border-gray-100 dark:border-gray-700">
                      {msg.steps.map((step, idx) => {
                        const stepKey = `${i}-${idx}`;
                        const isSearchDone =
                          step.type === 'searching' && step.status === 'done';
                        const isExpanded = expandedSteps.has(stepKey);
                        const groupResults = isSearchDone
                          ? findGroupResults(msg, step.query)
                          : [];

                        return (
                          <div key={idx}>
                            <div
                              className={`flex items-center gap-2 ${
                                isSearchDone
                                  ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200'
                                  : ''
                              } ${
                                step.status === 'done'
                                  ? 'text-gray-500 dark:text-gray-400'
                                  : step.status === 'active'
                                    ? 'text-blue-600 dark:text-blue-300'
                                    : step.status === 'error'
                                      ? 'text-red-500'
                                      : 'text-gray-400 dark:text-gray-600'
                              }`}
                              onClick={isSearchDone ? () => toggleStep(stepKey) : undefined}
                            >
                              {step.status === 'active' && (
                                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                              )}
                              {step.status === 'done' && <span className="shrink-0">✓</span>}
                              {step.status === 'error' && <span className="shrink-0">✗</span>}
                              {step.status === 'pending' && <span className="shrink-0">○</span>}
                              <span className="truncate flex-1">
                                {step.type === 'analyzing' && '分析问题，提取搜索关键词'}
                                {step.type === 'searching' &&
                                  (step.status === 'done'
                                    ? `搜索"${step.query}"完成，找到 ${step.count ?? 0} 条结果`
                                    : `搜索: ${step.query}`)}
                                {step.type === 'done' &&
                                  (step.count !== undefined ? `找到 ${step.count} 条结果` : '生成回复中')}
                              </span>
                              {isSearchDone && (
                                <span className="shrink-0 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                  ›
                                </span>
                              )}
                            </div>

                            {isSearchDone && isExpanded && (
                              <div className="mt-1.5 ml-5 space-y-1.5">
                                {groupResults.length === 0 ? (
                                  <div className="text-gray-400 dark:text-gray-500 text-xs italic">无结果</div>
                                ) : (
                                  groupResults.map((r, rIdx) => (
                                    <a
                                      key={rIdx}
                                      href={r.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block px-2 py-1.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                      <div className="text-blue-600 dark:text-blue-400 text-xs font-medium truncate">
                                        {rIdx + 1}. {r.title || r.url}
                                      </div>
                                      {r.snippet && (
                                        <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 line-clamp-2">
                                          {r.snippet}
                                        </div>
                                      )}
                                      <div className="text-gray-400 dark:text-gray-500 text-[10px] mt-0.5 truncate">
                                        {r.url}
                                      </div>
                                    </a>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* AI 回复内容 */}
                  {msg.content ? (
                    <MarkdownWithBadges
                      content={msg.content}
                      results={flattenResults(msg.searchGroups)}
                    />
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {isLoading ? '思考中...' : ''}
                    </span>
                  )}
                  {isLoading && msg.content && i === messages.length - 1 && (
                    <span className="animate-blink text-gray-400 dark:text-gray-500 ml-0.5">▋</span>
                  )}

                  {/* 话题内追问按钮：仅最后一条 AI 回复、有搜索结果、未在 loading 时显示 */}
                  {!isLoading &&
                    msg.content &&
                    msg.searchGroups &&
                    msg.searchGroups.length > 0 &&
                    i === messages.length - 1 && (
                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={enterFollowUp}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            pendingFollowUp
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                          }`}
                        >
                          话题内追问
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="mt-3 shrink-0">
        {pendingFollowUp && (
          <div className="mb-2 flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-full">
            <span className="text-xs text-blue-600 dark:text-blue-300">
              话题内追问模式：下次发送将复用上次搜索结果，不会重新搜索
            </span>
            <button
              onClick={cancelFollowUp}
              className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 transition-colors ml-2 shrink-0"
            >
              取消
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={pendingFollowUp ? '在当前话题内追问...' : '向 AI 提问，支持自然语言...'}
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 disabled:bg-gray-50 dark:disabled:bg-gray-900/50 disabled:cursor-not-allowed transition-all min-w-0"
          />
          {isLoading ? (
            <button
              onClick={stop}
              className="px-4 py-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shrink-0 whitespace-nowrap"
            >
              停止
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className={`px-5 py-2.5 text-sm rounded-full shrink-0 whitespace-nowrap transition-all ${
                input.trim()
                  ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
            >
              发送
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          {pendingFollowUp
            ? '话题内追问：基于上次搜索结果作答 · Enter 发送 · Shift+Enter 换行'
            : '新话题：AI 会自动搜索多次并综合结果 · Enter 发送 · Shift+Enter 换行'}
        </p>
      </div>
    </div>
  );
}

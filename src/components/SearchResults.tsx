import React, { useState, useMemo, useRef, useEffect, Fragment, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchStore } from '../store/searchStore';
import { summarizeContent, followUpStream, followUpOverviewStream, type FollowUpMessage } from '../lib/glm';
import { SearchResult } from '../lib/anysearch';

/** 复制代码块按钮 */
function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      const text = typeof children === 'string'
        ? children
        : Array.isArray(children)
          ? children.join('')
          : '';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 复制失败静默处理
    }
  };
  return (
    <div className="relative my-2 group">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600"
      >
        {copied ? '已复制' : '复制'}
      </button>
      <pre className="bg-gray-900 text-gray-100 text-xs rounded-2xl p-3 overflow-x-auto font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** Markdown 渲染：支持代码块、行内代码、加粗、列表、表格、引用、链接等 */
function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            if (inline) {
              return (
                <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock>{children}</CodeBlock>;
          },
          p({ children }) {
            return <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="my-1.5 pl-5 list-disc space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-1.5 pl-5 list-decimal space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li>{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-base font-semibold my-2 text-gray-800 dark:text-gray-100">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-semibold my-2 text-gray-800 dark:text-gray-100">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold my-2 text-gray-800 dark:text-gray-100">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-sm font-semibold my-1.5 text-gray-800 dark:text-gray-100">{children}</h4>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 pl-3 border-l-2 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300">
                {children}
              </a>
            );
          },
          strong({ children }) {
            return <strong className="font-semibold text-gray-800 dark:text-gray-100">{children}</strong>;
          },
          table({ children }) {
            return (
              <div className="my-2 overflow-x-auto">
                <table className="border-collapse text-xs">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-gray-200 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium text-left">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-gray-200 dark:border-gray-600 px-2 py-1">{children}</td>;
          },
          hr() {
            return <hr className="my-3 border-gray-200 dark:border-gray-600" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** 把文本节点中的 [N] 或 [N,M,K] 引用标记渲染为可点击的圆形徽章 */
function renderTextWithBadges(text: string, results: SearchResult[]): ReactNode[] {
  const regex = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    const nums = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    nums.forEach((num) => {
      const idx = parseInt(num, 10) - 1;
      if (idx >= 0 && idx < results.length) {
        elements.push(
          <button
            type="button"
            key={`b${match.index}-${num}`}
            data-badge-index={idx}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800 hover:text-blue-700 dark:hover:text-blue-200 transition-colors mx-0.5 align-middle border-0 p-0 cursor-pointer"
          >
            {num}
          </button>,
        );
      } else {
        elements.push(num);
      }
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }
  return elements;
}

/** 递归遍历 React 子节点，把字符串里的 [N] 替换为徽章按钮 */
function injectBadges(node: ReactNode, results: SearchResult[]): ReactNode {
  if (typeof node === 'string') {
    return <>{renderTextWithBadges(node, results)}</>;
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => (
      <Fragment key={i}>{injectBadges(child, results)}</Fragment>
    ));
  }
  if (node && typeof node === 'object' && 'props' in node) {
    const el = node as React.ReactElement;
    const children = el.props.children;
    return React.cloneElement(el, el.props, injectBadges(children, results));
  }
  return node;
}

/** overview 模式专用：Markdown 渲染 + [N] 引用徽章 */
function MarkdownWithBadges({ content, results }: { content: string; results: SearchResult[] }) {
  return (
    <div className="markdown-body text-sm text-gray-700 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            if (inline) {
              return (
                <code className="px-1 py-0.5 bg-gray-100 text-pink-600 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock>{children}</CodeBlock>;
          },
          p({ children }) {
            return <p className="my-1.5 first:mt-0 last:mb-0">{injectBadges(children, results)}</p>;
          },
          li({ children }) {
            return <li>{injectBadges(children, results)}</li>;
          },
          h1({ children }) {
            return <h1 className="text-base font-semibold my-2 text-gray-800">{injectBadges(children, results)}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-semibold my-2 text-gray-800">{injectBadges(children, results)}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold my-2 text-gray-800">{injectBadges(children, results)}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-sm font-semibold my-1.5 text-gray-800">{injectBadges(children, results)}</h4>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 pl-3 border-l-2 border-gray-200 text-gray-500 italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                {children}
              </a>
            );
          },
          strong({ children }) {
            return <strong className="font-semibold text-gray-800">{children}</strong>;
          },
          table({ children }) {
            return (
              <div className="my-2 overflow-x-auto">
                <table className="border-collapse text-xs">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-gray-200 px-2 py-1 bg-gray-50 text-gray-700 font-medium text-left">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-gray-200 px-2 py-1">{children}</td>;
          },
          hr() {
            return <hr className="my-3 border-gray-200" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * 逐字浮入渲染：每个字符独立 animate-fade-in-up，key 为绝对位置保证不重复动画。
 * 同时检测 [N] 引用标记，渲染为可点击的圆形徽章。
 */
function renderAnimatedOverview(text: string, results: SearchResult[]) {
  const regex = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    for (let i = lastIndex; i < match.index; i++) {
      elements.push(<span key={`c${i}`} className="animate-fade-in-up">{text[i]}</span>);
    }
    const nums = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (nums.length === 0) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        elements.push(<span key={`c${i}`} className="animate-fade-in-up">{text[i]}</span>);
      }
    } else {
      nums.forEach((num) => {
        const idx = parseInt(num, 10) - 1;
        if (idx >= 0 && idx < results.length) {
          elements.push(
            <button
              type="button"
              key={`b${match.index}-${num}`}
              data-badge-index={idx}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800 hover:text-blue-700 dark:hover:text-blue-200 transition-colors ml-0.5 animate-fade-in-up cursor-pointer align-middle border-0 p-0"
            >
              {num}
            </button>
          );
        } else {
          num.split('').forEach((ch, i) => {
            elements.push(<span key={`c${match.index}-${i}`} className="animate-fade-in-up">{ch}</span>);
          });
        }
      });
    }
    lastIndex = match.index + match[0].length;
  }
  for (let i = lastIndex; i < text.length; i++) {
    elements.push(<span key={`c${i}`} className="animate-fade-in-up">{text[i]}</span>);
  }
  return elements;
}

/** 逐字浮入渲染（纯文本） */
function renderAnimatedText(text: string) {
  return text.split('').map((char, i) => (
    <span key={i} className="animate-fade-in-up">{char}</span>
  ));
}

interface SearchResultsProps {
  showGLM?: boolean;
  /** 是否允许向 AI 追问（默认 true）；关闭时隐藏所有追问入口 */
  allowFollowUp?: boolean;
}

export function SearchResults({ showGLM = true, allowFollowUp = true }: SearchResultsProps = {}) {
  const {
    results,
    total,
    isLoading,
    error,
    selectedResult,
    selectResult,
    overviewSummary,
    isOverviewLoading,
    detailSummary,
    isDetailLoading,
    setDetailSummary,
    appendDetailSummary,
    setDetailLoading,
  } = useSearchStore();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 分页：每页 10 条
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pagedResults = results.slice(pageStart, pageEnd);

  // results 变化时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [results]);

  // 翻页后滚动到结果列表顶部
  const resultsTopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (currentPage > 1 && resultsTopRef.current) {
      resultsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // 追问窗口状态：mode 为 'detail'（基于单条结果原文）或 'overview'（基于所有搜索结果）
  const [followUpMode, setFollowUpMode] = useState<'detail' | 'overview' | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const followUpScrollRef = useRef<HTMLDivElement>(null);
  const followUpAbortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // 逐字浮入动画：基于 GLM 流式输出的实际文本，每个字符独立动画
  const overviewElements = useMemo(
    () => renderAnimatedOverview(overviewSummary, results),
    [overviewSummary, results],
  );
  const detailElements = useMemo(
    () => renderAnimatedText(detailSummary),
    [detailSummary],
  );

  // 追问消息列表有变化时自动滚到底部
  useEffect(() => {
    if (showFollowUp && followUpScrollRef.current) {
      followUpScrollRef.current.scrollTop = followUpScrollRef.current.scrollHeight;
    }
  }, [showFollowUp, followUpMessages, isFollowUpLoading]);

  // 关闭追问窗口时清理生成中状态
  useEffect(() => {
    if (!showFollowUp) {
      followUpAbortRef.current.cancelled = true;
    }
  }, [showFollowUp]);

  const handleResultClick = async (result: typeof results[0], index: number) => {
    setActiveIndex(index);
    selectResult(result);
    setDetailSummary('');

    if (showGLM && result.content) {
      setDetailLoading(true);
      try {
        await summarizeContent(result.title, result.content, (chunk) => appendDetailSummary(chunk));
      } catch {
        setDetailSummary('AI 摘要生成失败，请稍后重试');
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const closeModal = () => {
    selectResult(null);
    setActiveIndex(null);
    setDetailSummary('');
    setDetailLoading(false);
  };

  // 打开追问窗口：mode='detail' 基于单条原文，mode='overview' 基于所有结果
  const openFollowUp = (mode: 'detail' | 'overview') => {
    if (mode === 'detail' && !selectedResult) return;
    setFollowUpMode(mode);
    setFollowUpMessages([]);
    setFollowUpInput('');
    setIsFollowUpLoading(false);
    setShowFollowUp(true);
  };

  const closeFollowUp = () => {
    followUpAbortRef.current.cancelled = true;
    setShowFollowUp(false);
    setIsFollowUpLoading(false);
    setFollowUpMode(null);
  };

  // 发送追问消息（多轮 + 流式）：根据模式调用对应后端
  const sendFollowUp = async () => {
    if (followUpMode === 'detail' && !selectedResult) return;
    if (followUpMode === 'overview' && results.length === 0) return;
    const text = followUpInput.trim();
    if (!text || isFollowUpLoading) return;

    const userMsg: FollowUpMessage = { role: 'user', content: text };
    const nextMessages = [...followUpMessages, userMsg];
    setFollowUpMessages(nextMessages);
    setFollowUpInput('');
    setIsFollowUpLoading(true);

    // 先放入一条空的 assistant 消息，随后流式追加内容
    const assistantIdx = nextMessages.length;
    setFollowUpMessages([...nextMessages, { role: 'assistant', content: '' }]);

    const abortToken = { cancelled: false };
    followUpAbortRef.current = abortToken;

    const onChunk = (chunk: string) => {
      if (abortToken.cancelled) return;
      setFollowUpMessages((prev) => {
        const updated = [...prev];
        if (updated[assistantIdx]) {
          updated[assistantIdx] = {
            role: 'assistant',
            content: (updated[assistantIdx].content || '') + chunk,
          };
        }
        return updated;
      });
    };

    try {
      if (followUpMode === 'overview') {
        await followUpOverviewStream(results, nextMessages, onChunk);
      } else if (selectedResult) {
        await followUpStream(
          { title: selectedResult.title, url: selectedResult.url, content: selectedResult.content || '' },
          nextMessages,
          onChunk,
        );
      }
    } catch {
      if (!abortToken.cancelled) {
        setFollowUpMessages((prev) => {
          const updated = [...prev];
          if (updated[assistantIdx] && !updated[assistantIdx].content) {
            updated[assistantIdx] = {
              role: 'assistant',
              content: 'AI 追问失败，请稍后重试',
            };
          }
          return updated;
        });
      }
    } finally {
      if (!abortToken.cancelled) {
        setIsFollowUpLoading(false);
      }
    }
  };

  const stopFollowUp = () => {
    followUpAbortRef.current.cancelled = true;
    setIsFollowUpLoading(false);
  };

  // 渲染「向 AI 追问」按钮 + 跳转链接（桌面和移动端详情共用）
  const renderDetailFooter = () => {
    if (!selectedResult) return null;
    return (
      <div className="mt-4 flex flex-col gap-2">
        {showGLM && allowFollowUp && (
          <button
            type="button"
            onClick={() => openFollowUp('detail')}
            className="w-full py-2 text-sm rounded-full transition-colors bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60"
          >
            向 AI 追问 ↗
          </button>
        )}
        <a
          href={selectedResult.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-center py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-full hover:bg-gray-700 dark:hover:bg-white transition-colors"
        >
          跳转到原页面
        </a>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="mt-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-full mb-3" />
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-5/6 mb-4" />
              <div className="flex items-center gap-4">
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-20" />
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <p className="text-red-600 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  const renderDetail = () => {
    if (!selectedResult) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-400 dark:text-gray-500 text-sm">点击搜索结果查看详情</p>
        </div>
      );
    }

    return (
      <>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 line-clamp-2">
          {selectedResult.title}
        </h4>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 font-mono truncate">
          {selectedResult.url}
        </p>

        {showGLM && isDetailLoading && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
              <span className="text-xs text-gray-500 dark:text-gray-400">GLM-4-Flash 正在解析...</span>
            </div>
          </div>
        )}

        {showGLM && detailSummary && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-2xl animate-fade-in-up">
            <p className="text-xs text-blue-600 dark:text-blue-300 font-medium mb-1.5">AI 摘要</p>
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
              {detailElements}
              {isDetailLoading && <span className="animate-blink text-gray-400 dark:text-gray-500">▋</span>}
            </p>
          </div>
        )}

        <div className="max-h-[400px] overflow-y-auto">
          {selectedResult.content ? (
            <div className="whitespace-pre-wrap text-gray-500 dark:text-gray-400 text-xs leading-relaxed break-all">
              {selectedResult.content}
            </div>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-center py-8 text-sm">暂无内容</p>
          )}
        </div>

        {renderDetailFooter()}
      </>
    );
  };

  return (
    <div className="mt-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            找到 <span className="text-gray-800 dark:text-gray-100 font-semibold">{total}</span> 条结果
            {totalPages > 1 && (
              <span className="text-gray-400 dark:text-gray-500 ml-2">
                · 第 {safePage}/{totalPages} 页（{pageStart + 1}-{Math.min(pageEnd, results.length)}）
              </span>
            )}
          </p>
        </div>

        {/* AI 总体概括 */}
        {showGLM && (isOverviewLoading || overviewSummary) && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">AI 总体概括</span>
              {isOverviewLoading && (
                <div className="w-3.5 h-3.5 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
              )}
            </div>
            {isOverviewLoading && !overviewSummary ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">GLM-4-Flash 正在解析所有搜索结果...</p>
            ) : (
              <>
                <p
                  className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                  onClick={(e) => {
                    const target = (e.target as HTMLElement).closest('[data-badge-index]');
                    if (target) {
                      const idx = parseInt(target.getAttribute('data-badge-index')!, 10);
                      if (idx >= 0 && idx < results.length) {
                        handleResultClick(results[idx], idx);
                      }
                    }
                  }}
                >
                  {overviewElements}
                  {isOverviewLoading && <span className="animate-blink text-gray-400 dark:text-gray-500">▋</span>}
                </p>
                {!isOverviewLoading && showGLM && allowFollowUp && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => openFollowUp('overview')}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-sm hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                    >
                      基于所有结果向 AI 追问 ↗
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3" ref={resultsTopRef}>
            {pagedResults.map((result, idx) => {
              const index = pageStart + idx;
              return (
                <div
                  key={index}
                  onClick={() => handleResultClick(result, index)}
                  className={`bg-white dark:bg-gray-800 border rounded-2xl p-5 cursor-pointer transition-all duration-200 ${
                    activeIndex === index
                      ? 'border-gray-400 dark:border-gray-500 shadow-md'
                      : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-gray-800 dark:text-gray-100 mb-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors line-clamp-2">
                        {result.title}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-3 line-clamp-2">
                        {result.snippet}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                        {result.source && <span>{result.source}</span>}
                        {result.timestamp && <span>{formatDate(result.timestamp)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">{result.url}</p>
                  </div>
                </div>
              );
            })}

            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    safePage <= 1
                      ? 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 border-gray-100 dark:border-gray-700 cursor-not-allowed'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  上一页
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 text-sm rounded-full transition-colors ${
                        p === safePage
                          ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    safePage >= totalPages
                      ? 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 border-gray-100 dark:border-gray-700 cursor-not-allowed'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  下一页
                </button>
              </div>
            )}
          </div>

          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 sticky top-4 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-gray-800 dark:text-gray-100">内容详情</h3>
                {selectedResult && (
                  <button
                    onClick={closeModal}
                    className="text-gray-400 dark:text-gray-500 text-xs hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    关闭
                  </button>
                )}
              </div>
              {renderDetail()}
            </div>
          </div>
        </div>
      </div>

      {selectedResult && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up overflow-hidden transition-colors">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-100">内容详情</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 dark:text-gray-500 text-sm hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-base font-medium text-gray-800 dark:text-gray-100 mb-2 line-clamp-2">
                {selectedResult.title}
              </h4>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate mb-4">
                {selectedResult.url}
              </p>

              {showGLM && isDetailLoading && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">GLM-4-Flash 正在解析...</span>
                  </div>
                </div>
              )}

              {showGLM && detailSummary && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-2xl animate-fade-in-up">
                  <p className="text-xs text-blue-600 dark:text-blue-300 font-medium mb-1.5">AI 摘要</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                    {detailElements}
                    {isDetailLoading && <span className="animate-blink text-gray-400 dark:text-gray-500">▋</span>}
                  </p>
                </div>
              )}

              {selectedResult.content ? (
                <div className="whitespace-pre-wrap text-gray-500 dark:text-gray-400 text-xs leading-relaxed break-all">
                  {selectedResult.content}
                </div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-center py-8 text-sm">暂无内容</p>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
              {renderDetailFooter()}
            </div>
          </div>
        </div>
      )}

      {/* 追问对话窗口（新窗口模态） */}
      {showFollowUp && (selectedResult || followUpMode === 'overview') && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeFollowUp}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden w-full max-w-2xl h-[80vh] max-h-[800px] flex flex-col shadow-2xl animate-fade-in-up transition-colors">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="min-w-0 flex-1 mr-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs rounded-full font-medium">
                    AI 追问
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {followUpMode === 'overview'
                      ? `基于全部 ${results.length} 条搜索结果`
                      : '基于当前页面原文'}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {followUpMode === 'overview'
                    ? '综合所有搜索结果追问'
                    : selectedResult?.title}
                </h3>
              </div>
              <button
                onClick={closeFollowUp}
                className="text-gray-400 dark:text-gray-500 text-sm hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
              >
                关闭
              </button>
            </div>

            {/* 消息列表 */}
            <div
              ref={followUpScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900 transition-colors"
            >
              {followUpMessages.length === 0 && !isFollowUpLoading && (
                <div className="text-center py-12">
                  <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">
                    {followUpMode === 'overview'
                      ? `已加载全部 ${results.length} 条搜索结果作为参考上下文`
                      : '已加载该页面的原文作为参考上下文'}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs">请在下方输入框向 AI 提问（可多轮追问）</p>
                </div>
              )}
              {followUpMessages.map((msg, idx) => {
                const isLast = idx === followUpMessages.length - 1;
                const showCursor = isLast && msg.role === 'assistant' && isFollowUpLoading;
                if (msg.role === 'user') {
                  return (
                    <div key={idx} className="flex justify-end">
                      <div className="max-w-[80%] px-4 py-2.5 bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-2xl rounded-tr-sm whitespace-pre-wrap break-all">
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                // assistant：渲染 Markdown；overview 模式支持 [N] 徽章点击跳转结果
                const rendered = msg.content ? (
                  followUpMode === 'overview' ? (
                    <div
                      onClick={(e) => {
                        const target = (e.target as HTMLElement).closest('[data-badge-index]');
                        if (target) {
                          const nIdx = parseInt(target.getAttribute('data-badge-index')!, 10);
                          if (nIdx >= 0 && nIdx < results.length) {
                            handleResultClick(results[nIdx], nIdx);
                            closeFollowUp();
                          }
                        }
                      }}
                    >
                      <MarkdownWithBadges content={msg.content} results={results} />
                    </div>
                  ) : (
                    <Markdown content={msg.content} />
                  )
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">正在思考...</span>
                );
                return (
                  <div key={idx} className="flex justify-start">
                    <div className="max-w-[90%] px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 rounded-2xl rounded-tl-sm shadow-sm leading-relaxed transition-colors">
                      {rendered}
                      {showCursor && <span className="animate-blink text-gray-400 dark:text-gray-500 ml-0.5">▋</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 输入框 + 发送/停止 */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0 transition-colors">
              <div className="flex items-end gap-2">
                <textarea
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendFollowUp();
                    }
                  }}
                  placeholder="输入你的问题，按 Enter 发送（Shift+Enter 换行）..."
                  rows={2}
                  disabled={isFollowUpLoading}
                  className="flex-1 resize-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-gray-400 dark:focus:border-gray-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed min-w-0 transition-colors"
                />
                {isFollowUpLoading ? (
                  <button
                    onClick={stopFollowUp}
                    className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shrink-0 whitespace-nowrap"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    onClick={() => void sendFollowUp()}
                    disabled={!followUpInput.trim()}
                    className={`px-5 py-2 text-sm rounded-full shrink-0 whitespace-nowrap transition-all ${
                      followUpInput.trim()
                        ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    发送
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .break-all {
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}

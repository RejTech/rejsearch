import { SearchResult } from './anysearch';

const GLM_API_KEY = '838b59bb70234f5dbbff4748e6b58714.y6IBHlQe8RHw2gOA';
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callGLM(systemPrompt: string, userPrompt: string, maxTokens: number = 600): Promise<string> {
  const response = await fetch(GLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM API 调用失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

/**
 * 流式调用 GLM（SSE），逐 token 返回内容，模拟生成式 AI 实时输出。
 * 支持传入完整 messages 数组（用于多轮对话场景）。
 * options.signal：可选 AbortSignal，用于中断流式请求。
 */
async function* callGLMStream(
  systemPrompt: string,
  userPrompt: string | ChatMessage[],
  maxTokens: number = 600,
  options?: { signal?: AbortSignal },
): AsyncGenerator<string> {
  const messages: ChatMessage[] = Array.isArray(userPrompt)
    ? [{ role: 'system', content: systemPrompt }, ...userPrompt]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

  const response = await fetch(GLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM API 调用失败: ${response.status} ${errorText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // 忽略不完整的 JSON 行
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 已释放则忽略
    }
  }
}

// 总体概括：对多条搜索结果进行综合概述（流式）
export async function summarizeOverview(
  query: string,
  results: SearchResult[],
  onChunk?: (chunk: string) => void,
): Promise<string> {
  if (!results.length) return '';

  const snippets = results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`)
    .join('\n\n');

  const prompt = `搜索关键词：${query}

以下是搜索到的 ${results.length} 条网页结果的标题和摘要：

${snippets}

请基于以上所有搜索结果，用中文进行综合概括。
要求：
1. 字数在200字以上，500字以内
2. 当引用某条搜索结果的信息时，在引用的内容后面加上引用标记，格式为[序号]，例如[1]、[3]、[5]
3. 当同时引用多条结果时，合并到一个方括号内用逗号分隔，例如[1,2,3]，不要写成[1][2][3]
4. 序号对应搜索结果的编号（1-${results.length}）
5. 保持概括内容连贯自然，不要使用Markdown格式

请输出概括：`;

  let full = '';
  for await (const chunk of callGLMStream(
    '你是一个专业的搜索结果分析助手，擅长从多条搜索结果中提取关键信息并进行综合概括。',
    prompt,
    1200,
  )) {
    full += chunk;
    onChunk?.(chunk);
  }
  return full;
}

// 许可证概括：对LICENSE文件进行摘要，提取允许做和不允许做的内容（流式）
export async function summarizeLicense(
  content: string,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  if (!content) return '';

  const prompt = `请对以下软件许可证进行分析，输出结构化的摘要。

许可证内容：
${content.slice(0, 10000)}

请按以下格式输出：

【允许做】
- 允许复制、分发和修改软件
- 允许用于商业目的
- 其他允许的行为...

【不允许做】
- 不允许将软件用于专利诉讼
- 不允许限制用户的自由
- 其他不允许的行为...

请确保内容准确，使用简洁的中文表述。`;

  let full = '';
  for await (const chunk of callGLMStream(
    '你是一个专业的软件许可证分析助手，擅长解读开源许可证的条款并进行清晰的总结。',
    prompt,
    800,
  )) {
    full += chunk;
    onChunk?.(chunk);
  }
  return full;
}

// 高级搜索方向：根据自然语言描述生成 AnySearch 的 tag 与 params
export interface SearchDirection {
  tag: string;                       // {domain}.{sub_domain}，如 "code.doc"；空表示通用搜索
  params: Record<string, unknown>;   // 透传给 AnyMix 的扩展参数
  domain: string;                    // 领域中文名（展示用）
  reason: string;                    // 识别理由（展示用）
}

// 从 GLM 文本响应中提取 JSON（兼容 markdown 代码块包裹）
function extractJson(text: string): any | null {
  let t = text.trim();
  // 去除 ```json ... ``` 或 ``` ... ``` 包裹
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) t = fenceMatch[1].trim();
  // 截取第一个 { 到最后一个 }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function generateSearchDirection(naturalLanguage: string): Promise<SearchDirection> {
  if (!naturalLanguage.trim()) {
    return { tag: '', params: {}, domain: '', reason: '描述为空，使用通用搜索' };
  }

  const prompt = `你是 AnySearch 搜索方向识别助手。根据用户的自然语言描述，判断最适合的搜索方向。

AnySearch API 的 tag 格式为 {domain}.{sub_domain}，以下是全部可用 tag（仅可从中选择，不可编造）：
- code.doc：代码文档搜索，必填参数 library（如 golang/python/react/vue/java）
- code.issue：GitHub Issue 搜索
- code.pr：GitHub PR 搜索
- finance.us_stock：美股行情，参数如 ticker（如 AAPL/TSLA）
- finance.crypto：加密货币行情
- academic.paper：学术论文搜索，参数如 field、keyword
- academic.author：学术作者信息
- academic.preprint：预印本论文
- academic.search：综合学术搜索
- health.drug：药品信息搜索
- health.disease：疾病信息搜索
- legal.statute：法律法规搜索
- legal.case：法律案例搜索
- travel.flight：航班信息搜索
- travel.hotel：酒店信息搜索
- gaming.achievement：游戏成就搜索
- film.movie：电影信息搜索
- film.tv_show：电视剧信息搜索
- security.cve：CVE 漏洞搜索，参数如 cve（如 CVE-2024-1234）

规则：
1. 仅当用户描述明确指向上述某个垂直领域时，才返回对应 tag 和必填参数
2. 不确定或属于通用信息查询时，tag 返回空字符串（通用搜索）
3. params 中的值根据用户描述填充，无法确定的填空字符串
4. 严禁编造不在上述列表中的 tag
5. 严格只输出 JSON，不要有任何额外文字

用户描述：${naturalLanguage}

请输出 JSON：{"tag":"","params":{},"domain":"","reason":""}`;

  const raw = await callGLM(
    '你是 AnySearch 搜索方向识别助手，擅长将自然语言描述映射为结构化的搜索方向参数。',
    prompt,
    300,
  );

  const parsed = extractJson(raw);
  if (!parsed) {
    return { tag: '', params: {}, domain: '', reason: '识别失败，使用通用搜索' };
  }

  return {
    tag: typeof parsed.tag === 'string' ? parsed.tag : '',
    params: (parsed.params && typeof parsed.params === 'object') ? parsed.params : {},
    domain: typeof parsed.domain === 'string' ? parsed.domain : '',
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  };
}

// 单条详情概括：对单条网页内容进行概括（流式）
export async function summarizeContent(
  title: string,
  content: string,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  if (!content) return '';

  const prompt = `请对以下网页内容进行概括总结，用中文输出，简洁清晰，控制在200字以内。

网页标题：${title}

网页内容：
${content.slice(0, 8000)}

请输出概括：`;

  let full = '';
  for await (const chunk of callGLMStream(
    '你是一个专业的网页内容概括助手，擅长从长文本中提取关键信息并用简洁的中文进行概括。',
    prompt,
    600,
  )) {
    full += chunk;
    onChunk?.(chunk);
  }
  return full;
}

/**
 * WAP 热搜折叠卡概览：根据榜单全部词条整理一句中文概览
 * （涉及哪些领域/圈子、产品或事件、人物或机构）。
 * 结果按「榜单标识」进程内缓存，同一期榜单只调用一次。
 */
const platformBriefCache = new Map<string, string>();

export async function summarizePlatformBrief(
  cacheKey: string,
  platformName: string,
  titles: string[],
): Promise<string> {
  const cached = platformBriefCache.get(cacheKey);
  if (cached !== undefined) return cached;
  if (!titles.length) return '';

  const prompt = `以下是热搜平台「${platformName}」当期的词条列表（按热度排序）：

${titles.map((t, i) => `${i + 1}. ${t.slice(0, 40)}`).join('\n')}

请根据以上词条内容，用一句不超过 60 字的中文概括本榜整体内容：
涉及哪些领域或圈子、出现了哪些产品或事件、提到了哪些人物或机构。
要求：
1. 一句话，信息密度高，直接点名最具代表性的人名/产品名/机构名/事件名
2. 不分行，不使用 Markdown、引号或任何前缀（如"该榜单"）
3. 只输出这句话本身，不要解释`;

  const raw = await callGLM(
    '你是热搜榜单分析助手，擅长从一批热搜词条中提炼整体脉络并用一句话概括。',
    prompt,
    200,
  );

  const clean = raw.replace(/^["'「『]|["'」』]$/g, '').trim();
  platformBriefCache.set(cacheKey, clean);
  return clean;
}

/**
 * AI 自搜模式：从用户自然语言消息中提取搜索关键词（可多个）。
 * 返回 1-3 个关键词，按优先级排序。
 */
export async function extractSearchQueries(userMessage: string): Promise<string[]> {
  if (!userMessage.trim()) return [];

  const prompt = `你是搜索关键词提取助手。根据用户的问题或需求，提取最适合用于搜索引擎检索的关键词。

规则：
1. 返回 1-3 个关键词，按重要性排序
2. 关键词应当精炼（去掉"请问"、"帮我"等语气词）
3. 每个关键词是独立的搜索查询，能覆盖用户需求的不同方面
4. 若用户问题只涉及单一主题，只返回 1 个关键词
5. 严格只输出 JSON 数组，不要有任何额外文字

用户消息：${userMessage}

请输出 JSON 数组，如 ["关键词1", "关键词2"]：`;

  const raw = await callGLM(
    '你是搜索关键词提取助手，擅长从自然语言中提炼搜索查询。',
    prompt,
    200,
  );

  // 提取 JSON 数组
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [userMessage.trim()];
  try {
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).slice(0, 3);
    }
  } catch {
    // 解析失败回退
  }
  return [userMessage.trim()];
}

/**
 * AI 自搜模式：基于搜索结果，流式回复用户。
 * 把所有搜索结果（含正文摘要）作为上下文注入，AI 综合作答。
 * options.signal：可选 AbortSignal，用于中断流式请求。
 */
export async function chatWithSearchStream(
  userMessage: string,
  searchResults: Array<{ query: string; results: SearchResult[] }>,
  historyMessages: { role: 'user' | 'assistant'; content: string }[],
  onChunk?: (chunk: string) => void,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const systemPrompt =
    '你是锐机超级搜索的 AI 自搜助手。用户提出问题，系统已根据用户需求自动执行了多次搜索。' +
    '请综合「参考搜索结果」进行回答，不要编造事实。若搜索结果不足以回答问题，请明确告知用户信息不足。' +
    '回答使用简洁的中文，可使用 Markdown 语法（代码块、行内代码、加粗、列表、表格等）提升可读性。' +
    '引用搜索结果时使用 [序号] 标注；同时引用多条时合并到一个方括号，例如 [1,2,3]。' +
    '序号按「参考搜索结果」中的全局编号引用。';

  // 拼接所有搜索结果（带全局序号）
  const allResults: SearchResult[] = [];
  const sections = searchResults.map((group) => {
    const items = group.results.map((r) => {
      const globalIdx = allResults.length + 1;
      allResults.push(r);
      return `[${globalIdx}] ${r.title}\n    URL: ${r.url}\n    摘要: ${r.snippet}\n    内容: ${(r.content || '').slice(0, 1500)}`;
    }).join('\n\n');
    return `## 搜索关键词: ${group.query}\n${items}`;
  }).join('\n\n---\n\n');

  const contextPrompt = `参考搜索结果（共 ${allResults.length} 条，来自 ${searchResults.length} 次搜索）：

${sections}

---
用户最新消息：${userMessage}

请基于以上搜索结果回答用户问题。`;

  const messages: ChatMessage[] = [
    { role: 'user', content: contextPrompt },
    ...historyMessages.map<ChatMessage>((m) => ({ role: m.role, content: m.content })),
  ];

  let full = '';
  for await (const chunk of callGLMStream(systemPrompt, messages, 1500, options)) {
    full += chunk;
    onChunk?.(chunk);
  }
  return full;
}

import { SearchResult } from './anysearch';

const GLM_API_KEY = '838b59bb70234f5dbbff4748e6b58714.y6IBHlQe8RHw2gOA';
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export interface FollowUpMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
 */
async function* callGLMStream(
  systemPrompt: string,
  userPrompt: string | ChatMessage[],
  maxTokens: number = 600,
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM API 调用失败: ${response.status} ${errorText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
2. 当引用某条搜索结果的信息时，在引用的内容后面加上上标标记，格式为[数字]，例如[1][2][3]等
3. 上标数字对应搜索结果的序号（1-${results.length}）
4. 保持概括内容连贯自然，不要使用Markdown格式

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
 * 追问对话：基于某条搜索结果的完整内容（标题+URL+原文），与 AI 进行多轮流式对话。
 * historyMessages：历史对话（不含当前系统提示与注入的原文），最后一条应当是最新的 user 提问。
 * onChunk：流式回调，逐 token 推送 AI 回复。
 */
export async function followUpStream(
  result: { title: string; url: string; content: string },
  historyMessages: FollowUpMessage[],
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const systemPrompt =
    '你是锐机超级搜索的 AI 追问助手。用户正在阅读一条搜索结果，会根据页面原文向你追问。' +
    '请基于「参考原文」进行回答，不要编造事实。若原文不足以回答问题，请明确告知用户。' +
    '回答使用简洁的中文，可使用 Markdown 语法（代码块、行内代码、加粗、列表、表格等）来提升可读性。';

  // 把「参考原文」作为多轮对话的第一条 user 消息注入，之后再拼接真实历史
  const contextPrompt = `参考原文（请以此为回答依据）：
标题：${result.title}
URL：${result.url}
原文内容：
${(result.content || '').slice(0, 8000)}

---
后续消息为用户基于此原文的追问，请结合以上原文作答。`;

  const messages: ChatMessage[] = [
    { role: 'user', content: contextPrompt },
    ...historyMessages.map<ChatMessage>((m) => ({ role: m.role, content: m.content })),
  ];

  let full = '';
  for await (const chunk of callGLMStream(systemPrompt, messages, 1500)) {
    full += chunk;
    onChunk?.(chunk);
  }
  return full;
}

/**
 * 基于所有搜索结果的追问对话：把每条结果的标题+URL+摘要拼成上下文，多轮对话。
 */
export async function followUpOverviewStream(
  results: SearchResult[],
  historyMessages: FollowUpMessage[],
  onChunk?: (chunk: string) => void,
): Promise<string> {
  if (!results.length) return '';

  const systemPrompt =
    '你是锐机超级搜索的 AI 追问助手。用户已通过搜索获得多条结果，会基于这些结果的总体概括向你追问。' +
    '请综合所有「参考结果」进行回答，不要编造事实。若信息不足以回答问题，请明确告知用户。' +
    '回答使用简洁的中文，可使用 Markdown 语法（代码块、行内代码、加粗、列表、表格等）来提升可读性。若引用某条结果，可用 [序号] 标注。';

  const snippets = results
    .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    摘要: ${r.snippet}`)
    .join('\n\n');

  const contextPrompt = `参考搜索结果（共 ${results.length} 条，请综合这些信息作答）：

${snippets}

---
后续消息为用户基于以上搜索结果的追问。若引用某条结果，可在回答中用 [序号] 标注。`;

  const messages: ChatMessage[] = [
    { role: 'user', content: contextPrompt },
    ...historyMessages.map<ChatMessage>((m) => ({ role: m.role, content: m.content })),
  ];

  let full = '';
  for await (const chunk of callGLMStream(systemPrompt, messages, 1500)) {
    full += chunk;
    onChunk?.(chunk);
  }
  return full;
}

import { SearchResult } from './anysearch';

const GLM_API_KEY = '838b59bb70234f5dbbff4748e6b58714.y6IBHlQe8RHw2gOA';
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

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

// 总体概括：对多条搜索结果进行综合概述
export async function summarizeOverview(query: string, results: SearchResult[]): Promise<string> {
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

  return callGLM(
    '你是一个专业的搜索结果分析助手，擅长从多条搜索结果中提取关键信息并进行综合概括。',
    prompt,
    1200,
  );
}

// 许可证概括：对LICENSE文件进行摘要，提取允许做和不允许做的内容
export async function summarizeLicense(content: string): Promise<string> {
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

  return callGLM(
    '你是一个专业的软件许可证分析助手，擅长解读开源许可证的条款并进行清晰的总结。',
    prompt,
    800,
  );
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

AnySearch API 的 tag 格式为 {domain}.{sub_domain}，常见方向如下：
- code.doc：代码文档搜索，必填参数 library（如 golang/python/react/vue/java）
- code.repo：代码仓库搜索，参数如 language、topic
- finance.stock：股票行情搜索，参数如 ticker（如 AAPL/600519）、market
- finance.macro：宏观经济数据
- law.case：法律案例搜索
- law.regulation：法律法规搜索
- academic.paper：学术论文搜索，参数如 field、keyword
- academic.patent：专利搜索
- medical.drug：药品信息搜索
- cybersecurity.threat：网络安全威胁情报，参数如 ioc、type
- business.registration：工商注册信息，参数如 company、region
- news.general：新闻资讯搜索

规则：
1. 仅当用户描述明确指向某个垂直领域时，才返回对应 tag 和必填参数
2. 不确定或属于通用信息查询时，tag 返回空字符串（通用搜索）
3. params 中的值根据用户描述填充，无法确定的填空字符串
4. 严格只输出 JSON，不要有任何额外文字

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

// 单条详情概括：对单条网页内容进行概括
export async function summarizeContent(title: string, content: string): Promise<string> {
  if (!content) return '';

  const prompt = `请对以下网页内容进行概括总结，用中文输出，简洁清晰，控制在200字以内。

网页标题：${title}

网页内容：
${content.slice(0, 8000)}

请输出概括：`;

  return callGLM(
    '你是一个专业的网页内容概括助手，擅长从长文本中提取关键信息并用简洁的中文进行概括。',
    prompt,
    600,
  );
}

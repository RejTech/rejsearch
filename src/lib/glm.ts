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

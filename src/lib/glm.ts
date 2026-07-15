const GLM_API_KEY = '838b59bb70234f5dbbff4748e6b58714.y6IBHlQe8RHw2gOA';
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export async function summarizeContent(title: string, content: string): Promise<string> {
  if (!content) return '';

  const prompt = `请对以下网页内容进行概括总结，用中文输出，简洁清晰，控制在200字以内。

网页标题：${title}

网页内容：
${content.slice(0, 8000)}

请输出概括：`;

  const response = await fetch(GLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的网页内容概括助手，擅长从长文本中提取关键信息并用简洁的中文进行概括。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM API 调用失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content || '';
  return summary.trim();
}
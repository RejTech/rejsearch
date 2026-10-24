import { SearchResult } from './anysearch';

const GLM_API_KEY = '838b59bb70234f5dbbff4748e6b58714.y6IBHlQe8RHw2gOA';
// 智谱 API 的 CORS 预检（OPTIONS）不返回 Access-Control-Allow-Origin，浏览器直连会被拦截，
// 统一走同源路径 /api/glm（开发：Vite 代理；生产：Netlify 边缘代理，与 /api/anysearch 同机制）
const GLM_API_URL = '/api/glm/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callGLM(systemPrompt: string, userPrompt: string, maxTokens: number = 600, signal?: AbortSignal): Promise<string> {
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
    signal,
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

// ===== 热搜专家：全平台热搜语义分类板块 =====

/** 一个内容分类板块（AI 语义归类生成） */
export interface HotSearchCategory {
  title: string;     // 板块标题（概括本板块主题）
  summary: string;   // 板块内容摘要（点名代表性事件/人物/产品）
  itemIds: string[]; // 归入本板块的词条 ID（平台前缀+排名，如 w3）
}

/** 送入分类模型的单条词条 */
export interface HotSearchCategoryEntry {
  id: string;       // 词条唯一 ID（与 HotSearchCategory.itemIds 对应）
  platform: string; // 平台名（供模型理解来源语境）
  title: string;    // 热搜标题
}

// 同一期榜单（日期-时间点）只调用一次；失败也缓存，避免渲染循环反复请求，重试用 force 绕过
const hotCategoryCache = new Map<string, HotSearchCategory[] | null>();

// 固定主题分类法 + 关键词表：分组完全在本地瞬时完成（GLM-4-Flash 生成大 JSON 极慢易截断，
// 实测 105 条词条单调用 78s 且 finish=length，故模型绝不参与分组，只负责小组标题/摘要）
const CATEGORY_TAXONOMY: { key: string; title: string; keywords: string[] }[] = [
  { key: 'tech', title: '科技数码', keywords: ['ai', '手机', '苹果', '华为', '小米', 'iphone', '安卓', '芯片', '模型', '机器人', '智能', '科技', '数码', 'openai', '谷歌', '微软', '5g', '电动车', '新能源', '电池', 'spacex', '特斯拉', '比亚迪', '无人机', '处理器', '发布会', 'kimi', 'claude', 'anthropic', '月之暗面', 'minimax', '开源', '大模型', 'gpt', 'deepseek', '阿里', '腾讯', '字节', '漏洞', '补丁', '代码', '开发者', 'api', '权重', '参数', '断网', '红队', '折叠屏', '开售', '显卡', '英伟达', '自动驾驶'] },
  { key: 'ent', title: '娱乐影视', keywords: ['电影', '电视剧', '综艺', '明星', '演员', '歌手', '演唱会', '票房', '导演', '娱乐', '恋情', '结婚', '离婚', '音乐', '专辑', '男团', '女团', '偶像', '新剧', '开播', '主演', '红毯', '华晨宇', '刘宇宁', '肖战', '王一博', '易烊千玺', '赵丽颖', '杨幂', '综艺', '首映', '定档', '票房', '韩剧', '动画', '番剧'] },
  { key: 'sports', title: '体育赛事', keywords: ['足球', '篮球', 'nba', 'cba', '奥运', '世界杯', '比赛', '球员', '球队', '夺冠', '联赛', '体育', '田径', '游泳', '乒乓', '羽毛球', '网球', 'f1', '决赛', '进球', '国足', '中超', '梅西', 'c罗', 'lpl', 's赛', '战队', '失利', '晋级', '冠军', '运动员'] },
  { key: 'finance', title: '财经商业', keywords: ['股市', '股票', '基金', '经济', '金融', '央行', '房价', '楼市', '市值', '上市', '财报', '投资', '美元', '黄金', '油价', '贸易', '创业', '涨停', '股价', '利率', 'a股', '港股', '美股', '加息', '降息', 'gdp', '通胀', '贬值', '汇率', '债券'] },
  { key: 'society', title: '社会民生', keywords: ['警方', '事故', '地震', '天气', '台风', '暴雨', '疫情', '医院', '学校', '教育', '高考', '考试', '交通', '航班', '火车', '法院', '判决', '案件', '退休', '工资', '社保', '遇难', '救援', '通报', '回应', '官方', '男子', '女子', '老人', '孩子', '家长', '老师', '司机', '乘客', '诈骗', '火灾', '失联', '遇难', '西藏', '近海'] },
  { key: 'gaming', title: '游戏电竞', keywords: ['游戏', '电竞', '王者', '英雄', 'lol', '原神', 'steam', '玩家', '皮肤', '赛季', '手游', '网游', 'switch', 'ps5', '黑神话', '和平精英', '吃鸡', '米哈游', '网易游戏'] },
  { key: 'politics', title: '时政国际', keywords: ['总统', '外交', '国际', '美国', '俄罗斯', '日本', '韩国', '朝鲜', '欧洲', '联合国', '战争', '政府', '政策', '关税', '选举', '访华', '会谈', '制裁', '军方', '俄乌', '停火', '伊朗', '以色列', '乌克兰', '北约', '菲', '南海', '台海', '书记', '省委', '任职'] },
  { key: 'life', title: '生活消费', keywords: ['美食', '旅游', '酒店', '景区', '购物', '快递', '外卖', '养生', '健康', '减肥', '化妆', '穿搭', '汽车', '驾照', '假期', '机票', '火锅', '奶茶', '烧烤', '露营', '民宿', '打卡'] },
  { key: 'other', title: '其他热点', keywords: [] },
];

/** 本地归类：标题命中关键词最多的主题胜出，无命中归入「其他热点」 */
function classifyTitle(title: string): string {
  const t = title.toLowerCase();
  let best = 'other';
  let bestScore = 0;
  for (const cat of CATEGORY_TAXONOMY) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (t.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat.key;
    }
  }
  return best;
}

/** 为单个板块生成 AI 标题与摘要（小输出 30 秒超时；失败回退默认标题，不影响整体） */
async function summarizeCategoryGroup(
  defaultTitle: string,
  sample: { platform: string; title: string }[],
): Promise<{ title: string; summary: string }> {
  const lines = sample.map((e) => `${e.platform}｜${e.title.slice(0, 30)}`).join('\n');
  const prompt = `以下热搜词条被归入「${defaultTitle}」方向：

${lines}

请输出 JSON：{"title":"板块名","summary":"一句话摘要"}
要求：
1. title 10 字以内，概括这批词条的共同主题（可比「${defaultTitle}」更精准具体）
2. summary 30-60 字，点名其中最具代表性的事件/人物/产品名称
3. 严格只输出 JSON，不要任何额外文字`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const raw = await callGLM(
      '你是热搜内容分析助手，擅长为一组同主题热搜词条提炼精准的板块名与一句话摘要。',
      prompt,
      150,
      controller.signal,
    );
    const parsed = extractJson(raw);
    if (parsed && typeof parsed.title === 'string' && parsed.title.trim()) {
      return {
        title: parsed.title.trim().slice(0, 20),
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 120) : '',
      };
    }
  } catch {
    // 单组失败：回退默认标题、无摘要
  } finally {
    clearTimeout(timer);
  }
  return { title: defaultTitle, summary: '' };
}

/**
 * 对当期全部平台热搜做语义归类，输出若干板块（标题+摘要+词条 ID）。
 * 混合方案：本地关键词分类器瞬时完成分组（零模型负担、永不失败）；
 * 板块超过 SUBDIVIDE_THRESHOLD 条时本地做第二层共现词聚类自动细分（仍零模型负担）；
 * 各组标题/摘要由 GLM 并发生成（每次输出仅约 80 字，秒级返回），单组失败回退默认标题。
 */
export async function categorizeHotSearch(
  cacheKey: string,
  entries: HotSearchCategoryEntry[],
  force = false,
): Promise<HotSearchCategory[] | null> {
  if (!force) {
    const cached = hotCategoryCache.get(cacheKey);
    if (cached !== undefined) return cached;
  }
  if (!entries.length) return null;

  // 1. 本地分组（瞬时）
  const byId = new Map(entries.map((e) => [e.id, e]));
  const groups = new Map<string, string[]>();
  for (const e of entries) {
    const key = classifyTitle(e.title);
    const list = groups.get(key);
    if (list) list.push(e.id);
    else groups.set(key, [e.id]);
  }
  // 按规模降序取前 8 组（规模即重要性）；「其他热点」为兜底杂项，固定垫底不抢占首位
  const sorted = [...groups.entries()]
    .sort((a, b) => {
      if (a[0] === 'other') return 1;
      if (b[0] === 'other') return -1;
      return b[1].length - a[1].length;
    })
    .slice(0, 8);

  // 2. 超阈值板块二次细分（本地共现词聚类，瞬时）
  interface SectionDef {
    defaultTitle: string;
    itemIds: string[];
    isOther: boolean;
  }
  const sections: SectionDef[] = [];
  for (const [key, itemIds] of sorted) {
    const tax = CATEGORY_TAXONOMY.find((t) => t.key === key) ?? CATEGORY_TAXONOMY[CATEGORY_TAXONOMY.length - 1];
    if (itemIds.length <= SUBDIVIDE_THRESHOLD) {
      sections.push({ defaultTitle: tax.title, itemIds, isOther: key === 'other' });
      continue;
    }
    const subEntries = itemIds
      .map((id) => byId.get(id))
      .filter((e): e is HotSearchCategoryEntry => !!e);
    for (const sub of subclusterByTerms(subEntries)) {
      // 兜底标题：父类名·高频实体词；无实体词的剩余组用「父类名·其他」
      const defaultTitle = sub.term ? `${tax.title}·${sub.term}` : `${tax.title}·其他`;
      sections.push({ defaultTitle, itemIds: sub.ids, isOther: key === 'other' && !sub.term });
    }
  }
  // 细分后重新排序：规模降序，兜底杂项仍垫底；总量封顶 12 个板块
  const ordered = sections
    .sort((a, b) => {
      if (a.isOther !== b.isOther) return a.isOther ? 1 : -1;
      return b.itemIds.length - a.itemIds.length;
    })
    .slice(0, 12);

  // 3. 各板块 AI 标题/摘要：并发池限流 4 路（端侧对高并发小请求会排队拖慢）；
  //    40s 整体看门狗——超时先用默认标题兜底渲染，UI 绝不悬挂
  const withDefaults: HotSearchCategory[] = ordered.map(({ defaultTitle, itemIds }) => ({
    title: defaultTitle,
    summary: '',
    itemIds,
  }));
  const generate = async ({ defaultTitle, itemIds }: (typeof ordered)[number]): Promise<HotSearchCategory> => {
    const sample = itemIds
      .map((id) => byId.get(id))
      .filter((e): e is HotSearchCategoryEntry => !!e)
      .slice(0, 25);
    const { title, summary } = await summarizeCategoryGroup(defaultTitle, sample);
    return { title, summary, itemIds };
  };
  const categories: HotSearchCategory[] = await Promise.race([
    mapPool(ordered, 4, generate),
    new Promise<HotSearchCategory[]>((resolve) => setTimeout(() => resolve(withDefaults), 40000)),
  ]);

  const result = categories.length ? categories : null;
  hotCategoryCache.set(cacheKey, result);
  return result;
}

/** 板块词条数超过该阈值时触发二次细分 */
const SUBDIVIDE_THRESHOLD = 20;
/** 单个板块最多细分出的子板块数 */
const MAX_SUBGROUPS = 6;

// 共现词停用字：含这些字的词组不携带实体信息（避免「的了在」之类伪词当选主题词）
const TERM_STOP_CHARS = /[的了是在有和就都也不与及或等被把对很又但及其你我他她它们这那什怎么啊吗吧呢哦哪还也要会能可以没无不为于之乎其者所的]/;

/** 提取标题中的候选实体词：拉丁词（≥2 字符）与中文连续片段的 2-4 gram */
function extractTerms(title: string): Set<string> {
  const terms = new Set<string>();
  for (const m of title.toLowerCase().matchAll(/[a-z0-9][a-z0-9.+-]{1,}/g)) {
    terms.add(m[0]);
  }
  for (const m of title.matchAll(/[一-鿿]{2,}/g)) {
    const s = m[0];
    for (let len = 2; len <= 4 && len <= s.length; len++) {
      for (let i = 0; i + len <= s.length; i++) {
        const gram = s.slice(i, i + len);
        if (!TERM_STOP_CHARS.test(gram)) terms.add(gram);
      }
    }
  }
  return terms;
}

/**
 * 第二层本地聚类：统计组内实体词文档频次，按高频词贪心划分共享该词的词条；
 * 未被任何高频词覆盖的词条进剩余组（term=''）。全程本地计算，瞬时完成。
 */
function subclusterByTerms(entries: HotSearchCategoryEntry[]): { term: string; ids: string[] }[] {
  const itemTerms = entries.map((e) => ({ id: e.id, terms: extractTerms(e.title) }));
  const df = new Map<string, number>();
  for (const it of itemTerms) {
    for (const t of it.terms) df.set(t, (df.get(t) ?? 0) + 1);
  }
  // 高频词候选：至少覆盖 2 条；频次优先，同频次取长词（更具体）
  const candidates = [...df.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const assigned = new Set<string>();
  const clusters: { term: string; ids: string[] }[] = [];
  for (const [term] of candidates) {
    if (clusters.length >= MAX_SUBGROUPS) break;
    const ids = itemTerms.filter((it) => !assigned.has(it.id) && it.terms.has(term)).map((it) => it.id);
    if (ids.length < 2) continue;
    ids.forEach((id) => assigned.add(id));
    clusters.push({ term, ids });
  }
  const rest = itemTerms.filter((it) => !assigned.has(it.id)).map((it) => it.id);
  if (rest.length) clusters.push({ term: '', ids: rest });
  return clusters;
}

/** 简单并发池：最多 limit 路并发执行 fn，保持结果顺序 */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

// ===== AI 自搜关键词的相关性护栏 =====
// 通用检索词：单独出现时不携带任何实体信息。
// 典型故障：用户问「小米 YU7 这款产品怎么样」，提取结果退化成只搜「产品」。
const GENERIC_TERMS = [
  '值得买吗', '值得买', '好不好', '哪个好', '怎么样', '用户反馈', '使用体验', '使用方法',
  '推荐一下', '介绍一下', '具体参数', '优缺点', '区别对比',
  '产品', '商品', '东西', '品牌', '评测', '测评', '评估', '推荐', '选购', '购买',
  '价格', '报价', '多少钱', '售价', '优点', '缺点', '参数', '规格', '配置', '性能',
  '功能', '体验', '口碑', '评价', '评论', '如何', '是什么', '为什么', '区别', '对比',
  '排名', '榜单', '最新', '资讯', '新闻', '介绍', '科普', '教程', '有哪些', '大全',
  '汇总', '趋势', '前景',
];

// 问句里的语气词前缀，作为兜底检索词时剥离
const PLEASANTRY_PREFIXES = [
  '请问', '麻烦', '帮忙', '帮我', '我想知道', '想知道', '想了解', '了解一下', '介绍一下',
  '告诉我', '能否', '可以', '请',
];

/** 归一化：去掉标点与空白、英文转小写，仅保留中英文与数字 */
function normalizeQueryText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
}

/** 去除通用词（长词优先，避免「值得买」被短词拆碎），保留实体片段 */
function stripGenericTerms(text: string): string {
  let s = text.toLowerCase();
  for (const term of [...GENERIC_TERMS].sort((a, b) => b.length - a.length)) {
    s = s.split(term).join(' ');
  }
  return s;
}

/** 关键词是否只是通用词：去掉通用词后剩余有效字符不足 2 个即不含实体 */
function isGenericOnly(query: string): boolean {
  return normalizeQueryText(stripGenericTerms(query)).length < 2;
}

/** 关键词是否仍锚定原问题：英文/型号 token 或 ≥2 字中文片段命中原问题 */
function sharesEntityWithSource(query: string, source: string): boolean {
  const q = normalizeQueryText(stripGenericTerms(query));
  const s = normalizeQueryText(source);
  if (q.length < 2) return false;
  const latinTokens = q.match(/[a-z0-9]{2,}/g) ?? [];
  if (latinTokens.some((t) => s.includes(t))) return true;
  const cjkChunks = q.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  return cjkChunks.some((c) => s.includes(c));
}

/** 清理原问题：去语气词与尾部标点，作为兜底检索词 */
function cleanUserQuery(text: string): string {
  let s = text.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of PLEASANTRY_PREFIXES) {
      if (s.startsWith(p)) {
        s = s.slice(p.length).trim();
        changed = true;
        break;
      }
    }
  }
  return s.replace(/[?？!！。.,，、;；:：\s]+$/g, '').slice(0, 60);
}

/**
 * AI 自搜模式：从用户自然语言消息中提取搜索关键词（可多个）。
 * 返回 1-3 个关键词，按优先级排序；每条都必须保留原问题中的核心实体，
 * 只含通用词（如「产品」「评测」）的关键词会被丢弃并回退到原问题。
 */
export async function extractSearchQueries(userMessage: string): Promise<string[]> {
  const trimmed = userMessage.trim();
  if (!trimmed) return [];

  const prompt = `你是搜索关键词提取助手。根据用户的问题，提取最适合用于搜索引擎检索的关键词。

最关键的规则：**每条关键词都必须原样保留用户问题中的核心实体**——品牌、产品/型号、人名、机构、作品、地名、技术名等。绝不能把实体删掉换成通用词。
反例（禁止）：用户问「小米 YU7 这款产品值得买吗」，却输出「产品」或「产品评测」——这丢掉了实体，搜索结果会完全跑偏。

规则：
1. 返回 1-3 条关键词，按重要性排序；每条都是可直接提交给搜索引擎的独立查询
2. 每条都必须包含原问题中的实体（专有名词/型号/人名等），不得替换、泛指或省略
3. 严禁输出只由通用词构成的关键词（如「产品」「评测」「推荐」「价格」「怎么样」「优缺点」）；通用词只能与实体组合出现
4. 去掉「请问」「帮我」「介绍一下」等语气词与疑问句式
5. 可在同一实体上补充不同侧面（如评测、价格、对比），但不要引入与原问题无关的主题
6. 若问题只涉及单一主题，只返回 1 条
7. 严格只输出 JSON 数组，不要任何额外文字

示例：
输入：小米 YU7 这款产品值得买吗
输出：["小米 YU7 评测", "小米 YU7 价格", "小米 YU7 优缺点"]

输入：帮我介绍一下 Notion
输出：["Notion 介绍"]

输入：2026 年诺贝尔物理学奖颁给了谁
输出：["2026年诺贝尔物理学奖"]

用户消息：${trimmed}

请输出 JSON 数组：`;

  const raw = await callGLM(
    '你是搜索关键词提取助手。你的第一原则是保留用户问题中的专有名词与核心实体，绝不把实体替换成「产品」「评测」这类通用词。',
    prompt,
    200,
  );

  // 兜底：清掉语气词后的原问题（保证至少有一次搜索紧扣用户问题）
  const fallback = [cleanUserQuery(trimmed) || trimmed];

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return fallback;

  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return fallback;

    const candidates = arr
      .filter((s): s is string => typeof s === 'string' && !!s.trim())
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .slice(0, 6);

    // 相关性护栏：丢弃「只有通用词」与「未保留原问题实体」的关键词
    const kept: string[] = [];
    const seen = new Set<string>();
    for (const q of candidates) {
      const key = normalizeQueryText(q);
      if (!key || seen.has(key)) continue;
      if (isGenericOnly(q)) continue;
      if (!sharesEntityWithSource(q, trimmed)) continue;
      seen.add(key);
      kept.push(q);
      if (kept.length >= 3) break;
    }

    return kept.length > 0 ? kept : fallback;
  } catch {
    // 解析失败回退
    return fallback;
  }
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
    '你是 RemoSearch 的 AI 自搜助手。用户提出问题，系统已根据用户需求自动执行了多次搜索。' +
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

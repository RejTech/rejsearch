// AnySearch REST API 客户端
// 文档: https://www.anysearch.com/docs
// Base URL: https://api.anysearch.com
// 端点: POST /v1/search

const API_KEY = 'as_sk_66a3631c2e8124cebdd66dd45f9aec13';
// AnySearch API 不支持浏览器 CORS，统一走同源路径 /api/anysearch：
// - 开发环境：Vite 代理（vite.config.ts server.proxy）
// - 生产环境（Netlify）：public/_redirects 边缘代理
const API_BASE_URL = '/api/anysearch';
const SEARCH_ENDPOINT = '/v1/search';

/** 单条搜索结果（文档定义字段） */
export interface SearchResult {
  title: string;   // 结果标题
  url: string;     // 原始来源 URL
  snippet: string; // 简短摘要
  content: string; // 清洗后的正文内容
  // 兼容字段（文档未明确，API 可能返回，前端按需使用）
  source?: string;
  timestamp?: string;
  score?: number;
}

/** 搜索元数据 */
export interface SearchMetadata {
  totalResults: number; // 返回结果总数
  searchTimeMs: number; // 端到端搜索耗时（毫秒）
}

/** 搜索响应 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  requestId: string;
  metadata: SearchMetadata;
}

/** 搜索请求参数（对齐文档 Request parameters） */
export interface SearchOptions {
  query: string;                              // 必填，搜索查询词
  maxResults?: number;                        // 可选，返回条数，默认 10，范围 1-20
  tag?: string;                               // 可选，子领域能力标签，如 "code.doc"
  zone?: 'cn' | 'intl';                       // 可选，区域
  language?: string;                          // 可选，偏好语言，如 "zh-CN" / "en"
  params?: Record<string, unknown>;           // 可选，透传给 AnyMix 的扩展参数
  format?: 'json' | 'markdown';               // 可选，输出格式，默认 json
}

/** AnySearch 统一错误（含文档定义的 code / request_id） */
export class AnySearchError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(code: string, message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'AnySearchError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

// 文档错误码 -> 友好提示
const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: '请求参数无效，请检查搜索关键词',
  invalid_extract_url: '提取链接无效',
  invalid_api_key: 'API Key 无效，请检查配置',
  invalid_auth_header: '认证头格式无效',
  daily_free_quota_exhausted: '匿名免费额度已用尽',
  quota_exhausted: 'API 额度已用尽',
  rate_limited: '请求过于频繁，请稍后重试',
};

/** 文档 POST /v1/search（内部实现，不含回退） */
async function _search(options: SearchOptions): Promise<SearchResponse> {
  const {
    query,
    maxResults = 10,
    tag,
    zone,
    language = 'zh-CN',
    params,
    format = 'json',
  } = options;

  if (!query || !query.trim()) {
    throw new AnySearchError('invalid_request', '搜索关键词不能为空', 400);
  }

  // 文档: max_results 范围 1-20
  const clampedMax = Math.max(1, Math.min(20, Math.floor(maxResults)));

  const body: Record<string, unknown> = {
    query,
    max_results: clampedMax,
    language,
    format,
  };
  if (tag) body.tag = tag;
  if (zone) body.zone = zone;
  if (params) body.params = params;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${SEARCH_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AnySearchError('network_error', '网络连接失败，请检查网络', 0);
  }

  // 解析响应体（成功与失败均为 JSON）
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // 非 JSON 响应
  }

  const requestId: string | undefined = data?.request_id;

  // 文档: HTTP 非 2xx 为错误，429 携带 Retry-After
  if (!response.ok) {
    const code: string = data?.code ?? 'unknown';
    const rawMessage: string = data?.message ?? '';
    // 429 限流附带等待时间提示
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const hint = retryAfter ? `（请在 ${retryAfter} 秒后重试）` : '';
      throw new AnySearchError(
        'rate_limited',
        `${ERROR_MESSAGES.rate_limited}${hint}`,
        429,
        requestId,
      );
    }
    const friendly = ERROR_MESSAGES[code] ?? (rawMessage || `搜索失败（HTTP ${response.status}）`);
    throw new AnySearchError(code, friendly, response.status, requestId);
  }

  // 文档: code !== 0 为业务错误
  if (!data || data.code !== 0) {
    const message = data?.message || '搜索失败';
    throw new AnySearchError(
      data?.code ?? 'unknown',
      message,
      response.status,
      requestId,
    );
  }

  const results: SearchResult[] = data.data?.results ?? [];
  const metadata = data.data?.metadata ?? {};

  return {
    results,
    total: metadata.total_results ?? results.length,
    query,
    requestId: requestId ?? '',
    metadata: {
      totalResults: metadata.total_results ?? results.length,
      searchTimeMs: metadata.search_time_ms ?? 0,
    },
  };
}

/**
 * 文档 POST /v1/search
 * 带 tag 回退：若 tag/params 导致 400（无效 tag 或缺少必填参数），自动回退到通用搜索。
 */
export async function search(options: SearchOptions): Promise<SearchResponse> {
  try {
    return await _search(options);
  } catch (err) {
    // tag 相关错误（无效 tag / 缺少必填参数）→ 回退到通用搜索
    if (
      err instanceof AnySearchError &&
      err.status === 400 &&
      (options.tag || options.params)
    ) {
      return await _search({
        ...options,
        tag: undefined,
        params: undefined,
      });
    }
    throw err;
  }
}

/** 内嵌部件可配置项 */
export interface EmbedConfig {
  showTitle: boolean;          // 是否显示标题和副标题
  showGLM: boolean;            // 是否显示 GLM-4 摘要（总体概括 + 详情摘要）
  showLicense: boolean;        // 是否显示许可证信息
  showVersion: boolean;        // 是否显示版本号
  allowInlineSearch: boolean;  // 是否允许内嵌页面内搜索（false 则跳转主页）
  showHotSearch: boolean;      // 是否显示「锐机热搜专家」（按日期选择热搜进入检索工作流）
}

export const DEFAULT_EMBED_CONFIG: EmbedConfig = {
  showTitle: true,
  showGLM: true,
  showLicense: true,
  showVersion: true,
  allowInlineSearch: true,
  showHotSearch: true,
};

/** 从 URL 查询参数解析内嵌配置（未指定时默认为 true） */
export function parseEmbedConfig(search: string): EmbedConfig {
  const params = new URLSearchParams(search);
  return {
    showTitle: params.get('title') !== 'false',
    showGLM: params.get('glm') !== 'false',
    showLicense: params.get('license') !== 'false',
    showVersion: params.get('version') !== 'false',
    allowInlineSearch: params.get('search') !== 'false',
    showHotSearch: params.get('hotsearch') !== 'false',
  };
}

/** 根据配置生成内嵌页面的 URL */
export function buildEmbedUrl(baseUrl: string, config: EmbedConfig): string {
  const params = new URLSearchParams();
  if (!config.showTitle) params.set('title', 'false');
  if (!config.showGLM) params.set('glm', 'false');
  if (!config.showLicense) params.set('license', 'false');
  if (!config.showVersion) params.set('version', 'false');
  if (!config.allowInlineSearch) params.set('search', 'false');
  if (!config.showHotSearch) params.set('hotsearch', 'false');
  const qs = params.toString();
  return qs ? `${baseUrl}/embed?${qs}` : `${baseUrl}/embed`;
}

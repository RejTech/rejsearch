interface WatermarkProps {
  /** 水印文字，默认「AI生成 仅供参考」 */
  text?: string;
  /** 旋转角度（度），默认 -28 */
  rotate?: number;
  /** 文字大小（px），默认 12 */
  size?: number;
  /** 水印行间距（px），默认 36 */
  rowGap?: number;
  /** 文字间距（px），默认 8 */
  charGap?: number;
  /** 透明度 0-1，默认 0.12 */
  opacity?: number;
  /** 文字颜色 class，默认 gray-500（亮色）/ gray-300（暗色） */
  colorClass?: string;
}

/**
 * 斜向重复文字水印。
 * 父容器需要 `relative overflow-hidden`，水印会铺满父容器。
 * 水印 pointer-events-none，不影响交互，z-0 位于内容下方。
 */
export function Watermark({
  text = 'AI生成 仅供参考',
  rotate = -28,
  size = 12,
  rowGap = 36,
  charGap = 8,
  opacity = 0.12,
  colorClass = 'text-gray-500 dark:text-gray-300',
}: WatermarkProps = {}) {
  // 单行重复多次水印文字，确保横向铺满
  const unit = text + ' '.repeat(Math.max(1, Math.floor(charGap / 2)));
  const line = unit.repeat(8);

  // 行数足够覆盖旋转后容器（旋转 -28° 时对角线最长，约 1.5 倍）
  const rows = 40;

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden z-0"
      style={{ opacity }}
    >
      <div
        className={`absolute left-1/2 top-1/2 whitespace-nowrap font-mono ${colorClass} select-none`}
        style={{
          transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
          fontSize: `${size}px`,
          letterSpacing: `${charGap}px`,
          lineHeight: `${rowGap}px`,
          textAlign: 'center',
        }}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

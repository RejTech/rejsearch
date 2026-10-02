// 轻量音效：单次即响（用户手势后触发），复用 Audio 实例；连续触发时立即重头播放。
// 所有调用均吞掉异常（自动播放策略/解码失败不影响主流程）。
import liftUrl from '../assets/sounds/bencho-lift.wav?url';
import perkUrl from '../assets/sounds/bencho-perk.wav?url';

let liftAudio: HTMLAudioElement | null = null;
let perkAudio: HTMLAudioElement | null = null;
const supported = typeof window !== 'undefined' && typeof Audio !== 'undefined';

function playOnce(getter: () => HTMLAudioElement) {
  if (!supported) return;
  try {
    const audio = getter();
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* 自动播放被拒绝等：静默忽略 */
    });
  } catch {
    /* ignore */
  }
}

/** 底栏切换模式音效 */
export function playLift() {
  playOnce(() => (liftAudio ??= new Audio(liftUrl)));
}

/** AI 回答完成音效 */
export function playPerk() {
  playOnce(() => (perkAudio ??= new Audio(perkUrl)));
}

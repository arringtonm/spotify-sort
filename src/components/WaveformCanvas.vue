<template>
  <div
    ref="root"
    class="relative w-full touch-none select-none"
    :class="interactive && 'cursor-pointer'"
    :style="{ height: `${height}px` }"
    :role="interactive ? 'slider' : 'img'"
    :tabindex="interactive ? 0 : undefined"
    :aria-label="interactive ? 'Playback position' : 'Waveform'"
    :aria-valuemin="interactive ? 0 : undefined"
    :aria-valuemax="interactive ? Math.round(duration) : undefined"
    :aria-valuenow="interactive ? Math.round(progress * duration) : undefined"
    :aria-valuetext="interactive ? `${clock(progress * duration)} of ${clock(duration)}` : undefined"
    @pointerdown="onPointerDown"
    @keydown="onKeydown"
  >
    <canvas
      ref="canvas"
      class="absolute inset-0 size-full"
      aria-hidden="true"
    />
    <div
      v-if="!waveform"
      class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-surface-3"
      aria-hidden="true"
    >
      <div
        class="h-full bg-accent"
        :class="loading && 'animate-pulse'"
        :style="{ width: `${progress * 100}%` }"
      />
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { resample, binColor, CHANNELS } from '@/lib/waveform.js';

/**
 * Serato-style coloured waveform: each column's height is loudness, its colour
 * the mix of bass (red), mids (green) and treble (blue).
 *
 * The full waveform is drawn once per size into an offscreen canvas; each frame
 * only composites that bitmap with the played portion dimmed and a playhead, so
 * playback costs two drawImage calls rather than redrawing thousands of bars.
 */
const props = defineProps({
  waveform: { type: Object, default: null },
  progress: { type: Number, default: 0 },
  duration: { type: Number, default: 30 },
  height: { type: Number, default: 48 },
  interactive: Boolean,
  loading: Boolean,
});
const emit = defineEmits(['seek']);

const root = ref(null);
const canvas = ref(null);
let bitmap = null;
let size = { w: 0, h: 0, dpr: 1 };

/** One column per CSS pixel: a continuous shape, like Serato's overview. */
const BAR = 1;
const GAP = 0;
/** Colour is averaged over neighbouring columns so it reads as sections, not noise. */
const COLOR_SMOOTHING = 2;

function renderBitmap() {
  bitmap = null;
  if (!props.waveform || !size.w) return;
  const { w, h, dpr } = size;
  const columns = Math.max(1, Math.floor(w / (BAR + GAP)));
  const cols = resample(props.waveform, columns);
  const off = document.createElement('canvas');
  off.width = Math.round(w * dpr);
  off.height = Math.round(h * dpr);
  const ctx = off.getContext('2d');
  ctx.scale(dpr, dpr);
  const mid = h / 2;
  for (let c = 0; c < columns; c += 1) {
    const i = c * CHANNELS;
    const peak = cols[i] / 255;
    let low = 0;
    let midBand = 0;
    let high = 0;
    let n = 0;
    for (let k = Math.max(0, c - COLOR_SMOOTHING); k <= Math.min(columns - 1, c + COLOR_SMOOTHING); k += 1) {
      low += cols[k * CHANNELS + 1];
      midBand += cols[k * CHANNELS + 2];
      high += cols[k * CHANNELS + 3];
      n += 1;
    }
    const [r, g, b] = binColor(low / n, midBand / n, high / n);
    const half = Math.max(0.5, peak * (mid - 1));
    ctx.fillStyle = `rgb(${r} ${g} ${b})`;
    // Mirrored about the centre line, like every DJ overview waveform.
    ctx.fillRect(c * (BAR + GAP), mid - half, BAR + 0.5, half * 2);
  }
  bitmap = off;
}

function draw() {
  const el = canvas.value;
  if (!el) return;
  const ctx = el.getContext('2d');
  const { w, h, dpr } = size;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, el.width, el.height);
  if (!bitmap) return;
  ctx.drawImage(bitmap, 0, 0);
  const x = Math.round(props.progress * w * dpr);
  if (x > 0) {
    // Dim what's been played, the convention in Serato/rekordbox overviews.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgb(0 0 0 / 0.55)';
    ctx.fillRect(0, 0, x, h * dpr);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (props.interactive) {
    ctx.fillStyle = getComputedStyle(root.value).getPropertyValue('--text') || '#fff';
    ctx.fillRect(Math.max(0, x - dpr), 0, 2 * dpr, h * dpr);
  }
}

function resize() {
  const el = root.value;
  if (!el || !canvas.value) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = el.clientWidth;
  const h = props.height;
  if (w === size.w && h === size.h && dpr === size.dpr) return;
  size = { w, h, dpr };
  canvas.value.width = Math.round(w * dpr);
  canvas.value.height = Math.round(h * dpr);
  renderBitmap();
  draw();
}

useResizeObserver(root, resize);
onMounted(resize);
watch(
  () => props.waveform,
  () => {
    renderBitmap();
    draw();
  }
);
let frame = 0;
watch(
  () => props.progress,
  () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }
);
onBeforeUnmount(() => cancelAnimationFrame(frame));

// ---- Seeking ----------------------------------------------------------------
function fractionAt(event) {
  const rect = root.value.getBoundingClientRect();
  return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
}

function onPointerDown(event) {
  if (!props.interactive) return;
  root.value.setPointerCapture?.(event.pointerId);
  emit('seek', fractionAt(event));
  const move = (e) => emit('seek', fractionAt(e));
  const up = () => {
    root.value?.removeEventListener('pointermove', move);
    root.value?.removeEventListener('pointerup', up);
    root.value?.removeEventListener('pointercancel', up);
  };
  root.value.addEventListener('pointermove', move);
  root.value.addEventListener('pointerup', up);
  root.value.addEventListener('pointercancel', up);
}

function onKeydown(event) {
  if (!props.interactive || !props.duration) return;
  const step = event.shiftKey ? 5 : 1;
  const now = props.progress * props.duration;
  const map = {
    ArrowRight: now + step,
    ArrowUp: now + step,
    ArrowLeft: now - step,
    ArrowDown: now - step,
    Home: 0,
    End: props.duration,
  };
  if (!(event.key in map)) return;
  event.preventDefault();
  emit('seek', Math.min(1, Math.max(0, map[event.key] / props.duration)));
}

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
</script>

<template>
  <div
    ref="root"
    role="group"
    :aria-label="label"
    class="relative mx-auto aspect-square w-full max-w-[340px] select-none"
    @keydown="onKeydown"
  >
    <svg
      viewBox="0 0 300 300"
      class="size-full overflow-visible"
      aria-hidden="false"
    >
      <g
        v-for="(seg, i) in segments"
        :key="seg.code"
        :ref="(el) => (refs[i] = el)"
        :role="single ? 'radio' : 'checkbox'"
        :aria-checked="isOn(seg.code)"
        :aria-label="ariaFor(seg)"
        :aria-disabled="disabled || undefined"
        :tabindex="disabled ? -1 : i === focusIndex ? 0 : -1"
        class="cursor-pointer outline-none [&:focus-visible>path]:stroke-[var(--text)] [&:focus-visible>path]:stroke-[2.5]"
        @click="toggle(seg.code, i)"
        @focus="focusIndex = i"
      >
        <path
          :d="seg.path"
          :fill="isOn(seg.code) ? keyColor(seg.code) : 'var(--surface-2)'"
          :stroke="isOn(seg.code) ? 'var(--surface)' : 'var(--border)'"
          stroke-width="1.5"
          class="transition-[fill] duration-150"
          :class="!isOn(seg.code) && 'hover:fill-[var(--surface-3)]'"
        />
        <text
          :x="seg.lx"
          :y="seg.ly"
          text-anchor="middle"
          dominant-baseline="central"
          class="pointer-events-none font-mono text-[12.5px] font-semibold"
          :fill="isOn(seg.code) ? 'oklch(0.18 0.02 270)' : 'var(--muted)'"
        >{{ seg.code }}</text>
        <text
          v-if="counts && counts[seg.code]"
          :x="seg.cx"
          :y="seg.cy"
          text-anchor="middle"
          dominant-baseline="central"
          class="pointer-events-none text-[8.5px] font-medium tabular"
          :fill="isOn(seg.code) ? 'oklch(0.18 0.02 270 / 0.7)' : 'var(--subtle)'"
        >{{ counts[seg.code] }}</text>
      </g>
      <circle
        cx="150"
        cy="150"
        :r="R_CORE"
        fill="var(--surface)"
        stroke="var(--border)"
      />
    </svg>
    <div
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
      aria-hidden="true"
    >
      <slot name="center">
        <span class="text-2xl font-semibold tabular">{{ centerValue }}</span>
        <span class="text-[11px] text-muted">{{ centerLabel }}</span>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { keyColor } from '@/lib/keyColors.js';
import { fromCamelotCode } from '@/lib/camelot.js';
import { displayName } from '@/lib/musicalKey.js';

/**
 * The Camelot wheel as the key filter, because it *is* the mental model: DJs
 * think "8A and its neighbours", which is a contiguous arc here and a scattered
 * selection in a grid of chips. Outer ring is major (B), inner ring minor (A),
 * positions sit like a clock face.
 *
 * Keyboard: one tab stop (roving tabindex). ←/→ move round the ring, ↑/↓ switch
 * rings, Space/Enter toggles.
 */
const props = defineProps({
  /** Array of codes (multi) or a single code / null (single). */
  modelValue: { type: [Array, String], default: () => [] },
  single: Boolean,
  disabled: Boolean,
  label: { type: String, default: 'Camelot keys' },
  /** Optional { '8A': 12, ... } shown under each code. */
  counts: { type: Object, default: null },
  centerValue: { type: [String, Number], default: '' },
  centerLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const R_OUTER = 148;
const R_MID = 104;
const R_INNER = 62;
const R_CORE = 58;

function polar(r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [150 + r * Math.cos(rad), 150 + r * Math.sin(rad)];
}

function arc(r0, r1, a0, a1) {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

// Order: 1B..12B (outer), then 1A..12A (inner) — matches arrow-key navigation.
const segments = computed(() => {
  const out = [];
  for (const [letter, r0, r1] of [
    ['B', R_MID, R_OUTER],
    ['A', R_INNER, R_MID],
  ]) {
    for (let p = 1; p <= 12; p += 1) {
      const centre = p * 30;
      // Code and count sit on the same radial line: code outward, count inward,
      // so the pair reads the same way up at any position round the wheel.
      const mid = (r0 + r1) / 2;
      const [lx, ly] = polar(props.counts ? mid + 5 : mid, centre);
      const [cx, cy] = polar(mid - 11, centre);
      out.push({
        code: `${p}${letter}`,
        path: arc(r0, r1, centre - 15, centre + 15),
        lx,
        ly,
        cx,
        cy,
      });
    }
  }
  return out;
});

const selected = computed(() =>
  props.single ? (props.modelValue ? [props.modelValue] : []) : props.modelValue
);

function isOn(code) {
  return selected.value.includes(code);
}

function ariaFor(seg) {
  const parsed = fromCamelotCode(seg.code);
  const name = parsed
    ? `${displayName(parsed.pitchClass)} ${parsed.mode === 'maj' ? 'major' : 'minor'}`
    : '';
  const n = props.counts?.[seg.code];
  return `${seg.code}, ${name}${n != null ? `, ${n} tracks` : ''}`;
}

const focusIndex = ref(Math.max(0, segments.value.findIndex((s) => isOn(s.code))));
const refs = [];
const root = ref(null);

function toggle(code, index) {
  if (props.disabled) return;
  focusIndex.value = index;
  if (props.single) {
    emit('update:modelValue', props.modelValue === code ? null : code);
    return;
  }
  emit(
    'update:modelValue',
    isOn(code) ? props.modelValue.filter((c) => c !== code) : [...props.modelValue, code]
  );
}

function onKeydown(event) {
  if (props.disabled) return;
  const i = focusIndex.value;
  const ring = i < 12 ? 0 : 12;
  const pos = i % 12;
  let next;
  switch (event.key) {
    case 'ArrowRight':
      next = ring + ((pos + 1) % 12);
      break;
    case 'ArrowLeft':
      next = ring + ((pos + 11) % 12);
      break;
    case 'ArrowUp':
      next = pos; // outer
      break;
    case 'ArrowDown':
      next = 12 + pos; // inner
      break;
    case ' ':
    case 'Enter':
      event.preventDefault();
      toggle(segments.value[i].code, i);
      return;
    default:
      return;
  }
  event.preventDefault();
  focusIndex.value = next;
  refs[next]?.focus();
}
</script>

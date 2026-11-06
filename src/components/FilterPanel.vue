<template>
  <div :class="dense ? 'space-y-5' : 'space-y-7'">
    <!-- Which library: shown once there's more than one source. -->
    <section
      v-if="filters.hasMultipleSources"
      aria-labelledby="f-source"
      class="space-y-3"
    >
      <h3
        id="f-source"
        class="text-sm font-semibold"
      >
        Source
      </h3>
      <div
        role="radiogroup"
        aria-labelledby="f-source"
        class="flex flex-wrap gap-2"
      >
        <button
          v-for="option in SOURCE_FILTERS"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="filters.sourceFilter === option.value"
          class="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors pointer-coarse:h-10 aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:text-text border-border text-muted hover:border-border-strong hover:text-text"
          @click="filters.sourceFilter = option.value"
        >
          {{ option.label }}
          <span class="text-xs text-subtle tabular">{{ filters.sourceCounts[option.value].toLocaleString() }}</span>
        </button>
      </div>
    </section>

    <!-- Repeats: keep new mixtapes fresh. Remembered between launches. -->
    <section
      v-if="usageCount"
      aria-labelledby="f-repeats"
      class="space-y-2"
    >
      <h3
        id="f-repeats"
        class="text-sm font-semibold"
      >
        Repeats
      </h3>
      <Switch
        v-model="filters.hideUsed"
        label="Hide tracks used in past mixtapes"
        :hint="`${usageCount.toLocaleString()} tracks are in your past mixtapes. When shown, they're marked and suggested last.`"
      />
    </section>

    <!-- In mix mode key and tempo come from the seed track (see SeedCard). -->
    <template v-if="!filters.seedTrack">
      <section aria-labelledby="f-key">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3
            id="f-key"
            class="text-sm font-semibold"
          >
            Key <span class="font-normal text-muted">(Camelot)</span>
          </h3>
          <span class="text-xs text-muted tabular">
            {{ filters.allKeysSelected ? 'All 24' : `${filters.selectedCodes.length} of 24` }}
          </span>
        </div>
        <CamelotWheel
          v-model="filters.selectedCodes"
          label="Filter by key"
          :max-size="dense ? 'clamp(220px, calc(100dvh - 470px), 320px)' : '340px'"
          :counts="keyCounts"
          :center-value="filters.selectedCodes.length"
          center-label="keys"
        />
        <!-- Fixed set of buttons (never added/removed) and one reserved
             status line, so toggling keys never moves anything below. -->
        <div class="mt-3 grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="secondary"
            :disabled="filters.allKeysSelected"
            @click="filters.selectAllKeys()"
          >
            All
          </Button>
          <Button
            size="sm"
            variant="secondary"
            :disabled="!filters.selectedCodes.length"
            @click="filters.clearKeys()"
          >
            Clear
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="filters.selectedCodes.length !== 1"
            @click="filters.selectCompatibleWith(filters.selectedCodes[0])"
          >
            <Plus /> Mixable
          </Button>
        </div>
        <p
          class="mt-1.5 min-h-10 text-xs leading-5 text-muted"
          aria-live="polite"
        >
          {{ keyHint }}
        </p>
      </section>

      <section aria-labelledby="f-tempo">
        <h3
          id="f-tempo"
          class="mb-0.5 text-sm font-semibold"
        >
          Tempo <span class="font-normal text-muted">(BPM)</span>
        </h3>
        <!-- Min field · slider · max field on one row: exact entry and a
             quick drag without spending three rows of height. -->
        <div class="flex items-center gap-3">
          <div class="w-[4.25rem] shrink-0">
            <TextInput
              :model-value="tempo[0]"
              type="number"
              inputmode="numeric"
              :min="filters.bpmMin"
              :max="tempo[1]"
              aria-label="Minimum BPM"
              class="px-2 text-center tabular"
              @change="setBound(0, $event.target.value)"
            />
          </div>
          <RangeSlider
            v-model="tempo"
            :min="filters.bpmMin"
            :max="filters.bpmMax"
            :thumb-labels="['Minimum BPM', 'Maximum BPM']"
          />
          <div class="w-[4.25rem] shrink-0">
            <TextInput
              :model-value="tempo[1]"
              type="number"
              inputmode="numeric"
              :min="tempo[0]"
              :max="filters.bpmMax"
              aria-label="Maximum BPM"
              class="px-2 text-center tabular"
              @change="setBound(1, $event.target.value)"
            />
          </div>
        </div>
        <div class="mt-1">
          <Switch
            v-model="filters.matchMultiples"
            label="Include half- and double-time"
            hint="A 64 BPM track matches 128 BPM."
          />
        </div>
      </section>
    </template>

    <!-- Energy: always laid out (no jump when the first readings arrive). -->
    <section aria-labelledby="f-energy">
      <div class="mb-0.5 flex items-baseline justify-between">
        <h3
          id="f-energy"
          class="text-sm font-semibold"
        >
          Energy <span class="font-normal text-muted">(1–10)</span>
        </h3>
        <span class="font-mono text-sm tabular">{{ filters.energyRange[0] }}–{{ filters.energyRange[1] }}</span>
      </div>
      <RangeSlider
        v-model="filters.energyRange"
        :min="1"
        :max="10"
        :thumb-labels="['Minimum energy', 'Maximum energy']"
        :disabled="!filters.energyMeasured"
      />
      <p class="text-xs leading-5 text-muted">
        {{ energyHint }}
      </p>
    </section>

    <section
      v-if="filters.genreOptions.length"
      aria-labelledby="f-genre"
    >
      <h3
        id="f-genre"
        class="mb-3 text-sm font-semibold"
      >
        Genre
      </h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="g in visibleGenres"
          :key="g.value"
          type="button"
          :aria-pressed="filters.genres.includes(g.value)"
          class="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors pointer-coarse:h-10 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-text border-border text-muted hover:border-border-strong hover:text-text"
          @click="filters.toggleGenre(g.value)"
        >
          <Check
            v-if="filters.genres.includes(g.value)"
            class="size-3.5"
            aria-hidden="true"
          />
          {{ g.value }}
          <span class="text-xs text-subtle tabular">{{ g.count }}</span>
        </button>
      </div>
      <Button
        v-if="filters.genreOptions.length > GENRE_LIMIT"
        variant="ghost"
        size="sm"
        class="mt-2 -ml-2"
        :aria-expanded="showAllGenres"
        @click="showAllGenres = !showAllGenres"
      >
        {{ showAllGenres ? 'Show fewer' : `Show all ${filters.genreOptions.length} genres` }}
        <ChevronDown
          :class="showAllGenres && 'rotate-180'"
          class="transition-transform"
        />
      </Button>
    </section>

    <section
      v-if="!filters.seedTrack"
      aria-label="Unanalysed tracks"
    >
      <Switch
        v-model="filters.includeUnknown"
        label="Show tracks without tempo or key"
        :hint="filters.unknownCount ? `${filters.unknownCount} tracks still need analysing or have no preview.` : 'Every track has tempo and key.'"
      />
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Plus, Check, ChevronDown } from '@lucide/vue';
import Button from './ui/Button.vue';
import TextInput from './ui/TextInput.vue';
import Switch from './ui/Switch.vue';
import RangeSlider from './ui/RangeSlider.vue';
import CamelotWheel from './CamelotWheel.vue';
import { useFiltersStore } from '@/stores/filters.js';
import { useLibraryStore } from '@/stores/library.js';
import { codeFor, SOURCE_FILTERS } from '@/lib/trackInfo.js';
import { useCratesStore } from '@/stores/crates.js';

/** Tighter spacing and a height-aware wheel for the desktop sidebar. */
defineProps({ dense: Boolean });

const GENRE_LIMIT = 12;

/** One sentence for the current key selection; always present, so no shift. */
const keyHint = computed(() => {
  const codes = filters.selectedCodes;
  if (filters.allKeysSelected) return 'Tip: Shift-click a key to select it and the keys that mix with it.';
  if (!codes.length) {
    return filters.includeUnknown
      ? 'No keys selected — only tracks without a key are showing.'
      : 'No keys selected, so nothing matches. Tap a key to add it.';
  }
  if (codes.length === 1) {
    const n = Number(codes[0].slice(0, -1));
    const letter = codes[0].slice(-1);
    const wrap = (x) => ((x - 1 + 12) % 12) + 1;
    return `“Mixable” adds ${wrap(n - 1)}${letter}, ${wrap(n + 1)}${letter} and ${n}${letter === 'A' ? 'B' : 'A'} — the keys that mix with ${codes[0]}.`;
  }
  return `${codes.length} keys selected. Tap a key to add or remove it.`;
});

const filters = useFiltersStore();
const library = useLibraryStore();
const showAllGenres = ref(false);
const crates = useCratesStore();
const usageCount = computed(() => crates.usage.size);
const energyHint = computed(() => {
  const measured = filters.energyMeasured;
  const total = library.tracks.length;
  if (!measured) return 'Not measured yet — run Measure energy in the analysis panel.';
  return measured < total
    ? `Measured for ${measured.toLocaleString()} of ${total.toLocaleString()} tracks.`
    : 'Busyness, loudness, tempo and groove.';
});

const visibleGenres = computed(() =>
  showAllGenres.value ? filters.genreOptions : filters.genreOptions.slice(0, GENRE_LIMIT)
);

/** How many tracks sit in each key — makes the wheel a map, not just a control. */
const keyCounts = computed(() => {
  const counts = {};
  for (const track of library.tracks) {
    const code = codeFor(track);
    if (code) counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
});

/**
 * The slider writes through on every move, throttled to one update per frame.
 * Filtering is a single pass, so live feedback is affordable and much better than
 * the old commit-on-release behaviour.
 */
const tempo = ref([...filters.tempoRange]);
let frame = 0;
watch(tempo, (value) => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    filters.tempoRange = [...value];
  });
});
watch(
  () => filters.tempoRange,
  (value) => {
    if (value[0] !== tempo.value[0] || value[1] !== tempo.value[1]) tempo.value = [...value];
  }
);

function setBound(index, raw) {
  const n = Math.round(Number(raw));
  const next = [...tempo.value];
  if (!Number.isFinite(n)) {
    tempo.value = next; // re-render the last valid value
    return;
  }
  next[index] =
    index === 0
      ? Math.min(Math.max(n, filters.bpmMin), next[1])
      : Math.max(Math.min(n, filters.bpmMax), next[0]);
  tempo.value = next;
}
</script>

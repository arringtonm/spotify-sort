<template>
  <div class="space-y-7">
    <!-- Seed mode: key and tempo come from the seed, so say that instead of
         silently disabling the controls. -->
    <section
      v-if="filters.seedTrack"
      class="rounded-xl border border-accent/40 bg-accent-soft/50 p-4 text-sm"
    >
      <p class="font-medium">
        Key and tempo come from the track you're mixing from
      </p>
      <p class="mt-1 text-muted">
        Showing tracks that mix with
        <strong class="text-text">{{ filters.seedTrack.title }}</strong>
        ({{ filters.seedCode }}, {{ formatTempo(filters.seedTrack.tempo) }} BPM ±{{ filters.bpmTolerance }}).
        <template v-if="filters.ordered">
          Search doesn't apply to a built set, because removing a track would break the chain.
        </template>
      </p>
      <Button
        variant="outline"
        size="sm"
        class="mt-3"
        @click="filters.clearSeed()"
      >
        <X /> Stop mixing
      </Button>
    </section>

    <template v-else>
      <section aria-labelledby="f-key">
        <div class="mb-3 flex items-center justify-between gap-2">
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
          class="mt-2 min-h-10 text-xs leading-5 text-muted"
          aria-live="polite"
        >
          {{ keyHint }}
        </p>
      </section>

      <section aria-labelledby="f-tempo">
        <h3
          id="f-tempo"
          class="mb-1 text-sm font-semibold"
        >
          Tempo <span class="font-normal text-muted">(BPM)</span>
        </h3>
        <RangeSlider
          v-model="tempo"
          :min="filters.bpmMin"
          :max="filters.bpmMax"
          :thumb-labels="['Minimum BPM', 'Maximum BPM']"
        />
        <div class="mt-1 grid grid-cols-2 gap-3">
          <Field
            v-slot="{ id }"
            label="Min"
            :lines="0"
          >
            <TextInput
              :id="id"
              :model-value="tempo[0]"
              type="number"
              inputmode="numeric"
              :min="filters.bpmMin"
              :max="tempo[1]"
              class="tabular"
              @change="setBound(0, $event.target.value)"
            />
          </Field>
          <Field
            v-slot="{ id }"
            label="Max"
            :lines="0"
          >
            <TextInput
              :id="id"
              :model-value="tempo[1]"
              type="number"
              inputmode="numeric"
              :min="tempo[0]"
              :max="filters.bpmMax"
              class="tabular"
              @change="setBound(1, $event.target.value)"
            />
          </Field>
        </div>
        <div class="mt-2">
          <Switch
            v-model="filters.matchMultiples"
            label="Include half- and double-time"
            hint="A 64 BPM track matches 128 BPM."
          />
        </div>
      </section>
    </template>

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
import { X, Plus, Check, ChevronDown } from '@lucide/vue';
import Button from './ui/Button.vue';
import Field from './ui/Field.vue';
import TextInput from './ui/TextInput.vue';
import Switch from './ui/Switch.vue';
import RangeSlider from './ui/RangeSlider.vue';
import CamelotWheel from './CamelotWheel.vue';
import { useFiltersStore } from '@/stores/filters.js';
import { useLibraryStore } from '@/stores/library.js';
import { codeFor, formatTempo } from '@/lib/trackInfo.js';

const GENRE_LIMIT = 12;

/** One sentence for the current key selection; always present, so no shift. */
const keyHint = computed(() => {
  const codes = filters.selectedCodes;
  if (filters.allKeysSelected) return 'Tip: tap Clear, then tap one key and “Mixable” to add the keys that mix with it.';
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

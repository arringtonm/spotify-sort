<template>
  <Sheet
    :open="Boolean(track)"
    title="Correct tempo and key"
    :description="track ? `${track.artist} – ${track.title}` : ''"
    desktop="center"
    width="md:w-[480px]"
    @update:open="(v) => !v && $emit('close')"
  >
    <form
      id="edit-track"
      class="space-y-6"
      novalidate
      @submit.prevent="save"
    >
      <Field
        v-slot="{ id, describedBy, invalid }"
        label="Tempo (BPM)"
        :error="tempoError"
        hint="Leave empty to keep the detected tempo."
        optional
      >
        <div class="flex gap-2">
          <TextInput
            :id="id"
            v-model="tempo"
            type="number"
            inputmode="decimal"
            step="0.1"
            min="40"
            max="250"
            class="tabular"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
            @blur="validateTempo"
          />
          <Button
            variant="secondary"
            :disabled="!tempoNumber"
            aria-label="Halve tempo"
            @click="scale(0.5)"
          >
            ½×
          </Button>
          <Button
            variant="secondary"
            :disabled="!tempoNumber"
            aria-label="Double tempo"
            @click="scale(2)"
          >
            2×
          </Button>
        </div>
      </Field>

      <div>
        <div class="mb-2 flex items-baseline justify-between">
          <span
            id="edit-key-label"
            class="text-sm font-medium"
          >Key</span>
          <span class="text-sm text-muted">{{ preview || 'Not set' }}</span>
        </div>
        <CamelotWheel
          v-model="camelot"
          single
          label="Key"
          :center-value="camelot || '—'"
          :center-label="camelot ? 'tap again to clear' : 'tap a key'"
          class="max-w-[300px]"
        />
        <p
          v-if="original"
          class="mt-2 text-center text-xs text-muted"
        >
          Detected: {{ original }}
        </p>
      </div>
    </form>

    <template #footer>
      <Button
        v-if="overrides.has(track?.id)"
        variant="danger-ghost"
        class="mr-auto"
        @click="clear"
      >
        Remove correction
      </Button>
      <Button
        variant="ghost"
        @click="$emit('close')"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="edit-track"
        :disabled="!dirty"
      >
        Save
      </Button>
    </template>
  </Sheet>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Sheet from './ui/Sheet.vue';
import Field from './ui/Field.vue';
import TextInput from './ui/TextInput.vue';
import Button from './ui/Button.vue';
import CamelotWheel from './CamelotWheel.vue';
import { useOverridesStore } from '@/stores/overrides.js';
import { useToastStore } from '@/stores/toasts.js';
import { fromCamelotCode } from '@/lib/camelot.js';
import { displayName } from '@/lib/musicalKey.js';
import { codeFor, keyName, formatTempo } from '@/lib/trackInfo.js';

/**
 * Two fields don't need a heavyweight form: a bottom sheet on phones, a small
 * dialog on desktop. The key is picked on the same wheel as the filter, and the
 * ½× / 2× buttons fix the most common analyser error in one tap.
 */
const props = defineProps({ track: { type: Object, default: null } });
const emit = defineEmits(['close']);

const overrides = useOverridesStore();
const toasts = useToastStore();

const tempo = ref('');
const camelot = ref(null);
const tempoError = ref('');
const initial = ref({ tempo: '', camelot: null });

watch(
  () => props.track,
  (track) => {
    if (!track) return;
    tempo.value = track.tempo == null ? '' : String(track.tempo);
    camelot.value = codeFor(track);
    tempoError.value = '';
    initial.value = { tempo: tempo.value, camelot: camelot.value };
  },
  { immediate: true }
);

const tempoNumber = computed(() => {
  const n = Number(tempo.value);
  return tempo.value !== '' && Number.isFinite(n) ? n : null;
});
const dirty = computed(
  () => tempo.value !== initial.value.tempo || camelot.value !== initial.value.camelot
);
const preview = computed(() => {
  const parsed = fromCamelotCode(camelot.value);
  return parsed ? `${displayName(parsed.pitchClass)} ${parsed.mode === 'maj' ? 'major' : 'minor'}` : '';
});
const original = computed(() => {
  const t = props.track;
  if (!t) return '';
  const parts = [];
  if (codeFor(t)) parts.push(`${codeFor(t)} (${keyName(t)})`);
  if (t.tempo != null) parts.push(`${formatTempo(t.tempo)} BPM`);
  return parts.join(' · ');
});

function validateTempo() {
  if (tempo.value === '') return (tempoError.value = '');
  const n = tempoNumber.value;
  tempoError.value =
    n == null || n < 40 || n > 250 ? 'Enter a tempo between 40 and 250 BPM.' : '';
}

function scale(factor) {
  tempo.value = String(Math.round(tempoNumber.value * factor * 10) / 10);
  validateTempo();
}

async function save() {
  validateTempo();
  if (tempoError.value) return;
  const parsed = fromCamelotCode(camelot.value);
  try {
    await overrides.set(props.track.id, {
      key: parsed ? displayName(parsed.pitchClass) : null,
      mode: parsed ? parsed.mode : null,
      tempo: tempoNumber.value,
    });
    toasts.push({ title: 'Correction saved', description: props.track.title, tone: 'success' });
    emit('close');
  } catch (error) {
    tempoError.value = error.message;
  }
}

async function clear() {
  await overrides.clear(props.track.id);
  toasts.push({ title: 'Correction removed', description: props.track.title });
  emit('close');
}
</script>

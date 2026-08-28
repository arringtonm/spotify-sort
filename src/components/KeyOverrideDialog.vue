<template>
  <v-dialog
    :model-value="Boolean(track)"
    max-width="440"
    @update:model-value="close"
  >
    <v-card v-if="track">
      <v-card-title class="text-body-1">
        Correct track details
      </v-card-title>
      <v-card-subtitle>{{ track.artist }} — {{ track.title }}</v-card-subtitle>

      <v-card-text>
        <p class="hint">
          Your correction outranks Spotify, Deezer and the audio analyser, and survives
          re-imports and re-analysis. Leave a field blank to fall back to the detected
          value.
        </p>

        <div class="fields">
          <v-select
            v-model="camelot"
            :items="camelotOptions"
            label="Key (Camelot)"
            variant="outlined"
            density="compact"
            clearable
            hide-details
          />
          <v-text-field
            v-model="tempo"
            label="BPM"
            type="number"
            variant="outlined"
            density="compact"
            clearable
            hide-details
          />
        </div>

        <p
          v-if="preview"
          class="preview"
        >
          Camelot: <strong>{{ preview }}</strong>
        </p>
      </v-card-text>

      <v-card-actions>
        <v-btn
          v-if="overrides.has(track.id)"
          variant="text"
          @click="clear"
        >
          Remove correction
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          @click="close"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import {
  camelotCode,
  trackPitchClass,
  ALL_CAMELOT_CODES,
  fromCamelotCode,
} from '../lib/camelot.js';
import { displayName } from '../lib/musicalKey.js';
import { useOverridesStore } from '../stores/overrides.js';

export default {
  name: 'KeyOverrideDialog',
  props: {
    track: { type: Object, default: null },
  },
  emits: ['close'],
  setup() {
    return {
      overrides: useOverridesStore(),
      // Ordered round the wheel so neighbours sit together in the list.
      camelotOptions: ALL_CAMELOT_CODES.slice().sort(
        (a, b) =>
          Number(a.slice(0, -1)) - Number(b.slice(0, -1)) || a.slice(-1).localeCompare(b.slice(-1))
      ),
    };
  },
  data: () => ({ camelot: null, tempo: null }),
  computed: {
    /** Spell out the note name, since Camelot alone is opaque if you are unsure. */
    preview() {
      const parsed = fromCamelotCode(this.camelot);
      if (!parsed) return null;
      return `${displayName(parsed.pitchClass)} ${parsed.mode === 'maj' ? 'major' : 'minor'}`;
    },
  },
  watch: {
    track: {
      immediate: true,
      handler(track) {
        this.camelot = track ? camelotCode(trackPitchClass(track), track.mode) : null;
        this.tempo = track?.tempo ?? null;
      },
    },
  },
  methods: {
    close() {
      this.$emit('close');
    },
    async save() {
      const parsed = fromCamelotCode(this.camelot);
      await this.overrides.set(this.track.id, {
        key: parsed ? displayName(parsed.pitchClass) : null,
        mode: parsed ? parsed.mode : null,
        tempo: this.tempo,
      });
      this.close();
    },
    async clear() {
      await this.overrides.clear(this.track.id);
      this.close();
    },
  },
};
</script>

<style lang="scss" scoped>
.hint {
  font-size: 0.8125rem;
  opacity: 0.75;
  margin-bottom: 1rem;
}

.fields {
  display: flex;
  gap: 0.75rem;
}

.preview {
  margin-top: 1rem;
  font-size: 0.875rem;
}
</style>

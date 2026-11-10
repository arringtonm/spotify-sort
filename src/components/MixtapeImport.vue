<template>
  <Sheet
    v-model:open="ui.mixtapeImportOpen.value"
    title="Import past mixtapes"
    description="Songs from these mixes are flagged as already used, so new mixes don't repeat them."
    desktop="center"
    width="md:w-[520px]"
  >
    <form
      id="mixtape-form"
      class="space-y-4"
      novalidate
      @submit.prevent="submit"
    >
      <Field
        v-slot="{ id, describedBy, invalid }"
        label="Folder name"
        :error="submitted && !folder.trim() ? 'Give the folder a name.' : ''"
      >
        <TextInput
          :id="id"
          v-model="folder"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </Field>

      <div>
        <p class="mb-1.5 text-sm font-medium">
          Tracklist
        </p>
        <p class="mb-2 text-xs text-muted">
          Column A artist, B song, C the mix number on each mix's first row. Excel (.xlsx), CSV, or paste rows from a spreadsheet.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            @click="fileInput?.click()"
          >
            <FileSpreadsheet /> Choose file…
          </Button>
          <span class="min-w-0 truncate text-sm text-muted">{{ fileName || 'or paste below' }}</span>
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx,.csv,.tsv,.txt"
            class="sr-only"
            tabindex="-1"
            @change="onFile"
          >
        </div>
        <textarea
          v-model="pasted"
          rows="4"
          placeholder="Moon Boots	Sugar	1"
          class="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          aria-label="Paste tracklist rows"
          @input="parsePaste"
        />
      </div>

      <!-- What will happen, before it happens. Reserved height: no jump. -->
      <div
        class="min-h-16 rounded-lg bg-surface-2 px-3 py-2.5 text-sm"
        aria-live="polite"
      >
        <p
          v-if="error"
          class="text-danger"
        >
          {{ error }}
        </p>
        <template v-else-if="mixes.length">
          <p class="font-medium">
            {{ mixes.length }} mixes · {{ entryCount.toLocaleString() }} songs
          </p>
          <p class="text-muted">
            {{ preview.found.toLocaleString() }} are in your library now; the rest link up when you import them.
          </p>
        </template>
        <p
          v-else
          class="text-muted"
        >
          Choose or paste a tracklist to see what it contains.
        </p>
      </div>
    </form>
    <template #footer>
      <Button
        variant="ghost"
        @click="ui.mixtapeImportOpen.value = false"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="mixtape-form"
        :disabled="!mixes.length"
      >
        Import {{ mixes.length || '' }} mixes
      </Button>
    </template>
  </Sheet>
</template>

<script setup>
import { computed, ref } from 'vue';
import { FileSpreadsheet } from '@lucide/vue';
import Sheet from './ui/Sheet.vue';
import Button from './ui/Button.vue';
import Field from './ui/Field.vue';
import TextInput from './ui/TextInput.vue';
import { useUi } from '@/composables/useUi.js';
import { useLibraryStore } from '@/stores/library.js';
import { useCratesStore } from '@/stores/crates.js';
import { useToastStore } from '@/stores/toasts.js';
import { parseMixtapeRows, parseDelimited } from '@/lib/mixtapeSheet.js';
import { createMatcher } from '@/lib/trackMatch.js';

const ui = useUi();
const library = useLibraryStore();
const crates = useCratesStore();
const toasts = useToastStore();

const folder = ref('Summer Disco Mixes');
const fileInput = ref(null);
const fileName = ref('');
const pasted = ref('');
const mixes = ref([]);
const error = ref('');
const submitted = ref(false);

const entryCount = computed(() => mixes.value.reduce((n, m) => n + m.entries.length, 0));
const preview = computed(() => {
  if (!mixes.value.length) return { found: 0 };
  const find = createMatcher(library.tracks);
  let found = 0;
  for (const m of mixes.value) for (const e of m.entries) if (find(e.artist, e.title)) found++;
  return { found };
});

function useRows(rows) {
  const parsed = parseMixtapeRows(rows);
  mixes.value = parsed;
  error.value = rows.length && !parsed.length ? 'No songs found — check the columns: artist, song, mix number.' : '';
}

async function onFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  fileName.value = file.name;
  pasted.value = '';
  try {
    if (/\.xlsx$/i.test(file.name)) {
      const { readXlsxRows } = await import('@/lib/xlsx.js');
      useRows(await readXlsxRows(await file.arrayBuffer()));
    } else {
      useRows(parseDelimited(await file.text()));
    }
  } catch (e) {
    mixes.value = [];
    error.value = `Couldn't read that file: ${e.message}`;
  }
}

function parsePaste() {
  fileName.value = '';
  useRows(pasted.value.trim() ? parseDelimited(pasted.value) : []);
}

function submit() {
  submitted.value = true;
  if (!folder.value.trim() || !mixes.value.length) return;
  const { folder: made, found, total } = library.importMixtapes(folder.value.trim(), mixes.value);
  ui.mixtapeImportOpen.value = false;
  toasts.push({
    title: `Imported ${mixes.value.length} mixes`,
    description: `${found} of ${total} songs matched your library and are now marked as used.`,
    tone: 'success',
    action: { label: 'View', run: () => crates.open(made.id) },
  });
  mixes.value = [];
  pasted.value = '';
  fileName.value = '';
  submitted.value = false;
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <Button
        variant="secondary"
        size="sm"
        :disabled="!rows.length"
        aria-label="Export"
      >
        <Download />
        <span class="hidden sm:inline">Export</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :class="floatingPanel"
        align="end"
        :side-offset="4"
      >
        <DropdownMenuLabel class="px-2.5 py-1.5 text-xs text-subtle">
          Exports the {{ rows.length.toLocaleString() }} tracks shown
        </DropdownMenuLabel>
        <MenuItem @select="library.exportCsv(rows, 'spotify-sort.csv')">
          <FileSpreadsheet /> Download CSV
        </MenuItem>
        <MenuItem
          :disabled="!auth.signedIn"
          @select="dialog = true"
        >
          <ListPlus /> Save as Spotify playlist
        </MenuItem>
        <p
          v-if="!auth.signedIn"
          class="px-2.5 pb-1.5 pl-9 text-xs text-muted"
        >
          Sign in with Spotify to save playlists.
        </p>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>

  <Sheet
    v-model:open="dialog"
    title="Save as Spotify playlist"
    :description="`${spotifyRows.length.toLocaleString()} tracks will be added to a new private playlist.`"
    desktop="center"
    width="md:w-[440px]"
    auto-focus
  >
    <form
      id="export-form"
      novalidate
      @submit.prevent="save"
    >
      <Field
        v-slot="{ id, describedBy, invalid }"
        label="Playlist name"
        :error="nameError"
      >
        <TextInput
          :id="id"
          v-model="name"
          maxlength="100"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </Field>
      <p
        v-if="skipped"
        class="mt-3 text-sm text-muted"
      >
        {{ skipped }} tracks came from a DJ library file and have no Spotify ID, so they'll be left out.
      </p>
    </form>
    <template #footer>
      <Button
        variant="ghost"
        @click="dialog = false"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="export-form"
        :loading="saving"
        :disabled="!spotifyRows.length"
      >
        Save playlist
      </Button>
    </template>
  </Sheet>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuLabel,
} from 'reka-ui';
import { Download, FileSpreadsheet, ListPlus } from '@lucide/vue';
import Button from './ui/Button.vue';
import MenuItem from './ui/MenuItem.vue';
import Sheet from './ui/Sheet.vue';
import Field from './ui/Field.vue';
import TextInput from './ui/TextInput.vue';
import { floatingPanel } from './ui/menu.js';
import { useLibraryStore } from '@/stores/library.js';
import { useAuthStore } from '@/stores/auth.js';
import { useToastStore } from '@/stores/toasts.js';
import { spotifyUrl } from '@/lib/trackInfo.js';

const props = defineProps({ rows: { type: Array, required: true } });

const library = useLibraryStore();
const auth = useAuthStore();
const toasts = useToastStore();

const dialog = ref(false);
const saving = ref(false);
const name = ref(`Spotify Sort – ${new Date().toLocaleDateString()}`);
const submitted = ref(false);
const nameError = computed(() =>
  submitted.value && !name.value.trim() ? 'Give the playlist a name.' : ''
);

const spotifyRows = computed(() => props.rows.filter((t) => spotifyUrl(t)));
const skipped = computed(() => props.rows.length - spotifyRows.value.length);

async function save() {
  submitted.value = true;
  if (nameError.value) return;
  saving.value = true;
  try {
    const result = await library.exportToSpotify(name.value.trim(), spotifyRows.value);
    dialog.value = false;
    submitted.value = false;
    toasts.push({
      title: 'Playlist saved',
      description: result.name,
      tone: 'success',
      action: result.url ? { label: 'Open in Spotify', run: () => window.open(result.url, '_blank', 'noopener') } : null,
    });
  } catch (error) {
    toasts.push({ title: 'Could not save playlist', description: error.message, tone: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>

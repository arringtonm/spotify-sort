<template>
  <Sheet
    :open="open"
    title="Library"
    :description="`${library.originLabel} · ${library.total.toLocaleString()} tracks on this device`"
    width="md:w-[520px]"
    @update:open="$emit('update:open', $event)"
  >
    <div class="space-y-8">
      <div
        v-if="!online"
        role="status"
        class="flex gap-2 rounded-lg bg-warn-soft px-3 py-2.5 text-sm"
      >
        <WifiOff
          class="mt-0.5 size-4 shrink-0 text-warn"
          aria-hidden="true"
        />
        <span>You're offline. Your library and filters still work; importing and analysing need a connection.</span>
      </div>
      <div
        v-if="library.error"
        role="alert"
        class="flex gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm"
      >
        <CircleAlert
          class="mt-0.5 size-4 shrink-0 text-danger"
          aria-hidden="true"
        />
        <span>{{ library.error }}</span>
      </div>

      <!-- 1. Paste a link: the fastest path, works from any share sheet. -->
      <section aria-labelledby="lib-link">
        <SectionTitle
          id="lib-link"
          :icon="Link2"
        >
          Import from a link
        </SectionTitle>
        <form
          class="space-y-3"
          novalidate
          @submit.prevent="importLink"
        >
          <Field
            v-slot="{ id, describedBy, invalid }"
            label="Playlist, album or track link"
            :hint="linkHint"
            :error="linkError"
          >
            <TextInput
              :id="id"
              ref="linkInput"
              v-model="link"
              type="url"
              inputmode="url"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="https://open.spotify.com/playlist/…"
              clearable
              clear-label="link"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              @blur="touchedLink = Boolean(link)"
            />
          </Field>
          <p
            v-if="parsedLink && !parsedLink.error"
            class="flex items-center gap-2 text-sm text-muted"
          >
            <CircleCheck
              class="size-4 text-ok"
              aria-hidden="true"
            />
            {{ parsedLink.provider === 'deezer' ? 'Deezer' : 'Spotify' }} {{ parsedLink.type }}
            <template v-if="usesEmbed">
              · read from Spotify's public page (unofficial)
            </template>
          </p>
          <Button
            type="submit"
            variant="primary"
            :loading="library.busy && busyWith === 'link'"
            :disabled="library.busy || !online"
          >
            Import {{ parsedLink && !parsedLink.error ? parsedLink.type : 'link' }}
          </Button>
        </form>
      </section>

      <!-- 2. Spotify account -->
      <section aria-labelledby="lib-spotify">
        <SectionTitle
          id="lib-spotify"
          :icon="Music2"
        >
          Your Spotify
        </SectionTitle>

        <template v-if="!auth.configured">
          <p class="text-sm text-muted">
            Spotify isn't set up for this copy of the app. Add <code class="rounded bg-surface-2 px-1">VITE_SPOTIFY_CLIENT_ID</code> to <code class="rounded bg-surface-2 px-1">.env</code> to enable it.
          </p>
        </template>

        <template v-else-if="!auth.signedIn">
          <p class="mb-3 text-sm text-muted">
            Sign in to import Liked Songs and your playlists, and to save sets back to Spotify.
          </p>
          <Button
            variant="primary"
            :disabled="!auth.diagnostics.originMatches"
            @click="signIn"
          >
            <LogIn /> Sign in with Spotify
          </Button>
          <p
            v-if="auth.error"
            role="alert"
            class="mt-2 text-sm text-danger"
          >
            {{ auth.error }}
          </p>
          <div
            v-if="!auth.diagnostics.originMatches"
            role="alert"
            class="mt-3 rounded-lg bg-warn-soft px-3 py-2.5 text-sm"
          >
            Sign-in only works from
            <a
              :href="auth.diagnostics.registeredOrigin"
              class="font-medium underline"
            >{{ auth.diagnostics.registeredOrigin }}</a>
            — that's the address registered with Spotify.
          </div>
          <details
            v-if="showDevNotes"
            class="group mt-4 rounded-lg border border-border text-sm"
          >
            <summary class="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 font-medium">
              <ChevronRight class="size-4 transition-transform group-open:rotate-90" />
              Developer setup
            </summary>
            <div class="space-y-2 px-3 pb-3 text-muted">
              <p>
                Spotify development mode allows up to 5 allowlisted accounts, and the app owner needs Premium.
                Register this redirect URI in the
                <a
                  href="https://developer.spotify.com/dashboard"
                  target="_blank"
                  rel="noopener"
                  class="text-accent underline"
                >Spotify dashboard</a>, exactly as shown:
              </p>
              <div class="flex items-center gap-2">
                <code class="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1.5 text-text select-all">{{ auth.diagnostics.redirectUri }}</code>
                <Button
                  size="sm"
                  variant="secondary"
                  @click="copyRedirect"
                >
                  <Copy /> Copy
                </Button>
              </div>
            </div>
          </details>
        </template>

        <template v-else>
          <div class="space-y-2">
            <SourceRow
              :icon="Heart"
              title="Liked Songs"
              subtitle="Everything you've saved"
              :loading="library.busy && busyWith === 'saved'"
              :disabled="library.busy || !online"
              @run="importSpotify({ source: 'saved' }, 'saved')"
            />
          </div>

          <div class="mt-5">
            <div class="mb-2 flex items-center justify-between">
              <h4 class="text-sm font-medium">
                Your playlists
              </h4>
              <Button
                v-if="!playlists.length"
                variant="ghost"
                size="sm"
                :loading="loadingPlaylists"
                @click="loadPlaylists"
              >
                Show playlists
              </Button>
            </div>
            <template v-if="playlists.length">
              <TextInput
                v-model="playlistQuery"
                :icon="Search"
                placeholder="Filter playlists"
                aria-label="Filter playlists"
                clearable
                clear-label="playlist filter"
                class="mb-2"
              />
              <ul
                class="max-h-80 space-y-1 overflow-y-auto overscroll-contain"
                aria-label="Playlists"
              >
                <li
                  v-for="p in shownPlaylists"
                  :key="p.id"
                >
                  <SourceRow
                    :icon="ListMusic"
                    :title="p.name"
                    :subtitle="`${p.trackCount} tracks${p.owner ? ` · ${p.owner}` : ''}`"
                    :loading="library.busy && busyWith === p.id"
                    :disabled="library.busy || !online"
                    compact
                    @run="importSpotify({ source: 'playlist', playlistId: p.id }, p.id)"
                  />
                </li>
                <li
                  v-if="!shownPlaylists.length"
                  class="px-3 py-4 text-center text-sm text-muted"
                >
                  No playlists match “{{ playlistQuery }}”.
                </li>
              </ul>
            </template>
          </div>
        </template>
      </section>

      <!-- 3. DJ software -->
      <section aria-labelledby="lib-dj">
        <SectionTitle
          id="lib-dj"
          :icon="FileAudio"
        >
          DJ software
        </SectionTitle>
        <p class="mb-3 text-sm text-muted">
          Rekordbox XML, Traktor NML, or CSV (Serato, Mixed In Key). Your DJ software analysed the
          full tracks, so these are the most accurate tempos and keys you can get. No sign-in needed.
        </p>

        <div
          v-if="!parsed"
          :class="[
            'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
            dragging ? 'border-accent bg-accent-soft/40' : 'border-border-strong',
          ]"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <Upload
            class="size-6 text-muted"
            aria-hidden="true"
          />
          <p class="text-sm">
            <span class="hidden md:inline">Drop a library file here, or </span>
            <label class="cursor-pointer font-medium text-accent underline-offset-2 hover:underline">
              <span class="md:hidden">Choose a library file</span><span class="hidden md:inline">choose one</span>
              <input
                type="file"
                accept=".xml,.nml,.csv,.txt"
                class="sr-only"
                @change="onFile($event.target.files?.[0]); $event.target.value = ''"
              >
            </label>
          </p>
          <p class="text-xs text-subtle">
            .xml · .nml · .csv
          </p>
        </div>

        <div
          v-else
          class="rounded-xl border border-border bg-surface-2 p-4"
        >
          <p class="font-medium">
            {{ parsed.tracks.length.toLocaleString() }} tracks from {{ formatName(parsed.format) }}
          </p>
          <p class="mt-0.5 text-sm text-muted">
            {{ parsed.name }} · {{ parsed.withTempo.toLocaleString() }} with tempo · {{ parsed.withKey.toLocaleString() }} with key
          </p>
          <div class="mt-3 flex gap-2">
            <Button
              variant="primary"
              :loading="library.busy && busyWith === 'file'"
              @click="importFile"
            >
              Import {{ parsed.tracks.length.toLocaleString() }} tracks
            </Button>
            <Button
              variant="ghost"
              @click="parsed = null"
            >
              Cancel
            </Button>
          </div>
        </div>
        <p
          v-if="fileError"
          role="alert"
          class="mt-2 text-sm text-danger"
        >
          {{ fileError }}
        </p>
      </section>

      <!-- 3b. Local audio: full-length analysis on this device. -->
      <section aria-labelledby="lib-audio">
        <SectionTitle
          id="lib-audio"
          :icon="AudioWaveform"
        >
          Audio files
        </SectionTitle>
        <p class="mb-3 text-sm text-muted">
          Analyse whole tracks on this device for the most accurate tempo, key and a full-length
          waveform. Files are named “Artist - Title”? Even better. Nothing is uploaded.
        </p>
        <div
          :class="[
            'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
            draggingAudio ? 'border-accent bg-accent-soft/40' : 'border-border-strong',
          ]"
          @dragover.prevent="draggingAudio = true"
          @dragleave="draggingAudio = false"
          @drop.prevent="onAudioDrop"
        >
          <AudioWaveform
            class="size-6 text-muted"
            aria-hidden="true"
          />
          <p class="text-sm">
            <span class="hidden md:inline">Drop audio files here, or </span>
            <label class="cursor-pointer font-medium text-accent underline-offset-2 hover:underline">
              <span class="md:hidden">Choose audio files</span><span class="hidden md:inline">choose files</span>
              <input
                type="file"
                multiple
                :accept="AUDIO_ACCEPT"
                class="sr-only"
                :disabled="library.busy"
                @change="importAudio($event.target.files); $event.target.value = ''"
              >
            </label>
          </p>
          <p class="text-xs text-subtle">
            MP3 · AAC · WAV · AIFF · FLAC · up to 12 minutes each
          </p>
        </div>
      </section>

      <!-- 4. Analysis -->
      <section
        v-if="!library.isDemo"
        aria-labelledby="lib-analysis"
      >
        <SectionTitle
          id="lib-analysis"
          :icon="AudioLines"
        >
          Audio analysis
        </SectionTitle>
        <AnalysisStatus />
      </section>

      <!-- 5. Danger zone, last and visually distinct. -->
      <section
        v-if="!library.isDemo"
        aria-labelledby="lib-danger"
        class="rounded-xl border border-danger/40 p-4"
      >
        <h3
          id="lib-danger"
          class="text-sm font-semibold text-danger"
        >
          Clear this device
        </h3>
        <p class="mt-1 text-sm text-muted">
          Deletes the stored library and its analysis, and goes back to the sample tracks. Your
          corrections are kept.
        </p>
        <Button
          variant="danger-ghost"
          size="sm"
          class="mt-3 -ml-2"
          @click="confirmClear = true"
        >
          <Trash2 /> Clear stored library…
        </Button>
      </section>
    </div>
  </Sheet>

  <AlertDialogRoot v-model:open="confirmClear">
    <AlertDialogPortal>
      <AlertDialogOverlay class="anim-overlay fixed inset-0 z-[60] bg-[var(--overlay)]" />
      <AlertDialogContent
        class="anim-center fixed top-1/2 left-1/2 z-[61] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-pop"
      >
        <AlertDialogTitle class="text-lg font-semibold">
          Clear {{ library.total.toLocaleString() }} stored tracks?
        </AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-sm text-muted">
          Their analysis will be lost and re-importing means analysing again. This can't be undone.
        </AlertDialogDescription>
        <div class="mt-6 flex justify-end gap-2">
          <AlertDialogCancel as-child>
            <Button variant="ghost">
              Keep library
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <Button
              variant="danger"
              @click="clearStored"
            >
              Clear library
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<script setup>
import { computed, ref, h, watch } from 'vue';
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from 'reka-ui';
import {
  Link2,
  Music2,
  FileAudio,
  AudioLines,
  LogIn,
  Copy,
  ChevronRight,
  Heart,
  ListMusic,
  Search,
  Upload,
  Trash2,
  CircleAlert,
  CircleCheck,
  WifiOff,
  AudioWaveform,
} from '@lucide/vue';
import { AUDIO_ACCEPT, isAudioFile } from '@/lib/audioFiles.js';
import { useOnline } from '@vueuse/core';
import Sheet from './ui/Sheet.vue';
import Button from './ui/Button.vue';
import Field from './ui/Field.vue';
import TextInput from './ui/TextInput.vue';
import AnalysisStatus from './AnalysisStatus.vue';
import SourceRow from './SourceRow.vue';
import { useLibraryStore } from '@/stores/library.js';
import { useFiltersStore } from '@/stores/filters.js';
import { useAuthStore } from '@/stores/auth.js';
import { useToastStore } from '@/stores/toasts.js';
import { EMBED_PROXY } from '@/services/spotifyApi.js';
import { parseSourceLink } from '@/lib/sourceLinks.js';
import { useUi } from '@/composables/useUi.js';

defineProps({ open: Boolean });
const emit = defineEmits(['update:open']);

const library = useLibraryStore();
const filters = useFiltersStore();
const auth = useAuthStore();
const toasts = useToastStore();
const ui = useUi();
const online = useOnline();

const SectionTitle = (props, { slots }) =>
  h('h3', { id: props.id, class: 'mb-3 flex items-center gap-2 text-sm font-semibold' }, [
    h(props.icon, { class: 'size-4 text-accent', 'aria-hidden': 'true' }),
    slots.default?.(),
  ]);
SectionTitle.props = ['id', 'icon'];

const busyWith = ref(null);
const showDevNotes = import.meta.env.DEV || !auth.diagnostics.originMatches;

// ---- Link import -----------------------------------------------------------
const link = ref('');
const linkInput = ref(null);
const touchedLink = ref(false);
const submittedLink = ref(false);
const linkHint =
  'Spotify or Deezer. In the app: Share → Copy link, then paste it here.';
const parsedLink = computed(() => (link.value.trim() ? parseSourceLink(link.value) : null));
const usesEmbed = computed(
  () =>
    parsedLink.value?.provider === 'spotify' &&
    !auth.signedIn &&
    Boolean(EMBED_PROXY)
);
const linkError = computed(() => {
  if (!(touchedLink.value || submittedLink.value)) return '';
  if (!link.value.trim()) return submittedLink.value ? 'Paste a link first.' : '';
  if (parsedLink.value?.error) return parsedLink.value.error;
  if (parsedLink.value?.provider === 'spotify' && !auth.signedIn && !EMBED_PROXY) {
    return 'Sign in with Spotify below to import Spotify links, or paste a Deezer link — those work without signing in.';
  }
  return '';
});

async function importLink() {
  submittedLink.value = true;
  touchedLink.value = true;
  if (linkError.value) return;
  busyWith.value = 'link';
  try {
    await library.importFromLink(link.value);
    filters.resetAll();
    announce();
    link.value = '';
    submittedLink.value = false;
    touchedLink.value = false;
    emit('update:open', false);
  } catch {
    /* shown inline via library.error */
  } finally {
    busyWith.value = null;
  }
}

// Links arriving from the share target, a paste, or /import?url=.
watch(
  () => ui.pendingLink.value,
  (text) => {
    if (!text) return;
    link.value = text;
    ui.pendingLink.value = '';
    importLink();
  },
  { immediate: true }
);

// ---- Spotify ---------------------------------------------------------------
async function signIn() {
  await auth.signIn().catch(() => {});
}

async function copyRedirect() {
  try {
    await navigator.clipboard.writeText(auth.diagnostics.redirectUri);
    toasts.push({ title: 'Redirect URI copied', tone: 'success' });
  } catch {
    toasts.push({ title: 'Copy failed', description: auth.diagnostics.redirectUri, tone: 'error' });
  }
}

const playlists = ref([]);
const loadingPlaylists = ref(false);
const playlistQuery = ref('');
const shownPlaylists = computed(() => {
  const q = playlistQuery.value.trim().toLowerCase();
  return q ? playlists.value.filter((p) => p.name.toLowerCase().includes(q)) : playlists.value;
});

async function loadPlaylists() {
  loadingPlaylists.value = true;
  try {
    playlists.value = await library.listPlaylists();
  } catch (error) {
    library.error = error.message;
  } finally {
    loadingPlaylists.value = false;
  }
}

async function importSpotify(options, tag) {
  busyWith.value = tag;
  try {
    // Close the sheet once tracks are in so the user sees results arrive; the
    // header ring keeps showing analysis progress.
    const done = library.importFromSpotify(options);
    await done;
    filters.resetAll();
    announce();
  } catch {
    /* shown inline via library.error */
  } finally {
    busyWith.value = null;
  }
}

function announce() {
  if (library.summary) toasts.push({ title: 'Import complete', description: library.summary, tone: 'success' });
  if (library.warning) toasts.push({ title: 'Heads up', description: library.warning, tone: 'warning' });
}

// ---- DJ files ----------------------------------------------------------------
const parsed = ref(null);
const fileError = ref('');
const dragging = ref(false);

async function onFile(file) {
  if (!file) return;
  fileError.value = '';
  try {
    parsed.value = await library.previewFile(file);
  } catch (error) {
    fileError.value = `Couldn't read ${file.name}: ${error.message}`;
  }
}

function onDrop(event) {
  dragging.value = false;
  const files = [...(event.dataTransfer?.files ?? [])];
  // Audio dropped on the library-file zone is almost certainly meant for analysis.
  if (files.length && files.every(isAudioFile)) return importAudio(files);
  onFile(files[0]);
}

// ---- Audio files -------------------------------------------------------------
const draggingAudio = ref(false);

function onAudioDrop(event) {
  draggingAudio.value = false;
  importAudio(event.dataTransfer?.files);
}

async function importAudio(fileList) {
  const files = [...(fileList ?? [])];
  if (!files.length) return;
  busyWith.value = 'audio';
  try {
    await library.importAudioFiles(files);
    filters.resetAll();
    announce();
    emit('update:open', false);
  } catch {
    /* library.error */
  } finally {
    busyWith.value = null;
  }
}

async function importFile() {
  busyWith.value = 'file';
  try {
    await library.importParsed(parsed.value);
    parsed.value = null;
    filters.resetAll();
    announce();
    emit('update:open', false);
  } catch {
    /* library.error */
  } finally {
    busyWith.value = null;
  }
}

function formatName(format) {
  return { rekordbox: 'Rekordbox', traktor: 'Traktor', csv: 'CSV' }[format] ?? format;
}

// ---- Danger ----------------------------------------------------------------
const confirmClear = ref(false);
async function clearStored() {
  await library.reset();
  filters.resetAll();
  toasts.push({ title: 'Library cleared', description: 'Showing the sample tracks.' });
}
</script>

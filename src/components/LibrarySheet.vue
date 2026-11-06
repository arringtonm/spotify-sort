<template>
  <Sheet
    :open="open"
    :title="library.job ? 'Import' : 'Library'"
    :description="library.job ? '' : library.isDemo
      ? `Showing the ${library.total.toLocaleString()}-track sample. Import your own below.`
      : `${library.total.toLocaleString()} tracks on this device · last import: ${library.originLabel}`"
    width="md:w-[520px]"
    @update:open="$emit('update:open', $event)"
  >
    <!-- While an import runs (or just finished), show it as a process with
         steps instead of the list of options. -->
    <ImportProgress
      v-if="library.job"
      @close="$emit('update:open', false)"
    />
    <div
      v-else
      class="space-y-8"
    >
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

      <!-- 0. Your own libraries on this Mac: one click, no picker. -->
      <section aria-labelledby="lib-yours">
        <SectionTitle
          id="lib-yours"
          :icon="Disc3"
        >
          Your libraries
        </SectionTitle>
        <div class="space-y-2">
          <SourceRow
            v-if="canReadLocalLibraries"
            :icon="Disc3"
            title="Serato library"
            :subtitle="seratoSubtitle"
            :action="hasSerato ? 'Sync' : 'Import'"
            :loading="library.busy && library.job?.title === 'Serato library'"
            :disabled="library.busy || seratoLibraries?.length === 0"
            @run="library.importSerato()"
          />
          <p
            v-else
            class="rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted"
          >
            The desktop app imports your whole Serato library and its crates automatically. In a browser, export a CSV from Serato and use DJ software below.
          </p>
          <SourceRow
            :icon="History"
            title="Past mixtapes"
            subtitle="A spreadsheet of mixes, so songs you've used are flagged"
            action="Choose"
            @run="openMixtapes"
          />
        </div>
      </section>

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
            :lines="4"
            :hint="linkHint"
            :error="linkError"
          >
            <!-- A textarea, not an input: a list of track links copied from
                 Spotify is one per line, and inputs strip line breaks. -->
            <textarea
              :id="id"
              v-model="link"
              rows="2"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="https://open.spotify.com/playlist/…"
              class="block max-h-40 min-h-20 w-full resize-y rounded-lg border border-border-strong bg-surface px-3 py-2.5 font-mono text-[13px] leading-5 text-text break-all placeholder:font-sans placeholder:text-sm placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-ring focus:outline-none aria-[invalid=true]:border-danger"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              @blur="touchedLink = Boolean(link)"
              @keydown.enter.meta.prevent="importLink"
              @keydown.enter.ctrl.prevent="importLink"
            />
          </Field>
          <p
            class="flex min-h-5 items-center gap-2 text-sm text-muted"
            aria-live="polite"
          >
            <template v-if="parsedLink && !parsedLink.error">
              <CircleCheck
                class="size-4 text-ok"
                aria-hidden="true"
              />
              {{ linkSummary }}
              <template v-if="usesEmbed">
                · read from Spotify's public page (unofficial)
              </template>
            </template>
          </p>
          <Button
            type="submit"
            variant="primary"
            :loading="library.busy && busyWith === 'link'"
            :disabled="library.busy || !online"
          >
            {{ importLabel }}
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
                    @run="importSpotify({ source: 'playlist', playlistId: p.id, title: p.name }, p.id)"
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
  Disc3,
  History,
} from '@lucide/vue';
import { AUDIO_ACCEPT, isAudioFile } from '@/lib/audioFiles.js';
import { useOnline } from '@vueuse/core';
import Sheet from './ui/Sheet.vue';
import Button from './ui/Button.vue';
import Field from './ui/Field.vue';
import TextInput from './ui/TextInput.vue';
import AnalysisStatus from './AnalysisStatus.vue';
import ImportProgress from './ImportProgress.vue';
import SourceRow from './SourceRow.vue';
import { useLibraryStore } from '@/stores/library.js';
import { useFiltersStore } from '@/stores/filters.js';
import { useAuthStore } from '@/stores/auth.js';
import { useToastStore } from '@/stores/toasts.js';
import { EMBED_PROXY } from '@/services/spotifyApi.js';
import { parseSourceLink } from '@/lib/sourceLinks.js';
import { useUi } from '@/composables/useUi.js';
import { canReadLocalLibraries, findSeratoLibraries } from '@/services/localLibraries.js';

const props = defineProps({ open: Boolean });
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

/** One dialog at a time: close the Library sheet, then open the importer. */
function openMixtapes() {
  emit('update:open', false);
  setTimeout(() => (ui.mixtapeImportOpen.value = true), 150);
}

// ---- Serato ----------------------------------------------------------------
const seratoLibraries = ref(null);
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen || !canReadLocalLibraries) return;
    try {
      seratoLibraries.value = await findSeratoLibraries();
    } catch {
      seratoLibraries.value = [];
    }
  },
  { immediate: true }
);
const hasSerato = computed(() => library.raw.some((t) => t.serato));
const seratoSubtitle = computed(() => {
  const libs = seratoLibraries.value;
  if (libs == null) return 'Looking for Serato on this Mac…';
  if (!libs.length) return 'No Serato library found in ~/Music or on a drive';
  const crates = libs.reduce((n, l) => n + l.crateCount, 0);
  return `${libs.map((l) => l.label).join(' + ')} · ${crates} crates · tracks, BPM, key and crates`;
});
const showDevNotes = import.meta.env.DEV || !auth.diagnostics.originMatches;

// ---- Link import -----------------------------------------------------------
const link = ref('');
const touchedLink = ref(false);
const submittedLink = ref(false);
const linkHint =
  'Spotify or Deezer: Share → Copy link. For a whole long playlist, select its tracks in the Spotify desktop app (⌘A / Ctrl+A), copy (⌘C / Ctrl+C) and paste the list here.';
const parsedLink = computed(() => (link.value.trim() ? parseSourceLink(link.value) : null));
const linkSummary = computed(() => {
  const ref = parsedLink.value;
  if (!ref || ref.error) return '';
  if (ref.type === 'tracks') return `${ref.ids.length} Spotify tracks`;
  return `${ref.provider === 'deezer' ? 'Deezer' : 'Spotify'} ${ref.type}`;
});
const importLabel = computed(() => {
  const ref = parsedLink.value;
  if (!ref || ref.error) return 'Import link';
  if (ref.type === 'tracks') return `Import ${ref.ids.length} tracks`;
  return `Import ${ref.type}`;
});
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
    const pending = library.importFromLink(link.value);
    link.value = '';
    submittedLink.value = false;
    touchedLink.value = false;
    await pending;
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
    await library.importFromSpotify(options);
  } catch {
    /* shown inline via library.error */
  } finally {
    busyWith.value = null;
  }
}

/**
 * Once the tracks are in the library the rest (analysis) can run unattended:
 * show the finished steps for a moment, then get out of the way. The header
 * keeps showing progress, and a toast reports the end.
 */
const AUTO_CLOSE_MS = 1600;
let autoClose = 0;
watch(
  () => library.job?.steps.find((s) => s.key === 'save')?.state,
  (state) => {
    if (state !== 'done') return;
    // New tracks are in: show everything, so they're visible straight away.
    filters.resetAll();
    if (library.job?.status !== 'running') return;
    clearTimeout(autoClose);
    autoClose = setTimeout(() => {
      if (library.job?.status === 'running' && props.open) {
        emit('update:open', false);
        toasts.push({
          title: 'Tracks added — measuring tempo and key',
          description: 'This continues in the background. Progress is at the top of the screen.',
          action: { label: 'Show progress', run: () => emit('update:open', true) },
        });
      }
    }, AUTO_CLOSE_MS);
  }
);

/**
 * A finished import stays on screen until it has been seen, then clears when
 * the sheet closes, so the next visit starts at the import options.
 */
let seenFinished = false;
watch(
  () => [props.open, library.job?.status],
  ([open, status]) => {
    const finished = status && status !== 'running';
    if (open && finished) seenFinished = true;
    if (!open && finished && seenFinished) {
      seenFinished = false;
      library.dismissJob();
    }
  }
);

/** Report the end of an import if the sheet isn't open to show it. */
watch(
  () => library.job?.status,
  (status, previous) => {
    if (previous !== 'running' || !status || status === 'running' || props.open) return;
    const job = library.job;
    const show = { label: 'Details', run: () => emit('update:open', true) };
    if (status === 'done') {
      toasts.push({ title: `Imported ${job.title}`, description: job.warning || job.summary, tone: job.warning ? 'warning' : 'success', action: show });
    } else if (status === 'error') {
      toasts.push({ title: `Couldn't import ${job.title}`, description: job.error, tone: 'error', action: show });
    } else {
      toasts.push({ title: 'Analysis stopped', description: 'Everything finished is saved. Resume from the header any time.', action: show });
    }
  }
);

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
  } catch {
    /* library.error */
  } finally {
    busyWith.value = null;
  }
}

async function importFile() {
  busyWith.value = 'file';
  try {
    const pending = library.importParsed(parsed.value);
    parsed.value = null;
    await pending;
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

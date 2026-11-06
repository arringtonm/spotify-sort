<template>
  <!-- Name a new crate, or rename one. -->
  <Sheet
    :open="Boolean(crates.dialog)"
    :title="crates.dialog?.mode === 'rename' ? 'Rename crate' : 'New crate'"
    :description="description"
    desktop="center"
    width="md:w-[420px]"
    auto-focus
    @update:open="!$event && (crates.dialog = null)"
  >
    <form
      id="crate-form"
      novalidate
      @submit.prevent="submit"
    >
      <Field
        v-slot="{ id, describedBy, invalid }"
        label="Crate name"
        :error="error"
      >
        <TextInput
          :id="id"
          v-model="name"
          :maxlength="MAX_CRATE_NAME + 10"
          autocomplete="off"
          enterkeyhint="done"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </Field>
    </form>
    <template #footer>
      <Button
        variant="ghost"
        @click="crates.dialog = null"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="crate-form"
      >
        {{ crates.dialog?.mode === 'rename' ? 'Rename' : 'Create crate' }}
      </Button>
    </template>
  </Sheet>

  <!-- Deleting a crate never touches the tracks themselves; say so. -->
  <AlertDialogRoot
    :open="deleteOpen"
    @update:open="!$event && (crates.confirmDeleteId = null)"
  >
    <AlertDialogPortal>
      <AlertDialogOverlay class="anim-overlay fixed inset-0 z-[60] bg-[var(--overlay)]" />
      <AlertDialogContent
        class="anim-center fixed top-1/2 left-1/2 z-[61] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-pop"
      >
        <AlertDialogTitle class="text-lg font-semibold">
          Delete “{{ toDelete?.name }}”?
        </AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-sm text-muted">
          The crate and its order are removed. The {{ toDelete?.trackIds.length }} tracks stay in your
          library.
        </AlertDialogDescription>
        <div class="mt-6 flex justify-end gap-2">
          <AlertDialogCancel as-child>
            <Button variant="ghost">
              Keep crate
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <Button
              variant="danger"
              @click="remove"
            >
              Delete crate
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
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
import Sheet from './ui/Sheet.vue';
import Button from './ui/Button.vue';
import Field from './ui/Field.vue';
import TextInput from './ui/TextInput.vue';
import { useCratesStore } from '@/stores/crates.js';
import { useToastStore } from '@/stores/toasts.js';
import { useTrackDrag } from '@/composables/useTrackDrag.js';
import { MAX_CRATE_NAME } from '@/lib/crates.js';

const crates = useCratesStore();
const toasts = useToastStore();
const { addedToast } = useTrackDrag();

const name = ref('');
const submitted = ref(false);
watch(
  () => crates.dialog,
  (d) => {
    name.value = d?.name ?? '';
    submitted.value = false;
    // Focus the name with it selected, so typing replaces the suggestion and
    // Enter accepts it. (Wait for the dialog's own focus handling to finish.)
    if (d) {
      setTimeout(() => {
        const input = document.querySelector('#crate-form input');
        input?.focus();
        input?.select();
      }, 50);
    }
  }
);

// Validate on submit, then live once there's an error to fix (no nagging while typing).
const error = computed(() =>
  submitted.value ? crates.validate(name.value, crates.dialog?.crateId ?? null) : ''
);

const description = computed(() => {
  const d = crates.dialog;
  if (!d || d.mode === 'rename') return '';
  const n = d.trackIds?.length ?? 0;
  if (!n) return 'Add tracks by dragging them onto the crate, or from a track’s ⋯ menu.';
  return n === 1 ? 'The track will be added to it.' : `${n} tracks will be added to it, in this order.`;
});

function submit() {
  submitted.value = true;
  if (error.value) return;
  const d = crates.dialog;
  if (d.mode === 'rename') {
    crates.rename(d.crateId, name.value);
  } else {
    const crate = crates.create(name.value, d.trackIds ?? []);
    if (d.openAfter) crates.open(crate.id);
    else if (crate.trackIds.length) addedToast(crate, crate.trackIds.length);
    else toasts.push({ title: `Created ${crate.name}`, tone: 'success', duration: 2500 });
  }
  crates.dialog = null;
}

// Held locally: the dialog clears confirmDeleteId as it closes, which can
// happen before the Delete button's click handler runs.
const toDelete = ref(null);
watch(
  () => crates.confirmDeleteId,
  (id) => {
    if (id) toDelete.value = crates.byId(id);
  }
);
const deleteOpen = computed(() => Boolean(crates.confirmDeleteId));
function remove() {
  const crate = toDelete.value;
  crates.confirmDeleteId = null;
  if (!crate) return;
  crates.remove(crate.id);
  toasts.push({ title: `Deleted ${crate.name}`, description: 'Your tracks are still in the library.' });
}
</script>

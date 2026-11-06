import { ref } from 'vue';

/** App-wide UI state that more than one view needs to open. */
const libraryOpen = ref(false);
/** A link handed to us by a share target, paste, or /import?url=. */
const pendingLink = ref('');

export function useUi() {
  return {
    libraryOpen,
    pendingLink,
    importLink(text) {
      pendingLink.value = text;
      libraryOpen.value = true;
    },
  };
}

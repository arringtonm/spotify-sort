import { ref } from 'vue';

/** App-wide UI state that more than one view needs to open. */
const libraryOpen = ref(false);

export function useUi() {
  return { libraryOpen };
}

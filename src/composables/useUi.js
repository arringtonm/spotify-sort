import { ref } from 'vue';

/** App-wide UI state that more than one view needs to open. */
const libraryOpen = ref(false);
/** A link handed to us by a share target, paste, or /import?url=. */
const pendingLink = ref('');
/** The past-mixtapes importer (spreadsheet of Artist / Title / Mix #). */
const mixtapeImportOpen = ref(false);
/** Discover: the tracks to find new music around (null = closed). */
const discoverSeeds = ref(null);

export function useUi() {
  return {
    libraryOpen,
    pendingLink,
    mixtapeImportOpen,
    discoverSeeds,
    importLink(text) {
      pendingLink.value = text;
      libraryOpen.value = true;
    },
  };
}

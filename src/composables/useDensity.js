import { computed } from 'vue';
import { useStorage } from '@vueuse/core';

/** Track list row density, remembered on this device. */
const density = useStorage('spotify-sort.density', 'comfortable');

export function useDensity() {
  return { density, compact: computed(() => density.value === 'compact') };
}

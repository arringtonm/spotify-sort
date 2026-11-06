import { defineStore } from 'pinia';

let next = 1;

/** Transient, non-blocking feedback. Errors stay until dismissed. */
export const useToastStore = defineStore('toasts', {
  state: () => ({ items: [] }),
  actions: {
    push({ title, description = '', tone = 'info', duration, action = null }) {
      const id = next++;
      this.items.push({
        id,
        title,
        description,
        tone,
        action,
        duration: duration ?? (tone === 'error' ? 1e9 : 5000),
      });
      return id;
    },
    dismiss(id) {
      this.items = this.items.filter((t) => t.id !== id);
    },
  },
});

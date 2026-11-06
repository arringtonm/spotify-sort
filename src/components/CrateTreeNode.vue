<template>
  <li role="none">
    <div
      class="flex items-center"
      :style="{ paddingLeft: `${depth * 14}px` }"
    >
      <button
        v-if="node.children.length"
        type="button"
        class="flex size-7 shrink-0 items-center justify-center rounded text-muted hover:text-text"
        :aria-label="`${open ? 'Collapse' : 'Expand'} ${node.crate.name}`"
        :aria-expanded="open"
        @click="open = !open"
      >
        <ChevronRight
          class="size-3.5 transition-transform"
          :class="open && 'rotate-90'"
        />
      </button>
      <span
        v-else
        class="w-7 shrink-0"
      />
      <button
        type="button"
        role="treeitem"
        :aria-current="crates.activeId === node.crate.id ? 'page' : undefined"
        class="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md pr-2 pl-1 text-left text-sm hover:bg-surface-2 aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium pointer-coarse:h-10"
        @click="$emit('pick', node.crate.id)"
      >
        <component
          :is="node.children.length ? (open ? FolderOpen : Folder) : FolderClosed"
          class="size-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate">{{ node.crate.name }}</span>
        <span class="text-xs text-subtle tabular">{{ count }}</span>
      </button>
    </div>
    <ul
      v-if="open && node.children.length"
      role="group"
    >
      <CrateTreeNode
        v-for="child in node.children"
        :key="child.crate.id"
        :node="child"
        :depth="depth + 1"
        :force-open="forceOpen"
        @pick="$emit('pick', $event)"
      />
    </ul>
  </li>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ChevronRight, Folder, FolderOpen, FolderClosed } from '@lucide/vue';
import { useCratesStore } from '@/stores/crates.js';

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  forceOpen: Boolean,
});
defineEmits(['pick']);
const crates = useCratesStore();
const open = ref(props.forceOpen);
watch(
  () => props.forceOpen,
  (v) => (open.value = v)
);

/** Tracks in this crate and everything under it. */
const count = computed(() => {
  const ids = new Set();
  const walk = (n) => {
    n.crate.trackIds.forEach((id) => ids.add(id));
    n.children.forEach(walk);
  };
  walk(props.node);
  return ids.size;
});
</script>

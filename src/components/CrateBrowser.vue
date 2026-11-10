<template>
  <!-- Every crate, grouped and nested like Serato's sidebar, with search.
       Scales to hundreds of crates where a row of chips can't. -->
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors pointer-coarse:h-10"
        :class="inBrowsedCrate ? 'border-accent bg-accent-soft font-medium text-text' : 'border-border text-muted hover:border-border-strong hover:text-text'"
        :aria-label="`Browse crates${inBrowsedCrate ? `, viewing ${crates.activePath.join(' › ')}` : ''}`"
      >
        <FolderTree class="size-4" />
        <span class="max-w-48 truncate">{{ inBrowsedCrate ? crates.activePath.join(' › ') : 'Browse crates' }}</span>
        <ChevronDown class="size-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :class="[floatingPanel, 'w-[min(24rem,calc(100vw-1.5rem))] p-2']"
        align="start"
        :side-offset="6"
        :collision-padding="12"
      >
        <TextInput
          v-model="query"
          :icon="Search"
          type="search"
          placeholder="Find a crate"
          aria-label="Find a crate"
          clearable
          clear-label="crate search"
        />
        <div class="mt-2 max-h-[min(28rem,60dvh)] overflow-y-auto">
          <template
            v-for="group in visibleGroups"
            :key="group.key"
          >
            <p class="flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs font-medium text-subtle">
              <component
                :is="group.icon"
                class="size-3.5"
              />
              {{ group.label }}
            </p>
            <ul
              role="tree"
              :aria-label="group.label"
            >
              <CrateTreeNode
                v-for="node in group.nodes"
                :key="node.crate.id"
                :node="node"
                :force-open="Boolean(query)"
                @pick="pick"
              />
            </ul>
          </template>
          <p
            v-if="!visibleGroups.length"
            class="px-2 py-6 text-center text-sm text-muted"
          >
            {{ query ? 'No crates match.' : 'No crates yet.' }}
          </p>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup>
import { computed, ref } from 'vue';
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui';
import { FolderTree, ChevronDown, Search, Folder, Disc3, History } from '@lucide/vue';
import TextInput from './ui/TextInput.vue';
import CrateTreeNode from './CrateTreeNode.vue';
import { floatingPanel } from './ui/menu.js';
import { useCratesStore } from '@/stores/crates.js';
import { useUi } from '@/composables/useUi.js';

const crates = useCratesStore();
const open = useUi().crateBrowserOpen;
const query = ref('');

/** The chip row shows your top-level crates; anything else is "in the browser". */
const inBrowsedCrate = computed(() => {
  const c = crates.active;
  return Boolean(c && (c.origin !== 'user' || c.parentId));
});

function filterTree(nodes, q) {
  if (!q) return nodes;
  const out = [];
  for (const n of nodes) {
    const children = filterTree(n.children, q);
    if (n.crate.name.toLowerCase().includes(q) || children.length) out.push({ ...n, children });
  }
  return out;
}

const visibleGroups = computed(() => {
  const q = query.value.trim().toLowerCase();
  return [
    { key: 'user', label: 'Your crates', icon: Folder, nodes: crates.groups.user },
    { key: 'serato', label: 'Serato', icon: Disc3, nodes: crates.groups.serato },
    { key: 'mixtape', label: 'Past mixtapes', icon: History, nodes: crates.groups.mixtape },
  ]
    .map((g) => ({ ...g, nodes: filterTree(g.nodes, q) }))
    .filter((g) => g.nodes.length);
});

function pick(id) {
  crates.open(id);
  open.value = false;
}
</script>

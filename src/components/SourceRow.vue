<template>
  <button
    type="button"
    :disabled="disabled"
    :class="[
      'flex w-full items-center gap-3 rounded-xl border border-border text-left transition-colors hover:border-border-strong hover:bg-surface-2 disabled:opacity-50',
      compact ? 'min-h-12 px-3 py-2' : 'min-h-16 px-4 py-3',
    ]"
    @click="$emit('run')"
  >
    <span
      class="flex shrink-0 items-center justify-center rounded-lg bg-surface-3"
      :class="compact ? 'size-8' : 'size-10'"
    >
      <component
        :is="icon"
        class="size-4 text-muted"
        aria-hidden="true"
      />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium">{{ title }}</span>
      <span class="block truncate text-xs text-muted">{{ subtitle }}</span>
    </span>
    <span
      v-if="loading"
      class="size-4 animate-spin rounded-full border-2 border-accent border-r-transparent"
      aria-label="Importing"
    />
    <span
      v-else
      class="text-sm font-medium text-accent"
    >{{ action }}</span>
  </button>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function], required: true },
  title: { type: String, required: true },
  action: { type: String, default: 'Import' },
  subtitle: { type: String, default: '' },
  loading: Boolean,
  disabled: Boolean,
  compact: Boolean,
});
defineEmits(['run']);
</script>

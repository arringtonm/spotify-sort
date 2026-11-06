<template>
  <div class="space-y-1.5">
    <label
      :for="id"
      class="block text-sm font-medium"
    >{{ label }}<span
      v-if="optional"
      class="ml-1 font-normal text-subtle"
    >(optional)</span></label>
    <slot
      :id="id"
      :described-by="describedBy"
      :invalid="Boolean(error)"
    />
    <p
      v-if="error"
      :id="`${id}-error`"
      class="flex items-start gap-1.5 text-sm text-danger"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-else-if="hint"
      :id="`${id}-hint`"
      class="text-xs text-muted"
    >
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue';

/** Visible label above, help or error below — never a placeholder as the label. */
const props = defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  optional: Boolean,
});
const id = useId();
const describedBy = computed(() =>
  props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined
);
</script>

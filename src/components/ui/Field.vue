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
    <!--
      Hint and error share one grid cell, and the cell reserves `lines` of
      height up front. An error appearing (or replacing the hint) never pushes
      the rest of the form down.
    -->
    <div
      v-if="lines > 0 || hint || error"
      class="grid text-xs leading-5"
      :style="{ minHeight: `${lines * 1.25}rem` }"
    >
      <p
        v-if="hint"
        :id="`${id}-hint`"
        class="text-muted [grid-area:1/1]"
        :class="error && 'invisible'"
        :aria-hidden="error ? 'true' : undefined"
      >
        {{ hint }}
      </p>
      <p
        v-if="error"
        :id="`${id}-error`"
        class="font-medium text-danger [grid-area:1/1]"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
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
  /** Lines of message space to reserve, so errors don't shift the layout. */
  lines: { type: Number, default: 1 },
});
const id = useId();
const describedBy = computed(() =>
  props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined
);
</script>

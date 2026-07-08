<template>
  <div
    class="border text-center p-2 rounded-md flex flex-col items-center justify-center size-24"
    :class="{
      'bg-sky-900/70 border-sky-400': accessType === 'read',
      'bg-green-900/70 border-green-400': accessType === 'write',
      'bg-purple-900/80 border-purple-400': accessType === 'read-write',
    }"
  >
    <span>{{ label }}</span>
    <input
      v-if="editable"
      v-model="data"
      type="number"
      step="any"
      class="text-center w-full bg-transparent outline-none border focus:border-gray-400"
      @change="onCellChange"
    />
    <span v-else>{{ formatCell(data || 0) }}</span>
  </div>
</template>

<script setup lang="ts">
import { formatCell } from "@/helpers.ts";

const props = withDefaults(
  defineProps<{
    label: string;
    index?: number;
    editable?: boolean;
    accessType?: "none" | "read" | "write" | "read-write";
  }>(),
  {
    index: undefined,
    accessType: "none",
    editable: false,
  },
);
const data = defineModel<number>("data");

const emit = defineEmits<{
  (
    e: "cell-change",
    payload: { index: number; row: number; col: number; value: number },
  ): void;
}>();

function onCellChange(event: Event) {
  if (!props.index) {
    return;
  }

  const target = event.target as HTMLInputElement;
  const parsed = parseFloat(target.value);
  const invalidNum = Number.isNaN(parsed) || target.value === "";
  const newValue = invalidNum ? 0 : parsed;

  if (invalidNum) {
    target.value = "0";
  }

  emit("cell-change", {
    index: props.index,
    row: Math.floor(props.index / 4),
    col: props.index % 4,
    value: newValue,
  });
}
</script>

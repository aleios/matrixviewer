<template>
  <div>
    <!-- Iterate 4x4 matrix -->
    <div class="grid grid-cols-4 gap-2 size-90">
      <div
          v-for="cell in displayedCells"
          :key="cell.index"
          class="border text-center p-2 rounded-md flex flex-col items-center justify-center"
          :class="{ 'bg-green-800 border-green-200': highlightedCells.has(cell.index) }"
      >
        <span>{{ front ? `FR${cell.index}` : `XF${cell.index}`}}</span>
        <input
            v-if="editable"
            type="number"
            step="any"
            class="text-center w-full bg-transparent outline-none border focus:border-gray-400"
            :value="cell.value"
            @change="onCellChange(cell.index, $event)"
        />
        <span v-else>{{ cell.value.toFixed(4) }}</span>
      </div>
    </div>
    <div v-if="editable" class="flex gap-2 p-1">
      <UIButton @click="empty">Empty</UIButton>
      <UIButton @click="identity">Identity</UIButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Matrix } from "@/types.ts";
import { computed, ref } from "vue";
import {matEmpty, matIdentity} from "@/matrixops.ts";
import UIButton from "@/UIButton.vue";

const props = withDefaults(defineProps<{
  front?: boolean
  editable?: boolean
  flipOrder?: boolean
}>(), {
  front: false,
  editable: false,
  flipOrder: false,
});

const matrix = defineModel<Matrix>('matrix', {
  default: () => [
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ]
})

const displayedCells = computed(() => {
  return matrix.value.map((_, visualIndex) => {
    const row = Math.floor(visualIndex / 4);
    const col = visualIndex % 4;
    const index = props.flipOrder ? col * 4 + row : visualIndex;

    return {
      index,
      value: matrix.value[index] ?? 0,
    };
  });
});

const highlightedCells = ref(new Set<number>());
function highlightCells(indexes: number[], clear: boolean = true) {
  if (clear) {
    clearHighlightedCells()
  }
  highlightedCells.value = new Set(
      indexes.filter((index) => index >= 0 && index < matrix.value.length)
  );
}
function clearHighlightedCells() {
  highlightedCells.value = new Set();
}

const emit = defineEmits<{
  (e: "cell-change", payload: { index: number; row: number; col: number; value: number }): void
}>();

function getElement(matrix: Matrix, row: number, col: number): number {
  return matrix[row * 4 + col] || 0;
}

function onCellChange(index: number, event: Event) {
  const target = event.target as HTMLInputElement;
  const parsed = parseFloat(target.value);
  const invalidNum = Number.isNaN(parsed) || target.value === ''
  const newValue = invalidNum ? 0 : parsed;

  if (invalidNum) {
    target.value = "0"
  }

  const updated = [...matrix.value] as Matrix;
  updated[index] = newValue;

  emit("cell-change", {
    index,
    row: Math.floor(index / 4),
    col: index % 4,
    value: newValue,
  });
  matrix.value = updated
}

function empty() {
  matrix.value = matEmpty()
}

function identity() {
  matrix.value = matIdentity()
}

defineExpose({
  highlightCells,
  clearHighlightedCells,
});
</script>
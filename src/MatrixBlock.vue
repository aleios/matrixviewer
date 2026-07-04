<template>
  <div>
    <!-- Iterate 4x4 matrix -->
    <div class="grid grid-cols-4 gap-2 size-105">
      <div
          v-for="cell in displayedCells"
          :key="cell.index"
          class="border text-center p-2 rounded-md flex flex-col items-center justify-center"
          :class="{
            'bg-sky-900/70 border-sky-400': getCellAccessType(cell.index) === 'read',
            'bg-green-900/70 border-green-400': getCellAccessType(cell.index) === 'write',
            'bg-purple-900/80 border-purple-400': getCellAccessType(cell.index) === 'read-write',
          }"
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
        <span v-else>{{ formatCell(cell.value) }}</span>
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

type CellAccessType = "read" | "write" | "read-write";
type CellHighlights = {
  read?: number[]
  write?: number[]
}

const highlightedCells = ref<Map<number, CellAccessType>>(new Map())
function highlightCells(highlights: CellHighlights, clear: boolean = true) {
  if (clear) {
    clearHighlightedCells()
  }
  for (const index of highlights.read || []) {
    highlightedCells.value.set(index, "read")
  }

  for (const index of highlights.write || []) {
    highlightedCells.value.set(
        index,
        highlightedCells.value.has(index) ? "read-write" : "write"
    )
  }
}
function clearHighlightedCells() {
  highlightedCells.value.clear()
}

function getCellAccessType(index: number) {
  return highlightedCells.value.get(index)
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

function formatCell(value: number) {
  if(value === 0) {
    return '0.0000'
  }
  const abs = Math.abs(value)
  return (abs >= 1e6 || abs < 1e-4) ? value.toExponential(4) : value.toFixed(4);
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
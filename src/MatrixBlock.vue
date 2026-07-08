<template>
  <div>
    <!-- Iterate 4x4 matrix -->
    <div class="grid grid-cols-4 gap-2 size-105">
      <RegisterCell
        v-for="cell in displayedCells"
        :key="cell.index"
        :index="cell.index"
        :data="cell.value"
        :label="front ? `FR${cell.index}` : `XF${cell.index}`"
        :access-type="getCellAccessType(cell.index)"
        :editable="editable"
        @cell-change="onCellChange"
      />
    </div>
    <div v-if="editable" class="flex gap-2 p-1">
      <UIButton @click="empty"> Empty </UIButton>
      <UIButton @click="identity"> Identity </UIButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Matrix, CellAccessType, CellHighlights } from "@/types.ts";
import { computed, ref } from "vue";
import { matEmpty, matIdentity } from "@/matrixops.ts";
import UIButton from "@/UIButton.vue";
import RegisterCell from "@/RegisterCell.vue";

const props = withDefaults(
  defineProps<{
    front?: boolean;
    editable?: boolean;
    flipOrder?: boolean;
  }>(),
  {
    front: false,
    editable: false,
    flipOrder: false,
  },
);

const matrix = defineModel<Matrix>("matrix", {
  default: () => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
});

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

const highlightedCells = ref<Map<number, CellAccessType>>(new Map());

function highlightCells(highlights: CellHighlights, clear: boolean = true) {
  if (clear) {
    clearHighlightedCells();
  }
  for (const index of highlights.read || []) {
    highlightedCells.value.set(index, "read");
  }

  for (const index of highlights.write || []) {
    highlightedCells.value.set(
      index,
      highlightedCells.value.has(index) ? "read-write" : "write",
    );
  }
}

function clearHighlightedCells() {
  highlightedCells.value.clear();
}

function getCellAccessType(index: number) {
  return highlightedCells.value.get(index);
}

function empty() {
  matrix.value = matEmpty();
}

function identity() {
  matrix.value = matIdentity();
}

function onCellChange(payload: {
  index: number;
  row: number;
  col: number;
  value: number;
}) {
  const updated = [...matrix.value] as Matrix;
  updated[payload.index] = payload.value;
  matrix.value = updated;
}

defineExpose({
  highlightCells,
  clearHighlightedCells,
});
</script>

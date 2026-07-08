<template>
  <div class="flex gap-4">
    <RegisterCell
      v-for="(pair, i) in pairs"
      :key="i"
      :label="backBank ? `XD${i*2}` : `DR${i*2}`"
      :data="pair"
      :access-type="highlightedCells.get(i)"
    />
  </div>
</template>
<script setup lang="ts">
import type { Matrix, CellHighlights, CellAccessType } from "@/types.ts";
import { matEmpty } from "@/matrixops.ts";
import { computed, ref } from "vue";
import { pairToDouble } from "@/helpers.ts";
import RegisterCell from "@/RegisterCell.vue";

const props = withDefaults(defineProps<{
  bank?: Matrix
  backBank?: boolean
}>(), {
  bank: matEmpty,
  backBank: false
})

const pairs = computed(() => {
  const pairs: number[] = []
  for (let i = 0; i < props.bank.length; i += 2) {
    pairs.push(pairToDouble(props.bank[i], props.bank[i + 1]))
  }
  return pairs
})

const highlightedCells = ref<Map<number, CellAccessType>>(new Map())

function clearHighlightedCells() {
  highlightedCells.value.clear()
}

function combine(current: CellAccessType | undefined, newval: CellAccessType): CellAccessType {
  if (!current || current === newval)
    return newval
  return "read-write"
}

function highlightCells(highlights: CellHighlights, clear: boolean = true) {
  if (clear) {
    clearHighlightedCells()
  }
  const single = new Map<number, CellAccessType>()
  for (const index of highlights.read || []) {
    single.set(index, "read")
  }
  for (const index of highlights.write || []) {
    single.set(index, single.has(index) ? "read-write" : "write")
  }
  for (const [index, type] of single) {
    const pairIndex = Math.floor(index / 2)
    highlightedCells.value.set(pairIndex, combine(highlightedCells.value.get(pairIndex), type))
  }
}

defineExpose({ highlightCells, clearHighlightedCells })
</script>
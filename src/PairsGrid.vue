<template>
  <div class="flex gap-4">
    <div v-for="(pair, i) in pairs" :key="i" class="border text-center p-2 rounded-md flex flex-col items-center justify-center size-24">
      <span>{{ backBank ? `XD${i*2}` : `DR${i*2}`}}</span>
      <span>{{ formatCell(pair) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Matrix } from "@/types.ts";
import { matEmpty } from "@/matrixops.ts";
import { computed } from "vue";
import { pairToDouble, formatCell } from "@/helpers.ts";

const props = withDefaults(defineProps<{
  bank?: Matrix
  backBank?: boolean
}>(), {
  bank: matEmpty,
  backBank: false
})

const pairs = computed(() => {
  let pairs: number[] = []
  for(let i = 0; i < props.bank.length; i += 2) {
    pairs.push(pairToDouble(props.bank[i], props.bank[i + 1]))
  }
  return pairs
})

</script>
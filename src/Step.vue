<template>
  <div
    class="w-full cursor-pointer p-0.5"
    :class="{ 'bg-green-800': selected }"
  >
    {{ step.index + 1 }} {{ step.line }}
  </div>
</template>

<script setup lang="ts">
import type { InstructionIndex } from "@/types.ts";

defineProps<{
  step: InstructionIndex;
  selected: boolean;
}>();
</script>

<style scoped></style>

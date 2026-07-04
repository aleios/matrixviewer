<template>
  <div class="border p-2 max-h-80 overflow-y-auto">
    <Step v-for="(step, i) in instrIndex" :key="i" :step="step" :selected="selectedStep === i" @click="selectedStep = i" />
  </div>
</template>

<script setup lang="ts">
import Step from "@/Step.vue";
import {ref, watch} from "vue";
import type {InstructionIndex} from "@/types.ts";

const instrIndex = defineModel<InstructionIndex[]>('instrIndex')

const emit = defineEmits(['stepChanged'])

const selectedStep = ref(-1);

watch(selectedStep, () => emit('stepChanged', selectedStep.value))

</script>

<style scoped>

</style>
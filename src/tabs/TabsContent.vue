<template>
  <div v-show="active">
    <slot />
  </div>
</template>

<script setup lang="ts">
import {computed, inject} from "vue";
import {type TabsContext, TabsContextKey} from "@/tabs/data.ts";

const props = defineProps<{ name: string }>()

const ctx = inject<TabsContext>(TabsContextKey)

const active = computed(() => ctx?.activeName?.value === props.name)

</script>

<style scoped>

</style>
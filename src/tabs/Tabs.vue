<template>
  <div>
    <slot />
  </div>
</template>

<script setup lang="ts">

import {provide, ref} from "vue";
import {TabsContextKey} from "@/tabs/data.ts";

const activeName = defineModel<string>('active', { default: '' })

function setActiveName(name: string) {
  activeName.value = name
}

provide(TabsContextKey, {
  activeName,
  setActiveName
})

</script>

<style scoped>

</style>
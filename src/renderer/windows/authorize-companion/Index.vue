<script setup lang="ts">
import TitleBar from "../../components/TitleBar.vue";
import Auth from "./Auth.vue";
</script>

<template>
  <div class="container tw:bg-ytmd-background">
    <TitleBar class="titlebar" />
    <Auth class="auth tw:bg-ytmd-background" />
  </div>
</template>

<style scoped>
.auth {
  border-top: 1px solid var(--ytmd-color-border);
  height: calc(100% - 36px);
}

.container {
  width: 100%;
  height: 100%;
}
</style>

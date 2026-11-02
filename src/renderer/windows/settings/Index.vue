<script setup lang="ts">
import TitleBar from "../../components/TitleBar.vue";
import Settings from "./Settings.vue";
</script>

<template>
  <div class="container tw:bg-ytmd-background">
    <TitleBar
      class="titlebar"
      title="Settings"
      icon="settings"
    />
    <Suspense>
      <Settings class="settings tw:border-ytmd-border tw:bg-ytmd-background" />
    </Suspense>
  </div>
</template>

<style scoped>
.settings {
  border-top-width: 1px;
  border-top-style: solid;
  height: calc(100% - 36px);
}

.container {
  width: 100%;
  height: 100%;
}
</style>

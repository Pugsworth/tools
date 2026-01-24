<script setup lang="ts">
import VimEditor from "./components/VimEditor.vue";
</script>

<template>
    <div class="app-container">
        <VimEditor />
    </div>
</template>

<style>
/* Remove default margins and padding for full screen */
html, body, #app {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background-color: #1e1e1e;
}

.app-container {
    width: 100%;
    height: 100%;
}
</style>

<script lang="ts">
// Array.at polyfill
console.debug("Array.at polyfill");
console.debug(Array.prototype?.at);

if (!(Array.prototype as any).at) {
    (Array.prototype as any).at = function (n: number) {
        n = Math.trunc(n) || 0;
        if (n < 0) n += this.length;
        if (n < 0 || n >= this.length) return undefined;
        return this[n];
    };
}
</script>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as monaco from 'monaco-editor';
import { initVimMode } from 'monaco-vim';

const editorContainer = ref<HTMLElement | null>(null);
const statusBar = ref<HTMLElement | null>(null);
const fileName = ref('untitled.ts');
const showToast = ref(false);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let vimMode: any = null;

const saveFile = () => {
    if (editor) {
        const content = editor.getValue();
        console.log('Saving file content:', content);
        // Simulate saving
        showToast.value = true;
        setTimeout(() => {
            showToast.value = false;
        }, 2000);
    }
};

onMounted(() => {
    if (editorContainer.value) {
        editor = monaco.editor.create(editorContainer.value, {
            value: [
                '// Welcome to Monaco Vim Editor!',
                '// You can use Vim keybindings here.',
                '',
                'function helloWorld() {',
                '  console.log("Hello, world!");',
                '}',
                '',
                'helloWorld();'
            ].join('\n'),
            language: 'typescript',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 16,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            minimap: {
                enabled: true
            },
            lineNumbers: 'on',
            cursorStyle: 'block',
            padding: { top: 10 },
            smoothScrolling: true,
            cursorBlinking: 'solid',
        });

        if (statusBar.value) {
            vimMode = initVimMode(editor, statusBar.value);
        }
    }
});

onBeforeUnmount(() => {
    if (vimMode) {
        vimMode.dispose();
    }
    if (editor) {
        editor.dispose();
    }
});
</script>

<template>
    <div class="editor-wrapper">
        <header class="editor-header">
            <div class="file-info">
                <span class="icon">📄</span>
                <span class="filename">{{ fileName }}</span>
            </div>
            <div class="actions">
                <button class="btn-save" @click="saveFile">Save</button>
            </div>
        </header>
        <div ref="editorContainer" class="monaco-container"></div>
        <div ref="statusBar" class="vim-status-bar"></div>
        <Transition name="toast">
            <div v-if="showToast" class="toast">File saved successfully!</div>
        </Transition>
    </div>
</template>

<style scoped>
.editor-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    background-color: #1e1e1e;
    overflow: hidden;
    color: #cccccc;
}

.editor-header {
    height: 40px;
    background-color: #252526;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 15px;
    border-bottom: 1px solid #333;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    z-index: 10;
}

.file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 13px;
}

.filename {
    color: #e1e1e1;
}

.btn-save {
    background-color: #3e3e3e;
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.btn-save:hover {
    background-color: #505050;
}

.monaco-container {
    flex: 1;
    width: 100%;
}

.vim-status-bar {
    height: 26px;
    background-color: #007acc;
    color: white;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    border-top: 1px solid #333;
}

/* Customizing the vim status bar internal style provided by monaco-vim */
:deep(.vim-status-bar) {
    width: 100%;
}

:deep(.vim-status-bar span) {
    padding-right: 15px;
    font-weight: 500;
}

:deep(.vim-status-bar input) {
    background: transparent;
    border: none;
    color: white;
    outline: none;
    font-family: inherit;
    font-size: inherit;
}

.toast {
    position: fixed;
    bottom: 50px;
    right: 20px;
    background-color: #4caf50;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    z-index: 100;
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
}

.toast-enter-active,
.toast-leave-active {
    transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translateY(20px);
}
</style>

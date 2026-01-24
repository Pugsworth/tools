<script lang="ts">
// Array.at polyfill
// TODO: This and other polyfills could probably be added using a package.
if (!(Array.prototype as any).at) {
    (Array.prototype as any).at = function (n: number) {
        n = Math.trunc(n) || 0;
        if (n < 0) n += (this as any).length;
        if (n < 0 || n >= (this as any).length) return undefined;
        return (this as any)[n];
    };
}
</script>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import * as monaco from "monaco-editor";
import { initVimMode, VimMode } from "monaco-vim";

// @ts-ignore
import themeList from "../../node_modules/monaco-themes/themes/themelist.json";

const editorContainer = ref<HTMLElement | null>(null);
const statusBar = ref<HTMLElement | null>(null);
const fileName = ref("untitled.ts");
const showToast = ref(false);
const showBackLink = ref(true);
const isVimEnabled = ref(true);
const currentTheme = ref("vs-dark");
const currentLanguage = ref("typescript");
const showLanguageSelector = ref(true);
const showThemeSelector = ref(true);
const showVimToggle = ref(true);
const allowThemeLivePreview = ref(false);
const isThemeDropdownOpen = ref(false);
const originalTheme = ref("vs-dark");

const themes = computed(() => {
    const baseThemes = [
        { name: "VS Dark", value: "vs-dark" },
        { name: "VS Light", value: "vs" },
        { name: "High Contrast", value: "hc-black" }
    ];

    const themeKeys: string[] = Object.keys(themeList);
    themeKeys.sort((a, b) => a.localeCompare(b));
    
    const extraThemes = themeKeys.map((id) => ({
        name: (themeList as { [key:string]:string })[id],
        value: id
    }));

    return [...baseThemes, ...extraThemes];
});

const languages = ref<{ name: string, value: string }[]>([]);

let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let vimMode: any = null;

const toggleVim = () => {
    if (!editor || !statusBar.value) return;

    if (isVimEnabled.value) {
        // Enable
        vimMode = initVimMode(editor, statusBar.value);
        editor.updateOptions({ cursorStyle: "block" });
    } else {
        // Disable
        if (vimMode) {
            vimMode.dispose();
            vimMode = null;
        }
        editor.updateOptions({ cursorStyle: "line" });
    }
};

const setTheme = async (themeValue: string, isPreview = false) => {
    console.log("Theme: ", themeValue);

    if (!isPreview) {
        currentTheme.value = themeValue;
        originalTheme.value = themeValue;
    }
    
    if (["vs-dark", "vs", "hc-black"].includes(themeValue)) {
        monaco.editor.setTheme(themeValue);
        return;
    }

    try {
        const fileName = (themeList as any)[themeValue];
        if (!fileName) throw new Error("Theme not found in list");

        const response = await fetch(`https://raw.githubusercontent.com/brijeshb42/monaco-themes/master/themes/${fileName}.json`);
        if (!response.ok) throw new Error("Theme not found on GitHub");
        const themeData = await response.json();
        
        monaco.editor.defineTheme(themeValue, themeData);
        monaco.editor.setTheme(themeValue);
    } catch (e) {
        console.error("Failed to load theme", e);
        monaco.editor.setTheme("vs-dark");
    }
};

const previewTheme = (themeValue: string) => {
    setTheme(themeValue, true);
};

const restoreTheme = () => {
    setTheme(originalTheme.value, true);
};

const selectTheme = (themeValue: string) => {
    setTheme(themeValue);
    isThemeDropdownOpen.value = false;
};

const setLanguage = (lang: string) => {
    currentLanguage.value = lang;
    if (editor) {
        const model = editor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(model, lang);
        }
    }
};

const saveFile = () => {
    if (editor) {
        const content = editor.getValue();
        console.log("(Simulated) Saving file content:", content);
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
                "// Welcome to Monaco Vim Editor!",
                "// You can use Vim keybindings here.",
                "",
                "function helloWorld() {",
                "  console.log(\"Hello, world!\");",
                "}",
                "",
                "helloWorld();"
            ].join("\n"),
            language: "typescript",
            theme: "vs-dark",
            automaticLayout: true,
            fontSize: 16,
            fontFamily: `'Fira Code', 'Cascadia Code', Consolas, monospace`,
            fontLigatures: true,
            minimap: {
                enabled: true
            },
            lineNumbers: "on",
            cursorStyle: "block",
            padding: { top: 10 },
            smoothScrolling: true,
            cursorBlinking: "solid",
        });

        if (statusBar.value) {
            vimMode = initVimMode(editor, statusBar.value);
        }

        // TODO: Change the parsing of the parameters a little to instead work like Vim wherein "thing" activates and "nothing" deactivates. Fall back to "thing=0/1" for possible compatibility issues.
        //       Also, make options case-insensitive.
        // Check for standalone/hideBack mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("hideBack") || urlParams.has("standalone")) {
            showBackLink.value = false;
        }
        if (urlParams.has("hideLang")) showLanguageSelector.value = false;
        if (urlParams.has("hideTheme")) showThemeSelector.value = false;
        if (urlParams.has("hideVim")) showVimToggle.value = false;
        if (urlParams.has("livePreview")) allowThemeLivePreview.value = true;
        if (urlParams.has("theme")) {
            const themeParam = urlParams.get("theme");
            if (themeParam) setTheme(themeParam);
        }

        // Populate languages from Monaco
        languages.value = monaco.languages.getLanguages().map(lang => ({
            name: lang.id.charAt(0).toUpperCase() + lang.id.slice(1),
            value: lang.id
        })).sort((a, b) => a.name.localeCompare(b.name));

        // Set initial language if provided in URL
        const langParam = urlParams.get("lang");
        if (langParam) setLanguage(langParam);

        // Expose API for external environments (like GMod)
        const api = {
            onSave: () => {
                saveFile();
            },
            onQuit: () => {
                console.log("Quit requested");
            },
            setValue: (value: string) => {
                if (editor) editor.setValue(value);
            },
            getValue: () => {
                return editor ? editor.getValue() : '';
            },
            setLanguage: (lang: string) => {
                setLanguage(lang);
            },
            setFileName: (name: string) => {
                fileName.value = name;
            },
            setTheme: (theme: string) => {
                setTheme(theme);
            },
            setSettingsVisibility: (config: { lang?: boolean, theme?: boolean, vim?: boolean, back?: boolean }) => {
                if (config.lang !== undefined) showLanguageSelector.value = config.lang;
                if (config.theme !== undefined) showThemeSelector.value = config.theme;
                if (config.vim !== undefined) showVimToggle.value = config.vim;
                if (config.back !== undefined) showBackLink.value = config.back;
            },
            injectJS: (base64Code: string) => {
                try {
                    const code = atob(base64Code);
                    const script = document.createElement("script");
                    script.textContent = code;
                    document.head.appendChild(script);
                } catch (e) {
                    console.error("Failed to decode JS base64", e);
                }
            },
            injectHTML: (base64Html: string, selector: string = "body") => {
                try {
                    const html = atob(base64Html);
                    const container = document.querySelector(selector);
                    if (container) {
                        const div = document.createElement("div");
                        div.innerHTML = html;
                        while (div.firstChild) {
                            container.appendChild(div.firstChild);
                        }
                    }
                } catch (e) {
                    console.error("Failed to decode HTML base64", e);
                }
            }
        };

        (api as any).editor = editor;
        (api as any).vimMode = vimMode;
        // (api as any).VimMode = VimMode;
        (window as any).editorApi = api;
        (window as any).Vim = VimMode;

        // Register Monaco Actions (Ctrl+S, Ctrl+Q)
        editor.addAction({
            id: "save-action",
            label: "Save File",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            run: () => api.onSave()
        });

        editor.addAction({
            id: "quit-action",
            label: "Quit Editor",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyQ],
            run: () => api.onQuit()
        });

        if (VimMode) {
            const vm = VimMode as any;
            const Vim = vm.Vim;

            // Register Vim Ex Commands (:w, :q) - these persist if Vim is re-enabled
            Vim.defineEx("write", "w", () => api.onSave());
            Vim.defineEx("save", null, () => api.onSave());
            Vim.defineEx("quit", "q", () => api.onQuit());

            // --- Vim Surround Implementation ---

            // Wait for the next pressed non-control/printable character
            const getNextChar = () => new Promise<string>((resolve) => {
                const disposable = editor!.onKeyDown((e) => {
                    // No modifier or special keys.
                    if (e.browserEvent.key.length === 1) {
                        e.preventDefault();
                        e.stopPropagation();
                        const key = e.browserEvent.key;
                        disposable.dispose();
                        resolve(key);
                    }
                });
            });

            // Should find any surrounding character. If it's a pairing character, then the matching reverse pairing character needs to be found.
            // Should intelligently skip escaped versions of the character
            const findSurrounding = (from: monaco.Position, char: string, escapeChar="\\") => {
                const model = editor!.getModel();
                if (!model) return null;
                const text = model.getValue();
                const offset = model.getOffsetAt(from);

                const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
                const revPairs: Record<string, string> = { ')': '(', ']': '[', '}': '{', '>': '<' };
                
                let openChar = char;
                let closeChar = char;
                if (pairs[char]) closeChar = pairs[char];
                else if (revPairs[char]) { openChar = revPairs[char]; closeChar = char; }

                let start = -1;
                let end = -1;
                let stack = 0;
                let escape = false;

                // Find opening character
                for (let i = offset - 1; i >= 0; i--) {
                    // The next character is escaped, so ignore it.
                    if (text[i] === escapeChar) {
                        escape = !escape;
                        continue;
                    }
                    if (text[i] === closeChar && openChar !== closeChar) stack++;
                    if (text[i] === openChar) {
                        if (stack === 0) { start = i; break; }
                        stack--;
                    }
                }

                // Find closing character
                stack = 0;
                for (let i = offset; i < text.length; i++) {
                    if (text[i] === escapeChar) {
                        escape = !escape;
                        continue;
                    }
                    if (text[i] === openChar && openChar !== closeChar) stack++;
                    if (text[i] === closeChar) {
                        if (stack === 0) { end = i+1; break; }
                        stack--;
                    }
                }

                return (start !== -1 && end !== -1) ? { start, end, openChar, closeChar } : null;
            };


            // An ex command that allows for manually typing around the surround action
            // Should allow for adding, removing, and replacing.
            // Syntax is :Surround <motion> <arg1> <arg2>
            // e.g. :Surround add iw (
            //       this would add the (i)n (w)ord selection inside of ( ).
            // The others:
            // :Surround delete "
            // :Surround replace ' "
            Vim.defineEx("Surround", null, async (vm: VimMode, params: object) => {
                // @ts-ignore
                const args = params.args || [];
                const action = args[0] || null as "add" | "delete" | "replace" | null;

                console.log(vm);

                // If the motion succeded, then we can get the range and move on.
                // const cursorHead = vm.getCursor("head");
                // const cursorTail = vm.getCursor("tail");

                if (action === "add") {
                    const motion = args[1];
                    const character = args[2];

                    // Get the resulting visual "selection" from the motion.
                    for (let i = 0; i < motion.length; i++) {
                        // @ts-ignore
                        const result = VimMode.Vim.handleKey(vm, motion[i], "visual");
                        if (result !== true) {
                            console.warn(`Motion failed with ${motion[i]}`);
                            return;
                        }
                    }

                    let text = vm.getSelection();
                    text = `${character}${text}${character}`;

                    const sel = editor?.getSelection();
                    const range = new monaco.Range(sel!.getStartPosition().lineNumber, sel!.getStartPosition().column, sel!.getEndPosition().lineNumber, sel!.getEndPosition().column)

                    editor?.executeEdits("surround-add", [{
                        range: range,
                        text: text
                    }]);

                    // @ts-ignore
                    VimMode.Vim.exitVisualMode(vm);
                    
                } else if (action === "delete") {
                    const character = args[1];
                    const pos = editor!.getPosition()!;
                    const model = editor!.getModel()!;

                    // Find the range that the character contains, exclusive.
                    // This will effectively give the text without the surrounding character!
                    const found = findSurrounding(pos, character);
                    if (found) {
                        const start = model.getPositionAt(found.start);
                        const end = model.getPositionAt(found.end);
                        const innerTextRange = new monaco.Range(start.lineNumber, start.column+1, end.lineNumber, end.column-1);
                        const outerRange = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
                        const text = model.getValueInRange(innerTextRange)!;

                        console.log(
                            editor!.executeEdits("surround-delete", [{
                                range: outerRange,
                                text: text
                            }])
                        );
                    }
                } else if (action === "replace") {
                    const fromChar = args[1];
                    const toChar = args[2];
                    const pos = editor!.getPosition()!;
                    const model = editor!.getModel()!;

                    // Find the range that the character contains, exclusive.
                    // This will effectively give the text without the surrounding character!
                    const found = findSurrounding(pos, fromChar);
                    if (found) {
                        const start = model.getPositionAt(found.start);
                        const end = model.getPositionAt(found.end);
                        const innerTextRange = new monaco.Range(start.lineNumber, start.column+1, end.lineNumber, end.column-1);
                        const outerRange = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
                        const text = model.getValueInRange(innerTextRange)!;

                        console.log(
                            editor!.executeEdits("surround-replace", [{
                                range: outerRange,
                                text: `${toChar}${text}${toChar}`
                            }])
                        );
                    }
                }
            });


            // Surround Visual (S in visual mode)
            Vim.defineAction("surroundVisual", async () => {
                const char = await getNextChar();
                console.log("nextChar: ", char);
                
                const selection = editor!.getSelection();
                if (!selection || selection.isEmpty()) return;
                
                const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
                const open = char;
                const close = pairs[char] || char;

                const model = editor!.getModel()!;
                editor!.executeEdits('surround', [
                    { range: monaco.Range.fromPositions(selection.getEndPosition(), selection.getEndPosition()), text: close },
                    { range: monaco.Range.fromPositions(selection.getStartPosition(), selection.getStartPosition()), text: open }
                ]);
            });

            Vim.mapCommand("S", "action", "surroundVisual", null, {context:"visual"});
        }
    }
});

onBeforeUnmount(() => {
    delete (window as any).editorApi;
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
            <div class="header-left">
                <a v-if="showBackLink" href="../" class="back-link">← Tools</a>
                <div class="file-info">
                    <span class="icon">📄</span>
                    <span class="filename">{{ fileName }}</span>
                </div>
            </div>
            <div class="actions">
                <div class="editor-settings">
                    <div v-if="showVimToggle" class="setting-item">
                        <label for="vim-toggle">Vim</label>
                        <input type="checkbox" id="vim-toggle" v-model="isVimEnabled" @change="toggleVim">
                    </div>
                    <div v-if="showLanguageSelector" class="setting-item">
                        <select v-model="currentLanguage" @change="setLanguage(currentLanguage)">
                            <option v-for="lang in languages" :key="lang.value" :value="lang.value">
                                {{ lang.name }}
                            </option>
                        </select>
                    </div>
                    <div v-if="showThemeSelector" class="setting-item custom-dropdown-wrapper">
                        <div class="theme-trigger" @click="isThemeDropdownOpen = !isThemeDropdownOpen">
                            {{ themes.find(t => t.value === currentTheme)?.name || "Select Theme" }}
                            <span class="arrow">▾</span>
                        </div>
                        <div v-if="isThemeDropdownOpen" class="theme-dropdown" @mouseleave="restoreTheme">
                            <div 
                                v-for="theme in themes" 
                                :key="theme.value" 
                                class="theme-option"
                                :class="{ active: theme.value === currentTheme }"
                                @mouseenter="allowThemeLivePreview ? previewTheme(theme.value) : null"
                                @click="selectTheme(theme.value)"
                            >
                                {{ theme.name }}
                            </div>
                        </div>
                    </div>
                </div>
                <button class="btn-save" @click="saveFile">Save</button>
            </div>
        </header>
        <div ref="editorContainer" class="monaco-container"></div>
        <div ref="statusBar" class="vim-status-bar" v-show="isVimEnabled"></div>
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

.header-left {
    display: flex;
    align-items: center;
    gap: 20px;
}

.back-link {
    color: #007acc;
    text-decoration: none;
    font-size: 13px;
    font-family: sans-serif;
    font-weight: 500;
}

.back-link:hover {
    text-decoration: underline;
}

.file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    font-size: 13px;
}

.filename {
    color: #e1e1e1;
}

.actions {
    display: flex;
    align-items: center;
    gap: 15px;
}

.editor-settings {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 12px;
    color: #aaa;
    margin-right: 10px;
    border-right: 1px solid #444;
    padding-right: 15px;
}

.setting-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.setting-item select {
    background-color: #3c3c3c;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 2px 4px;
    font-size: 11px;
    outline: none;
}

.setting-item input[type="checkbox"] {
    cursor: pointer;
}

.custom-dropdown-wrapper {
    position: relative;
    user-select: none;
}

.theme-trigger {
    background-color: #3c3c3c;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 100px;
    justify-content: space-between;
}

.theme-trigger:hover {
    background-color: #454545;
}

.theme-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background-color: #252526;
    border: 1px solid #454545;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    max-height: 300px;
    overflow-y: auto;
    width: 180px;
    z-index: 1000;
}

.theme-option {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 11px;
    color: #ccc;
    transition: background-color 0.1s;
}

.theme-option:hover {
    background-color: #094771;
    color: white;
}

.theme-option.active {
    background-color: #37373d;
    color: #007acc;
    font-weight: bold;
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
    height: 1rem;
    background-color: #007acc;
    color: white;
    font-family: "Fira Code", monospace;
    font-size: 1rem;
    line-height: 1rem;
    display: flex;
    align-items: center;
    padding: 0.25rem 10px;
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
    font-family: "Segoe UI", sans-serif;
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

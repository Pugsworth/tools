<script setup lang="ts">
import { ref, onMounted, shallowRef, useTemplateRef } from 'vue'
import { pipeline } from '@huggingface/transformers'
import { Upload, Play, Download, Settings2, Image as ImageIconLucide, ChevronRight, ChevronLeft } from 'lucide-vue-next'

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const status = ref<'idle' | 'loading' | 'ready' | 'error' | 'processing'>('idle')
const progress = ref(0)
const loadingStatus = ref('')
const errorMessage = ref('')
const depthPipeline = shallowRef<any>(null)

const originalImage = ref<string | null>(null)
const processedImage = ref<string | null>(null)
const selectedImageFile = ref<File | null>(null)

const processedMaps = ref<{ depth: string | null; color: string | null }>({ depth: null, color: null })
const activeMapType = ref<'depth' | 'color'>('depth')
const rawDepthBuffer = shallowRef<Uint8ClampedArray | null>(null)
const renderSize = ref({ w: 0, h: 0 })

const colorSchemes = [
  { name: 'Turbo', id: 'turbo' },
  { name: 'Viridis', id: 'viridis' },
  { name: 'Magma', id: 'magma' },
  { name: 'Inferno', id: 'inferno' },
  { name: 'Classic (Blue-Red)', id: 'classic' }
]
const activeColorScheme = ref('turbo')

// Settings & Ext features
const selectedModel = ref('Xenova/depth-anything-small-hf')
const customModelId = ref('')
const modelOptions = [
  { name: 'Depth Anything (Small)', id: 'Xenova/depth-anything-small-hf' },
  { name: 'Depth Anything (Base)', id: 'Xenova/depth-anything-base-hf' },
  { name: 'DPT Large', id: 'Xenova/dpt-large' }
]

const outputResolution = ref(1024)
const isCompareMode = ref(false)
const comparePosition = ref(50)
const isFullscreen = ref(false)
const showSettings = ref(false)
const isDraggingSplitter = ref(false)
const inputCollapsed = ref(false)
const outputCollapsed = ref(false)

const toggleInputCollapse = () => {
  if (inputCollapsed.value) {
    inputCollapsed.value = false
  } else if (!outputCollapsed.value) {
    inputCollapsed.value = true
  }
}

const toggleOutputCollapse = () => {
  if (outputCollapsed.value) {
    outputCollapsed.value = false
  } else if (!inputCollapsed.value) {
    outputCollapsed.value = true
  }
}
const startDragging = () => { isDraggingSplitter.value = true }
const stopDragging = () => { isDraggingSplitter.value = false }

onMounted(async () => {
  await loadModel()
})

async function loadModel(modelId?: string) {
  const modelToLoad = modelId || selectedModel.value
  status.value = 'loading'
  loadingStatus.value = `Initializing ${modelToLoad.split('/').pop()}...`
  progress.value = 0

  try {
    if (depthPipeline.value) {
      depthPipeline.value = null
    }

    depthPipeline.value = await pipeline('depth-estimation', modelToLoad, {
      progress_callback: (p: any) => {
        if (p.status === 'progress') {
          progress.value = p.progress
          loadingStatus.value = `Downloading ${p.file.split('/').pop()}...`
        } else if (p.status === 'initiate') {
          loadingStatus.value = `Initiating ${p.file.split('/').pop()}...`
        } else if (p.status === 'done') {
          loadingStatus.value = `Finished loading ${p.file.split('/').pop()}`
        }
      }
    })
    status.value = 'ready'
    loadingStatus.value = 'AI Core Ready'
  } catch (err: any) {
    status.value = 'error'
    errorMessage.value = err.message || 'Failed to load model'
    console.error(err)
  }
}

async function handleModelChange() {
  await loadModel()
}

// function useCustomModel() { ... } (Removed as it was unused and replaced by inline logic if needed)

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    selectedImageFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      originalImage.value = e.target?.result as string
      processedImage.value = null
      processedMaps.value = { depth: null, color: null }
    }
    reader.readAsDataURL(file)
  }
}

async function processImage() {
  if (!originalImage.value || !depthPipeline.value) return

  status.value = 'processing'
  try {
    const result = await depthPipeline.value(originalImage.value)
    const depthImage = result.depth

    const imgObj = new Image()
    imgObj.src = originalImage.value
    await new Promise(r => imgObj.onload = r)

    const ratio = imgObj.width / imgObj.height
    let targetW = outputResolution.value
    let targetH = Math.round(outputResolution.value / (ratio || 1))
    renderSize.value = { w: targetW, h: targetH }

    // 1. Prepare Upscaled Raw Depth Buffer
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = depthImage.width
    tempCanvas.height = depthImage.height
    const tempCtx = tempCanvas.getContext('2d')!
    const tempIData = tempCtx.createImageData(depthImage.width, depthImage.height)
    for (let i = 0; i < depthImage.data.length; i++) {
      const v = depthImage.data[i];
      const idx = i * 4;
      tempIData.data[idx] = v; tempIData.data[idx + 1] = v; tempIData.data[idx + 2] = v; tempIData.data[idx + 3] = 255;
    }
    tempCtx.putImageData(tempIData, 0, 0)

    const mainCanvas = document.createElement('canvas')
    mainCanvas.width = targetW
    mainCanvas.height = targetH
    const mainCtx = mainCanvas.getContext('2d')!
    mainCtx.drawImage(tempCanvas, 0, 0, targetW, targetH)
    rawDepthBuffer.value = mainCtx.getImageData(0, 0, targetW, targetH).data

    await renderMaps()
    status.value = 'ready'
  } catch (err: any) {
    status.value = 'ready'
    errorMessage.value = err.message || 'Processing failed'
    console.error(err)
  }
}

async function renderMaps() {
  if (!rawDepthBuffer.value) return
  const { w, h } = renderSize.value
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!

  // 1. Depth Map (Grayscale)
  const dData = new Uint8ClampedArray(rawDepthBuffer.value)
  ctx.putImageData(new ImageData(dData, w, h), 0, 0)
  processedMaps.value.depth = canvas.toDataURL()

  // 2. Color Map
  const cData = new Uint8ClampedArray(rawDepthBuffer.value)
  for (let i = 0; i < cData.length; i += 4) {
    const v = (cData[i] as number) / 255
    let r = 0, g = 0, b = 0
    if (activeColorScheme.value === 'turbo') {
      r = Math.max(0, Math.min(255, (0.5 + Math.sin(Math.PI * (v * 2 - 1))) * 255))
      g = Math.max(0, Math.min(255, (0.5 + Math.sin(Math.PI * v)) * 255))
      b = Math.max(0, Math.min(255, (0.5 + Math.cos(Math.PI * v)) * 255))
    } else if (activeColorScheme.value === 'viridis') {
      r = v * 255; g = (1 - Math.abs(v - 0.5) * 2) * 255; b = (1 - v) * 255
    } else if (activeColorScheme.value === 'magma') {
      r = Math.pow(v, 0.4) * 255; g = Math.pow(v, 0.8) * 150; b = Math.pow(v, 2.0) * 100
    } else if (activeColorScheme.value === 'inferno') {
      r = Math.pow(v, 0.3) * 255; g = Math.pow(v, 1.2) * 220; b = 40
    } else {
      r = v * 255; g = 0; b = (1 - v) * 255
    }
    cData[i] = r; cData[i + 1] = g; cData[i + 2] = b
  }
  ctx.putImageData(new ImageData(cData, w, h), 0, 0)
  processedMaps.value.color = canvas.toDataURL()

  updateActiveMap()
}

function updateActiveMap() {
  processedImage.value = processedMaps.value[activeMapType.value as keyof typeof processedMaps.value]
}

function setMapType(type: 'depth' | 'color') {
  activeMapType.value = type
  updateActiveMap()
}

function downloadResult() {
  if (!processedImage.value) return
  const link = document.createElement('a')
  link.href = processedImage.value
  link.download = `preprocessed_${activeMapType.value}.png`
  link.click()
}

function handleCompareMove(e: MouseEvent | TouchEvent) {
  if (!isCompareMode.value || !isDraggingSplitter.value) return
  const container = (e.currentTarget as HTMLElement).closest('.group') as HTMLElement | null
  if (!container) return
  const rect = container.getBoundingClientRect()
  const x = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as MouseEvent).clientX
  const pos = ((x - rect.left) / rect.width) * 100
  comparePosition.value = Math.max(0, Math.min(100, pos))
}
</script>

<template>
  <div class="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans selection:bg-blue-500/30">
    <!-- Header (Overlay) -->
    <header class="absolute top-0 inset-x-0 z-50 p-6 flex items-center justify-between pointer-events-none">
      <div
        class="pointer-events-auto bg-slate-950/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-2xl">
        <h1
          class="text-xl font-black tracking-tighter bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          DEPTH AI PRO
        </h1>
      </div>

      <div class="flex items-center gap-2 pointer-events-auto">
        <div v-if="status === 'loading'"
          class="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/5 text-[10px] font-bold">
          {{ Math.round(progress) }}% {{ loadingStatus }}
        </div>
        <button @click="showSettings = !showSettings"
          class="p-3 bg-slate-900/80 backdrop-blur-md hover:bg-slate-800 rounded-2xl border border-white/5 transition-all shadow-2xl">
          <Settings2 class="w-5 h-5 text-slate-400" />
        </button>
      </div>
    </header>

    <transition enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform -translate-y-4 opacity-0 scale-95"
      enter-to-class="transform translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100 scale-100"
      leave-to-class="transform -translate-y-4 opacity-0 scale-95">
      <div v-if="showSettings"
        class="fixed top-24 right-6 z-[60] glass p-6 rounded-3xl w-80 shadow-3xl border border-white/10">
        <div class="space-y-6">
          <div class="space-y-3">
            <label class="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
              <Settings2 class="w-3 h-3" /> Select Model
            </label>
            <select v-model="selectedModel" @change="handleModelChange"
              class="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 outline-none">
              <option v-for="opt in modelOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
            </select>
          </div>

          <div class="space-y-3">
            <label class="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
              <ImageIconLucide class="w-3 h-3" /> Output Resolution
            </label>
            <div class="flex items-center gap-4">
              <input type="range" min="256" max="2560" step="128" v-model.number="outputResolution"
                class="flex-grow h-1.5 bg-slate-800 rounded-full appearance-none accent-blue-500">
              <span class="text-[10px] font-mono w-12 text-right text-blue-400">{{ outputResolution }}px</span>
            </div>
          </div>

          <div class="space-y-3">
            <label class="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
              <Play class="w-3 h-3" /> Mode
            </label>
            <label
              class="flex items-center gap-3 cursor-pointer group p-2 bg-slate-900 rounded-xl border border-white/5">
              <input type="checkbox" v-model="isCompareMode"
                class="w-4 h-4 rounded bg-slate-950 border-white/10 checked:bg-blue-600 transition-all cursor-pointer">
              <span class="text-[10px] font-bold uppercase group-hover:text-blue-400 transition-colors">Split
                View</span>
            </label>
          </div>
        </div>
      </div>
    </transition>

    <!-- Expansive Work Area -->
    <main class="flex-grow flex flex-row overflow-hidden relative">

      <section :class="[
        'transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] relative flex-shrink-0 flex',
        inputCollapsed ? 'w-16 bg-slate-900 border-r border-white/5' : 'flex-1 border-r border-white/5'
      ]">
        <!-- Expand Sidebar Button (Left) -->
        <button v-if="inputCollapsed" @click="toggleInputCollapse"
          class="flex-grow flex flex-col items-center justify-center gap-4 bg-blue-600/10 hover:bg-blue-600/20 transition-colors group">
          <ChevronRight
            class="w-5 h-5 text-blue-400 group-hover:text-blue-300 group-hover:scale-125 transition-transform" />
          <div
            class="rotate-90 origin-center whitespace-nowrap text-[9px] font-black uppercase tracking-[0.4em] text-blue-400/60 group-hover:text-blue-400">
            EXPAND INPUT</div>
        </button>

        <div v-else class="absolute inset-0 bg-slate-900/10 flex flex-col">
          <!-- Collapse Button Overlay (Fixed Corner) -->
          <button v-if="!outputCollapsed" @click="toggleInputCollapse"
            class="absolute top-1/2 -translate-y-1/2 right-4 z-50 p-3 bg-slate-900 shadow-2xl rounded-full border border-white/10 hover:bg-slate-800 hover:border-blue-500/50 transition-all text-slate-300 hover:text-white group">
            <ChevronLeft class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <!-- Image Hub -->
          <div class="h-full w-full relative flex items-center justify-center p-12 overflow-hidden"
            @click="!originalImage && fileInput?.click()">
            <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileSelect">
            <div v-if="!originalImage" class="flex flex-col items-center gap-6 cursor-pointer group">
              <div
                class="p-8 bg-slate-900 rounded-3xl border border-white/5 group-hover:border-blue-500/50 shadow-2xl transition-all">
                <Upload
                  class="w-12 h-12 text-slate-600 group-hover:text-blue-400 group-hover:scale-110 transition-all" />
              </div>
              <div class="text-center">
                <p
                  class="text-xs font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-white transition-colors">
                  Select Base Image</p>
              </div>
            </div>

            <img v-else :src="originalImage" class="w-full h-full object-contain drop-shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              alt="Original">

            <div v-if="originalImage" class="absolute bottom-10 inset-x-10 flex justify-center gap-3">
              <button @click="fileInput?.click()"
                class="p-5 bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl transition-all text-slate-400 hover:text-white group"
                title="Upload New Image">
                <Upload class="w-5 h-5" />
              </button>
              <button @click="processImage" :disabled="status !== 'ready'"
                class="flex-grow py-5 bg-blue-600 hover:bg-blue-500 font-black uppercase tracking-widest text-xs rounded-2xl shadow-3xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50">
                <span v-if="status === 'processing'">Processing...</span>
                <span v-else>Synthesize Depth</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section :class="[
        'transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] relative flex-shrink-0 flex',
        outputCollapsed ? 'w-16 bg-slate-900 border-l border-white/5' : 'flex-1'
      ]">
        <!-- Expand Sidebar Button (Right) -->
        <button v-if="outputCollapsed" @click="toggleOutputCollapse"
          class="flex-grow flex flex-col items-center justify-center gap-4 bg-blue-600/10 hover:bg-blue-600/20 transition-colors group">
          <ChevronLeft
            class="w-5 h-5 text-blue-400 group-hover:text-blue-300 group-hover:scale-125 transition-transform" />
          <div
            class="-rotate-90 origin-center whitespace-nowrap text-[9px] font-black uppercase tracking-[0.4em] text-blue-400/60 group-hover:text-blue-400">
            EXPAND RESULT</div>
        </button>

        <div v-else class="absolute inset-0 bg-slate-950/20 flex flex-col">
          <!-- Collapse Button Overlay (Fixed Corner) -->
          <button v-if="!inputCollapsed" @click="toggleOutputCollapse"
            class="absolute top-1/2 -translate-y-1/2 left-4 z-50 p-3 bg-slate-900 shadow-2xl rounded-full border border-white/10 hover:bg-slate-800 hover:border-blue-500/50 transition-all text-slate-300 hover:text-white group">
            <ChevronRight class="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div class="h-full w-full relative flex items-center justify-center p-12 overflow-hidden group/out"
            @mousemove="handleCompareMove" @touchmove="handleCompareMove" @mouseup="stopDragging"
            @mouseleave="stopDragging" @touchend="stopDragging">

            <div v-if="!processedImage" class="flex flex-col items-center gap-6 text-slate-800">
              <ImageIconLucide class="w-20 h-20 animate-pulse-soft opacity-20" />
              <p class="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Analytical Engine Standby</p>
            </div>

            <template v-else>
              <!-- Image Displays -->
              <div v-if="isCompareMode" class="h-full w-full relative flex items-center justify-center"
                @mousedown="startDragging">
                <img :src="processedImage" class="w-full h-full object-contain" :alt="activeMapType">
                <div v-if="originalImage" class="absolute inset-0 flex items-center justify-center pointer-events-none"
                  :style="{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }">
                  <img :src="originalImage" class="w-full h-full object-contain" alt="Original">
                </div>
                <!-- Multi-Handle Splitter -->
                <div class="absolute inset-y-0 w-px bg-white/20 z-20 pointer-events-none"
                  :style="{ left: comparePosition + '%' }">
                  <div
                    class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 p-1 bg-white rounded-full cursor-col-resize pointer-events-auto shadow-2xl">
                    <div class="w-1 h-12 bg-slate-950 rounded-full"></div>
                  </div>
                </div>
              </div>
              <img v-else :src="processedImage"
                class="w-full h-full object-contain transition-transform duration-700 group-hover/out:scale-[1.01]"
                :alt="activeMapType">

              <!-- Dynamic Overlays -->
              <div
                class="absolute top-12 left-1/2 -translate-x-1/2 flex gap-1 p-1 bg-slate-950/60 backdrop-blur-2xl rounded-2xl border border-white/5 opacity-0 group-hover/out:opacity-100 transition-all">
                <button v-for="t in (['depth', 'color'] as const)" :key="t" @click="setMapType(t)" :class="['px-6 py-2 text-[9px] font-black uppercase rounded-xl transition-all',
                  activeMapType === t ? 'bg-white text-slate-950' : 'text-slate-500 hover:text-white']">
                  {{ t }}
                </button>
              </div>

              <div
                class="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-950/60 backdrop-blur-2xl p-2 rounded-2xl border border-white/5 opacity-0 group-hover/out:opacity-100 transition-all">
                <div class="flex gap-1 border-r border-white/5 pr-4 mr-2">
                  <button v-for="scheme in colorSchemes" :key="scheme.id"
                    @click="activeColorScheme = scheme.id; renderMaps()"
                    :class="['w-4 h-4 rounded-full border border-white/10 transition-all',
                      activeColorScheme === scheme.id ? 'ring-4 ring-blue-500 scale-110' : 'opacity-40 hover:opacity-100']"
                    :style="{ background: scheme.id === 'turbo' ? 'linear-gradient(to bottom, #f00, #0f0, #00f)' : scheme.id === 'viridis' ? 'linear-gradient(to bottom, #440154, #21918c, #fde725)' : '#333' }"
                    :title="scheme.name"></button>
                </div>
                <button @click="isFullscreen = true" class="p-3 text-slate-400 hover:text-white transition-colors"
                  title="Fullscreen">
                  <Play class="w-5 h-5 -rotate-90 scale-75" />
                </button>
                <button @click="downloadResult" class="p-3 text-blue-400 hover:text-blue-300 transition-colors"
                  title="Download">
                  <Download class="w-5 h-5 scale-90" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </section>
    </main>

    <section class="absolute top-24 left-12 z-50 pointer-events-none">
      <div v-if="!showSettings"
        class="pointer-events-auto glass p-6 rounded-3xl space-y-3 shadow-3xl border border-white/10 opacity-40 hover:opacity-100 transition-all">
        <h3 class="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">ENGINE STATS</h3>
        <div class="flex flex-col gap-3 text-[10px] font-bold font-mono leading-none">
          <p class="text-blue-400 flex justify-between gap-8"><span class="text-slate-600">OUT:</span> {{
            outputResolution
          }}PX</p>
          <p class="text-indigo-400 flex justify-between gap-8"><span class="text-slate-600">MDL:</span>
            DEPTH-ANYTHING-S
          </p>
        </div>
      </div>
    </section>

    <!-- Footer Overlay -->
    <footer
      class="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 text-slate-600 text-[8px] uppercase tracking-[0.3em] font-bold">
      Transformers.js &bull; Vite &bull; Privacy First
    </footer>
  </div>

  <!-- Error Toast -->
  <div v-if="errorMessage"
    class="fixed bottom-8 right-8 z-[100] px-6 py-4 bg-red-950/80 border border-red-900/50 backdrop-blur-md rounded-xl text-red-200 flex items-center gap-4 animate-in slide-in-from-bottom-4">
    <div class="p-2 bg-red-500/20 rounded-lg">
      <Upload class="w-5 h-5" />
    </div>
    <div>
      <p class="font-bold text-sm">Error Detected</p>
      <p class="text-xs opacity-80">{{ errorMessage }}</p>
    </div>
    <button @click="errorMessage = ''" class="ml-4 text-xs underline hover:text-white">Dismiss</button>
  </div>

  <!-- Fullscreen Modal -->
  <transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
    <div v-if="isFullscreen" class="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col p-8">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold uppercase tracking-widest text-blue-400">Fullscreen View &bull; {{ activeMapType }}
        </h2>
        <button @click="isFullscreen = false"
          class="p-4 bg-slate-900 hover:bg-red-900 rounded-full transition-colors border border-slate-800">
          <Upload class="w-6 h-6 rotate-45" />
        </button>
      </div>
      <div class="flex-grow flex items-center justify-center min-h-0">
        <img :src="processedImage!" class="max-w-full max-h-full object-contain shadow-2xl" :alt="activeMapType">
      </div>
      <div class="mt-6 flex justify-center gap-4">
        <button @click="downloadResult" class="btn-primary flex items-center gap-2">
          <Download class="w-4 h-4" /> Download Result
        </button>
      </div>
    </div>
  </transition>
</template>

<style>
@keyframes pulse-soft {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

.animate-pulse-soft {
  animation: pulse-soft 2s infinite ease-in-out;
}
</style>

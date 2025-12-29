<style scoped>
body {
  background-color: #101010;
  color: #e5e7eb;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Pixel art vibe for the palette preview */
.color-chip {
  transition: transform 0.1s;
}

.color-chip:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.loader {
  border: 4px solid #333;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}

.loader-sm {
  border: 2px solid #333;
  border-top: 2px solid #9ca2af;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.pixelated {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
</style>


<script setup>
import { ref } from 'vue';

const urlInput = ref('');
const palettes = ref([]);
const isLoading = ref(false);
const error = ref('');
const selectedPalette = ref(null);

// Image Zoom State
const zoomLevel = ref(1);
const zoomOrigin = ref({ x: 50, y: 50 });

// Toast System
const toasts = ref([]);
let toastIdCounter = 0;

const showToast = (msg, type = 'success') => {
  const id = toastIdCounter++;
  toasts.value.push({ id, message: msg, type });
  // Auto remove after 4 seconds
  setTimeout(() => {
    removeToast(id);
  }, 4000);
};

const removeToast = (id) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) toasts.value.splice(index, 1);
};

const validateUrl = (url) => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.includes('lospec.com') && u.pathname.includes('/palette-list/');
  } catch (e) {
    return false;
  }
};

// Image Zoom Handlers
const toggleZoom = (e) => {
  // Cycle zoom levels: 1 -> 2 -> 4 -> 1
  if (zoomLevel.value === 1) zoomLevel.value = 2;
  else if (zoomLevel.value === 2) zoomLevel.value = 4;
  else zoomLevel.value = 1;

  // Update origin immediately on click so zoom happens towards mouse
  if (zoomLevel.value > 1) {
    updateZoomOrigin(e);
  } else {
    // When resetting to 1 via click, center it back nicely
    zoomOrigin.value = { x: 50, y: 50 };
  }
};

const handleZoomMove = (e) => {
  // Only update origin (pan) if we are zoomed in
  if (zoomLevel.value > 1) {
    updateZoomOrigin(e);
  }
};

const updateZoomOrigin = (e) => {
  // Use currentTarget to get the container's rect, which doesn't scale
  const rect = e.currentTarget.getBoundingClientRect();

  // Calculate percentage position of mouse within container
  // This becomes the transform-origin.
  // If origin is at mouse position, scaling up keeps that point under mouse.
  // Moving mouse updates origin, which effectively "pans" the zoomed image.
  const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

  zoomOrigin.value = { x, y };
};

const resetZoom = () => {
  zoomLevel.value = 1;
  zoomOrigin.value = { x: 50, y: 50 };
};

const openModal = (palette) => {
  selectedPalette.value = palette;
  document.body.style.overflow = 'hidden';
  resetZoom(); // Ensure clean state
};

const closeModal = () => {
  selectedPalette.value = null;
  document.body.style.overflow = '';
  resetZoom();
};

// Generic fetcher with proxy rotation
const fetchUrlContent = async (url, expectedType = 'text') => {
  const proxies = [
    { prefix: 'https://corsproxy.io/?', type: 'direct' },
    { prefix: 'https://api.codetabs.com/v1/proxy?quest=', type: 'direct' },
    { prefix: 'https://thingproxy.freeboard.io/fetch/', type: 'direct' },
    { prefix: 'https://api.allorigins.win/get?url=', type: 'json_wrapper' } // Returns { contents: "..." }
  ];

  for (const proxy of proxies) {
    try {
      const fetchUrl = `${proxy.prefix}${encodeURIComponent(url)}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) continue;

      if (proxy.type === 'json_wrapper') {
        const data = await response.json();
        const content = data.contents;
        if (!content) continue;

        // If we want JSON back, parse the string content if it's stringified
        if (expectedType === 'json' && typeof content === 'string') {
          try { return JSON.parse(content); } catch (e) { return null; }
        }
        return content;
      } else {
        // Direct proxies
        if (expectedType === 'json') {
          return await response.json();
        } else {
          return await response.text();
        }
      }
    } catch (e) {
      console.warn(`Proxy ${proxy.prefix} failed`, e);
    }
  }
  throw new Error("All proxies failed");
};

const addPalette = async () => {
  error.value = '';
  if (!urlInput.value) return;

  const rawInput = urlInput.value;
  // Split by newline, comma, or space, remove empty
  const urls = rawInput.split(/[\n,\s]+/).filter(u => u.trim().length > 0);

  if (urls.length === 0) return;

  // Filter valid URLs
  const validUrls = urls.filter(u => validateUrl(u));

  if (validUrls.length === 0) {
    error.value = "No valid Lospec palette URLs found.";
    showToast("No valid URLs found", 'error');
    return;
  }

  // Check duplicates (pre-filtering to warn user)
  const uniqueUrls = validUrls.filter(u => !palettes.value.some(p => p.originalUrl === u));

  if (uniqueUrls.length === 0 && validUrls.length > 0) {
    showToast("All entered palettes already added", 'warning');
    urlInput.value = '';
    return;
  }

  isLoading.value = true;
  urlInput.value = ''; // Clear input immediately

  if (uniqueUrls.length > 1) {
    showToast(`Fetching ${uniqueUrls.length} palettes...`, 'info');
  } else {
    showToast("Fetching palette...", 'info');
  }

  // Process concurrently
  await Promise.all(uniqueUrls.map(url => processPalette(url)));

  isLoading.value = false;
};

const processPalette = async (targetUrl) => {
  // Strategy: Try Fast JSON fetch first
  const jsonUrl = targetUrl.endsWith('.json') ? targetUrl : targetUrl + '.json';

  try {
    const jsonData = await fetchUrlContent(jsonUrl, 'json');

    if (jsonData && jsonData.colors) {
      const palette = {
        name: jsonData.name || 'Unknown Palette',
        author: jsonData.author || 'Unknown',
        authorLink: `https://lospec.com/${jsonData.author}` || '#',
        colors: jsonData.colors.map(c => '#' + c), // JSON has raw hex
        exampleImage: null,
        tags: [],
        originalUrl: targetUrl,
        slug: jsonData.slug || (Date.now() + Math.random()), // Prevent collision in bulk
        loadingDetails: true // Flag to show loaders for image/tags
      };

      palettes.value.unshift(palette);
      showToast(`Loaded: ${palette.name}`, 'success');

      // Trigger background fetch for the rest
      fetchPaletteDetails(targetUrl, palette);
      return;
    }
  } catch (e) {
    // console.warn("JSON fetch failed, falling back to full HTML scrape.", e);
  }

  // Fallback Strategy: Full HTML Scrape (Slow)
  try {
    const htmlContent = await fetchUrlContent(targetUrl, 'text');
    const paletteData = parseLospecHtml(htmlContent, targetUrl);

    if (paletteData) {
      paletteData.loadingDetails = false;
      paletteData.slug = Date.now() + Math.random();
      palettes.value.unshift(paletteData);
      showToast(`Loaded: ${paletteData.name} (HTML)`, 'success');
    } else {
      showToast(`Could not parse data: ${targetUrl}`, 'error');
    }
  } catch (e) {
    console.error("Fetch failed", e);
    showToast(`Failed to load: ${targetUrl}`, 'error');
  }
};

const fetchPaletteDetails = async (url, paletteObj) => {
  try {
    const htmlContent = await fetchUrlContent(url, 'text');
    // Use the existing parser to extract specific bits
    const details = parseLospecHtml(htmlContent, url);

    if (details) {
      paletteObj.exampleImage = details.exampleImage;
      paletteObj.tags = details.tags;
      // Update author link if the HTML version is better (sometimes JSON author is just name)
      if (details.authorLink && details.authorLink !== '#' && details.authorLink.length > paletteObj.authorLink.length) {
        paletteObj.authorLink = details.authorLink;
      }
    }
  } catch (e) {
    console.warn("Background detail fetch failed", e);
  } finally {
    paletteObj.loadingDetails = false;
  }
};

const parseLospecHtml = (htmlString, originalUrl) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  try {
    // Extract Name
    const nameEl = doc.querySelector('h1 .palette-name') || doc.querySelector('h1');
    const name = nameEl ? nameEl.textContent.trim() : 'Unknown Palette';

    // Extract Author
    let authorEl = doc.querySelector('.user-link a, .user-link');
    if (!authorEl) authorEl = doc.querySelector('.attribution a');
    if (!authorEl) authorEl = doc.querySelector('h1 + div a');

    const author = authorEl ? authorEl.textContent.trim() : 'Unknown';
    const authorLink = authorEl ? 'https://lospec.com' + authorEl.getAttribute('href') : '#';

    // Extract Colors
    const colors = [];
    // Selector A: Standard ".palette-color" (old)
    let colorDivs = doc.querySelectorAll('.palette-color');

    // Selector B: Nested ".palette .color" (new/seen in snippet)
    if (colorDivs.length === 0) {
      colorDivs = doc.querySelectorAll('.palette .color');
    }

    if (colorDivs.length > 0) {
      colorDivs.forEach(div => {
        let hex = rgb2hex(div.style.backgroundColor);
        if (!hex && div.textContent.includes('#')) {
          hex = div.textContent.trim().match(/#[0-9a-fA-F]{6}/)?.[0];
        }
        if (hex) colors.push(hex);
      });
    }

    // Fallback: Textarea extraction
    if (colors.length === 0) {
      const textArea = doc.querySelector('.palette-info textarea');
      if (textArea) {
        const raw = textArea.textContent;
        if (raw.includes(',')) {
          const splitColors = raw.split(',').map(c => '#' + c.trim().replace('#', ''));
          splitColors.forEach(c => colors.push(c));
        }
      }
    }

    // Extract Example Image
    let imgEl = doc.querySelector('#palette-examples img, .palette-examples img');
    if (!imgEl) {
      imgEl = doc.querySelector('.examples img');
    }

    let exampleImage = null;
    if (imgEl) {
      exampleImage = imgEl.getAttribute('src');
      if (exampleImage && !exampleImage.startsWith('http')) {
        exampleImage = 'https://lospec.com' + exampleImage;
      }
    }

    // Extract Tags
    const tags = [];
    let tagLinks = doc.querySelectorAll('.tag-link');
    if (tagLinks.length === 0) {
      tagLinks = doc.querySelectorAll('a[href*="/palette-list/tag/"]');
    }
    tagLinks.forEach(t => tags.push(t.textContent.trim()));

    return {
      name,
      author,
      authorLink,
      colors: colors.map(c => c.toUpperCase()),
      exampleImage,
      tags,
      originalUrl,
      slug: Date.now()
    };

  } catch (e) {
    console.error("Parsing Error", e);
    return null;
  }
};

const rgb2hex = (rgb) => {
  if (!rgb) return null;
  if (rgb.startsWith('#')) return rgb;
  const rgbMatch = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!rgbMatch) return null;
  const hex = (x) => ("0" + parseInt(x).toString(16)).slice(-2);
  return "#" + hex(rgbMatch[1]) + hex(rgbMatch[2]) + hex(rgbMatch[3]);
};

const deletePalette = (index) => {
  palettes.value.splice(index, 1);
};

const copyCSV = (colors) => {
  const csv = colors.map(c => c.replace('#', '')).join(',');
  navigator.clipboard.writeText(csv).then(() => {
    showToast('Copied HEX string to clipboard!', 'success');
  });
};

const copyColor = (color) => {
  navigator.clipboard.writeText(color).then(() => {
    showToast(`Copied ${color} to clipboard!`, 'success');
  });
};

const copyJSON = (palette) => {
  const data = {
    name: palette.name,
    colors: palette.colors
  };
  navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
    showToast('Copied Palette JSON to clipboard!', 'success');
  });
};

const getPreviewRows = (colors) => {
  if (!colors) return [];
  const limit = 32;
  const count = Math.min(colors.length, limit);
  // If 16 or fewer, one row
  if (count <= 16) {
    return [colors.slice(0, count)];
  }
  // Two rows, split evenly
  const mid = Math.ceil(count / 2);
  return [
    colors.slice(0, mid),
    colors.slice(mid, count).reverse() // Inversed for visual flow (snake pattern)
  ];
};
</script>



<template>

  <!-- Header -->
  <header class="w-full max-w-4xl mb-8 text-center">
    <h1 class="text-3xl font-bold mb-2 flex items-center justify-center gap-3">
      <i class="fas fa-palette text-blue-500"></i>
      <span>Lospec Extractor</span>
    </h1>
    <p class="text-gray-400 text-sm">Paste Lospec URLs (separated by spaces or new lines) to extract palettes</p>
  </header>

  <!-- Input Section -->
  <div class="w-full max-w-2xl mb-10">
    <div class="flex flex-col gap-2 relative">
      <div class="flex shadow-lg rounded-lg overflow-hidden border border-gray-700 bg-lospec-card items-stretch">
        <textarea v-model="urlInput" @keydown.enter.exact.prevent="addPalette"
          placeholder="https://lospec.com/palette-list/endesga-32&#10;https://lospec.com/palette-list/apollo"
          class="flex-grow bg-lospec-card text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-600 resize-none h-16 min-h-[4rem] leading-snug"></textarea>
        <button @click="addPalette" :disabled="isLoading"
          class="bg-blue-600 hover:bg-blue-700 text-white px-6 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]">
          <div v-if="isLoading" class="loader"></div>
          <span v-else>Load</span>
        </button>
      </div>
      <p v-if="error" class="text-red-400 text-xs mt-1 absolute -bottom-6 left-1">
        <i class="fas fa-exclamation-circle mr-1"></i> {{ error }}
      </p>
    </div>

    <!-- Quick Paste Suggestions -->
    <div class="mt-3 flex gap-2 overflow-x-auto pb-2 text-xs text-gray-500">
      <span class="whitespace-nowrap">Try:</span>
      <button @click="urlInput = 'https://lospec.com/palette-list/sweet-canyon-32'; addPalette()"
        class="hover:text-blue-400 underline whitespace-nowrap">Sweet Canyon 32</button>
      <button @click="urlInput = 'https://lospec.com/palette-list/apollo'; addPalette()"
        class="hover:text-blue-400 underline whitespace-nowrap">Apollo</button>
      <button @click="urlInput = 'https://lospec.com/palette-list/kirokaze-gameboy'; addPalette()"
        class="hover:text-blue-400 underline whitespace-nowrap">Kirokaze GB</button>
      <button
        @click="urlInput = 'https://lospec.com/palette-list/slso8 https://lospec.com/palette-list/nintendo-gameboy-bgb';"
        class="hover:text-blue-400 underline whitespace-nowrap">Multiple</button>
    </div>
  </div>

  <!-- Palette Grid -->
  <div v-if="palettes.length > 0" class="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div v-for="(palette, index) in palettes" :key="palette.slug"
      class="bg-lospec-card rounded-xl overflow-hidden shadow-xl border border-gray-800 hover:border-gray-600 transition-all cursor-pointer group flex flex-col"
      @click="openModal(palette)">
      <!-- Preview Header -->
      <div class="p-4 border-b border-gray-800 flex justify-between items-start">
        <div>
          <h3 class="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{{ palette.name }}</h3>
          <p class="text-xs text-gray-500">by {{ palette.author || 'Unknown' }} • {{ palette.colors.length }} colors
          </p>
        </div>
        <button @click.stop="deletePalette(index)" class="text-gray-600 hover:text-red-400 transition-colors p-1"
          title="Remove">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Colors Strip (Mini Preview) -->
      <div class="flex flex-col h-8 w-full">
        <div v-for="(row, rIndex) in getPreviewRows(palette.colors)" :key="rIndex" class="flex w-full flex-1">
          <div v-for="(color, cIndex) in row" :key="cIndex" :style="{ backgroundColor: color }"
            class="h-full flex-grow"></div>
        </div>
      </div>

      <!-- Content Body -->
      <div class="p-4 flex-grow flex flex-col gap-4">
        <!-- Example Image Thumbnail -->
        <div
          class="w-full h-32 rounded-lg overflow-hidden flex items-center justify-center border border-gray-800 relative">
          <img v-if="palette.exampleImage" :src="palette.exampleImage"
            class="max-w-full max-h-full object-contain pixelated" alt="Example">
          <div v-else-if="palette.loadingDetails" class="flex flex-col items-center text-gray-600">
            <div class="loader-sm mb-2"></div>
            <span class="text-xs">Fetching example...</span>
          </div>
          <div v-else class="text-gray-700 text-xs">
            No preview image
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-auto pt-2 flex justify-between items-center">
          <button @click.stop="copyCSV(palette.colors)"
            class="bg-gray-700 hover:bg-gray-600 text-xs text-white px-3 py-1.5 rounded transition-colors flex items-center gap-2">
            <i class="fas fa-copy"></i> Copy HEX
          </button>
          <div class="flex items-center gap-2">
            <div v-if="palette.loadingDetails" class="loader-sm" title="Loading details..."></div>
            <span class="text-xs text-gray-600">Click for details</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-else-if="!isLoading" class="text-center text-gray-600 mt-10">
    <i class="fas fa-ghost text-4xl mb-4 opacity-20"></i>
    <p>No palettes loaded yet.</p>
  </div>

  <!-- Modal Detail View -->
  <div v-if="selectedPalette"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-sm"
    @click.self="closeModal">
    <div
      class="bg-lospec-card w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden animate-fade-in">

      <!-- Modal Header -->
      <div class="p-5 border-b border-gray-700 flex justify-between items-center bg-[#1e1e1e]">
        <div>
          <h2 class="text-2xl font-bold text-white">{{ selectedPalette.name }}</h2>
          <p class="text-sm text-gray-400">
            Created by <a :href="selectedPalette.authorLink" target="_blank" class="text-blue-400 hover:underline">{{
              selectedPalette.author || 'Unknown' }}</a>
          </p>
        </div>
        <button @click="closeModal" class="text-gray-400 hover:text-white transition-colors p-2 text-xl">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Modal Content Scrollable -->
      <div class="overflow-y-auto p-6 custom-scrollbar">

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Left Column: Colors -->
          <div class="flex flex-col gap-6">

            <!-- Color Grid -->
            <div>
              <div class="flex justify-between items-end mb-2">
                <h3 class="text-lg font-semibold text-gray-300">Palette</h3>
                <div class="text-xs text-gray-500 font-mono">{{ selectedPalette.colors.length }} colors</div>
              </div>

              <!-- Responsive grid based on color count -->
              <div class="flex flex-wrap shadow-inner bg-[#111] p-2 rounded-lg border border-gray-700">
                <div v-for="(color, idx) in selectedPalette.colors" :key="idx"
                  class="color-chip relative group cursor-pointer w-8 h-8 md:w-10 md:h-10"
                  :style="{ backgroundColor: color }" @click="copyColor(color)" :title="color">
                  <!-- Tooltip on hover -->
                  <span
                    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20">
                    {{ color }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-3">
              <button @click="copyCSV(selectedPalette.colors)"
                class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg">
                <i class="fas fa-copy"></i> Copy HEX
              </button>
              <button @click="copyJSON(selectedPalette)"
                class="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-gray-600">
                <i class="fas fa-code"></i> Copy JSON
              </button>
              <a :href="selectedPalette.originalUrl" target="_blank"
                class="flex-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300 border border-gray-600 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                <i class="fas fa-external-link-alt"></i> Original
              </a>
            </div>
          </div>

          <!-- Right Column: Images & Info -->
          <div class="flex flex-col gap-6">
            <div>
              <h3 class="text-lg font-semibold text-gray-300 mb-2">Example Usage</h3>

              <!-- Interactive Zoom Image Container -->
              <div
                class="rounded-lg overflow-hidden border border-gray-700 bg-black flex justify-center items-center h-80 relative select-none"
                :class="zoomLevel > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'" @click="toggleZoom"
                @mousemove="handleZoomMove" title="Click to zoom, move to pan">
                <template v-if="selectedPalette.exampleImage">
                  <!-- Using a full-size div for mouse tracking relative to container, applying transform to image -->
                  <img :src="selectedPalette.exampleImage"
                    class="w-full h-full object-contain transition-transform duration-100 ease-linear block"
                    :class="{ 'pixelated': zoomLevel > 1 }" :style="{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`
                    }" alt="Palette Example">

                  <!-- Zoom indicator overlay -->
                  <div v-if="zoomLevel > 1"
                    class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded pointer-events-none">
                    {{ zoomLevel }}x
                  </div>
                </template>

                <div v-else-if="selectedPalette.loadingDetails" class="text-gray-500 flex flex-col items-center">
                  <div class="loader-sm mb-2"></div>
                  <span>Fetching image...</span>
                </div>
                <span v-else class="text-gray-600 text-sm">No example available</span>
              </div>
            </div>

            <div class="mt-auto">
              <h3 class="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wider">Tags</h3>
              <div v-if="selectedPalette.tags && selectedPalette.tags.length" class="flex flex-wrap gap-2">
                <span v-for="tag in selectedPalette.tags"
                  class="px-2 py-1 bg-[#1a1a1a] text-gray-400 text-xs rounded border border-gray-800">
                  {{ tag }}
                </span>
              </div>
              <div v-else-if="selectedPalette.loadingDetails" class="text-gray-600 text-xs">
                <div class="loader-sm mr-2"></div> Loading tags...
              </div>
              <div v-else class="text-gray-700 text-xs italic">No tags found</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Toast Notification Container (Stacking) -->
  <div
    class="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col-reverse gap-2 z-[60] items-center pointer-events-none">
    <div v-for="t in toasts" :key="t.id"
      class="bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-gray-700 animate-slide-up pointer-events-auto min-w-[300px]">
      <i v-if="t.type === 'success'" class="fas fa-check-circle text-green-400"></i>
      <i v-else-if="t.type === 'error'" class="fas fa-times-circle text-red-400"></i>
      <i v-else-if="t.type === 'info'" class="fas fa-info-circle text-blue-400"></i>
      <i v-else-if="t.type === 'warning'" class="fas fa-exclamation-triangle text-yellow-400"></i>
      <span class="text-sm font-medium">{{ t.message }}</span>
    </div>
  </div>
</template>

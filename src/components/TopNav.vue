<template>
  <nav class="top-nav">
    <div class="logo-area">
      <div class="menu" @click="toggleSidebar">
        <span class="menu-bar"></span>
        <span class="menu-bar"></span>
      </div>
      
      <nav class="nav-container">
        <div class="nav-menu">
          <div class="highlight" :style="highlightStyle"></div>
          <a 
            v-for="tab in tabs" 
            :key="tab.id"
            class="nav-item" 
            :class="{ active: currentTab === tab.id }"
            @click="switchTab(tab.id)"
          >
            {{ tab.name }}
          </a>
        </div>
      </nav>
      
      <span class="date-box" @click="openTimeline">
        <a class="date-year">
          <span class="date-day">
            {{ formattedDate }}
            <span class="date-tag"></span>
          </span>
        </a>
      </span>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'

const appStore = useAppStore()
const { currentDate, currentTab } = storeToRefs(appStore)

const tabs = [
  { id: 'music', name: '音乐' },
  { id: 'sentence', name: '句子' },
  { id: 'article', name: '文章' }
]

const highlightStyle = ref({})

const formattedDate = computed(() => {
  if (!currentDate.value) return ''
  const [year, month, day] = currentDate.value.split('-')
  return `${year}.${parseInt(month)}.${parseInt(day)}`
})

function switchTab(tabId) {
  appStore.switchTab(tabId)
}

function toggleSidebar() {
  appStore.toggleSidebar()
}

function openTimeline() {
  window.dispatchEvent(new CustomEvent('openTimeline'))
}

function updateHighlight() {
  const activeItem = document.querySelector('.nav-item.active')
  const navContainer = document.querySelector('.nav-container')
  if (activeItem && navContainer) {
    const navRect = navContainer.getBoundingClientRect()
    const itemRect = activeItem.getBoundingClientRect()
    highlightStyle.value = {
      width: `${itemRect.width}px`,
      height: '3px',
      left: `${itemRect.left - navRect.left}px`,
      top: `${itemRect.bottom - navRect.top + 1}px`,
      opacity: '1'
    }
  }
}

onMounted(() => {
  updateHighlight()
  window.addEventListener('resize', updateHighlight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateHighlight)
})

watch(currentTab, () => {
  setTimeout(updateHighlight, 50)
})
</script>

<style scoped>
.top-nav {
  position: relative;
  width: 100%;
  padding: 0 20px;
  background-color: var(--white);
  z-index: 100;
}

.logo-area {
  display: grid;
  grid-template-columns: minmax(80px, 120px) 1fr minmax(80px, 120px);
  align-items: center;
  height: 70px;
}

.menu {
  cursor: pointer;
}

.menu-bar {
  display: block;
  width: 20px;
  height: 2px;
  background-color: var(--gray-6);
}

.menu-bar + .menu-bar {
  margin-top: 8px;
}

.nav-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.nav-menu {
  display: flex;
  justify-content: center;
  list-style: none;
  position: relative;
}

.nav-item {
  margin: 0 20px;
  cursor: pointer;
  color: var(--gray-4);
  font-size: 1rem;
  position: relative;
  white-space: nowrap;
}

.nav-item.active {
  color: var(--gray-6);
}

.highlight {
  position: absolute;
  background: var(--gray-6);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.date-box {
  display: flex;
  justify-content: flex-end;
  cursor: pointer;
}

.date-year {
  font-size: 0.875rem;
  color: var(--gray-5);
}

.date-day {
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--gray-6);
}

.date-tag {
  border-width: 0 0 5px 5px;
  border-color: var(--gray-6) transparent;
  width: 0;
  height: 0;
  border-style: solid;
  display: inline-block;
  margin-left: 4px;
}
</style>
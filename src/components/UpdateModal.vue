<template>
  <div class="update-modal" :class="{ active: isOpen }">
    <div class="update-overlay" @click="closeModal"></div>
    <div class="update-panel">
      <div class="update-version">发现新版本 v{{ version }}</div>
      <div class="update-content">{{ releaseNotes }}</div>
      <div class="update-progress" :class="{ active: downloading }">
        <div>正在下载 <span>{{ downloadPercent }}</span>%</div>
        <div class="update-progress-bar">
          <div class="update-progress-fill" :style="{ width: downloadPercent + '%' }"></div>
        </div>
      </div>
      <div class="update-actions">
        <button @click="closeModal">暂不更新</button>
        <button class="update-confirm" @click="startUpdate">立即更新</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../store'
import { Capacitor } from '@capacitor/core'

const appStore = useAppStore()

const isOpen = ref(false)
const version = ref('')
const releaseNotes = ref('')
const downloadUrl = ref('')
const downloading = ref(false)
const downloadPercent = ref(0)

let downloadTask = null

const GITHUB_REPO = 'readsite/read-download'

async function fetchLatestRelease() {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
    if (!response.ok) throw new Error('获取版本信息失败')
    const release = await response.json()
    version.value = release.tag_name.replace(/^v/, '')
    releaseNotes.value = release.body || '无更新说明'
    downloadUrl.value = release.assets.length > 0 ? release.assets[0].browser_download_url : ''
    return true
  } catch (err) {
    console.error('获取版本信息失败', err)
    appStore.showToast('检查更新失败，请稍后重试')
    return false
  }
}

async function openModal() {
  const success = await fetchLatestRelease()
  if (success) {
    isOpen.value = true
    document.body.style.overflow = 'hidden'
  }
}

function closeModal() {
  if (downloading.value) return
  isOpen.value = false
  document.body.style.overflow = ''
}

function startUpdate() {
  if (!downloadUrl.value) {
    appStore.showToast('未找到下载链接')
    return
  }
  
  if (Capacitor.isNativePlatform()) {
    // 使用 Capacitor 浏览器打开下载链接
    import('@capacitor/browser').then(({ Browser }) => {
      Browser.open({ url: downloadUrl.value })
      closeModal()
    })
  } else {
    // Web 环境：直接打开链接
    window.open(downloadUrl.value, '_blank')
    closeModal()
  }
}

function handleCheckUpdate() {
  openModal()
}

onMounted(() => {
  window.addEventListener('checkUpdate', handleCheckUpdate)
})

onUnmounted(() => {
  window.removeEventListener('checkUpdate', handleCheckUpdate)
})
</script>

<style scoped>
.update-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10007;
  display: flex;
  align-items: center;
  justify-content: center;
  visibility: hidden;
  opacity: 0;
  transition: visibility 0.3s, opacity 0.2s;
}

.update-modal.active {
  visibility: visible;
  opacity: 1;
}

.update-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.update-panel {
  position: relative;
  background: var(--white);
  width: 85%;
  max-width: 320px;
  padding: 24px 20px 20px;
  border-radius: 16px;
  transform: scale(0.9);
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.update-modal.active .update-panel {
  transform: scale(1);
}

.update-version {
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--gray-6);
}

.update-content {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--gray-5);
  max-height: 200px;
  overflow-y: auto;
  margin: 16px 0;
  white-space: pre-wrap;
}

.update-progress {
  margin-top: 16px;
  display: none;
}

.update-progress.active {
  display: block;
}

.update-progress-bar {
  width: 100%;
  height: 4px;
  background: var(--gray-2);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
}

.update-progress-fill {
  width: 0%;
  height: 100%;
  background: var(--gray-6);
  transition: width 0.2s;
}

.update-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.update-actions button {
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
  background: var(--gray-1);
  color: var(--gray-6);
}

.update-actions .update-confirm {
  background: var(--gray-7);
  color: white;
}
</style>
<template>
  <div class="image-preview-modal" :class="{ active: isOpen }">
    <div class="image-preview-overlay" @click="closeModal"></div>
    <div class="image-preview-container">
      <div class="image-preview-body">
        <img :src="previewUrl" alt="预览图片" />
      </div>
      <div class="image-preview-footer">
        <button class="save-image-btn" @click="saveImage">保存图片</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../store'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const appStore = useAppStore()

const isOpen = ref(false)
const previewUrl = ref('')

async function saveImage() {
  if (!previewUrl.value) {
    appStore.showToast('暂无图片可保存')
    return
  }
  
  if (Capacitor.isNativePlatform()) {
    try {
      // 下载并保存图片
      const response = await fetch(previewUrl.value)
      const blob = await response.blob()
      const base64 = await blobToBase64(blob)
      
      const fileName = `read_image_${Date.now()}.jpg`
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents
      })
      
      // 分享或显示保存成功
      await Share.share({
        title: '图片已保存',
        text: '图片已保存到文档目录',
        url: result.uri
      })
      
      appStore.showToast('图片已保存')
    } catch (err) {
      console.error('保存图片失败', err)
      appStore.showToast('保存失败，请稍后重试')
    }
  } else {
    // Web 环境：下载图片
    try {
      const link = document.createElement('a')
      link.href = previewUrl.value
      link.download = `read_image_${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      appStore.showToast('图片已开始下载')
    } catch (err) {
      appStore.showToast('保存失败，请长按图片保存')
    }
  }
  
  closeModal()
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function openModal(url) {
  previewUrl.value = url
  isOpen.value = true
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  isOpen.value = false
  document.body.style.overflow = ''
  previewUrl.value = ''
}

function handleOpenImagePreview(e) {
  openModal(e.detail.url)
}

onMounted(() => {
  window.addEventListener('openImagePreview', handleOpenImagePreview)
})

onUnmounted(() => {
  window.removeEventListener('openImagePreview', handleOpenImagePreview)
})
</script>

<style scoped>
.image-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
  visibility: hidden;
  opacity: 0;
  transition: visibility 0.3s, opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-modal.active {
  visibility: visible;
  opacity: 1;
}

.image-preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
}

.image-preview-container {
  position: relative;
  width: 90%;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  z-index: 1;
  transform: scale(0.9);
  opacity: 0;
  transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1), opacity 0.25s ease;
}

.image-preview-modal.active .image-preview-container {
  transform: scale(1);
  opacity: 1;
}

.image-preview-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-preview-body img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.image-preview-footer {
  padding: 16px;
  display: flex;
  justify-content: center;
}

.save-image-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 10px 24px;
  border-radius: 24px;
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.save-image-btn:active {
  background: rgba(255, 255, 255, 0.3);
}
</style>
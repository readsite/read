<template>
  <div class="share-modal" :class="{ active: isOpen }">
    <div class="share-overlay" @click="closeModal"></div>
    <div class="share-panel">
      <div class="share-header">分享到</div>
      <div class="share-options">
        <div class="share-option" @click="shareTo('wechat')">
          <img src="https://solitudenook.top/img/wechat.svg" alt="微信" class="share-icon" />
          <span>微信好友</span>
        </div>
        <div class="share-option" @click="shareTo('moments')">
          <img src="https://solitudenook.top/img/moments.svg" alt="朋友圈" class="share-icon" />
          <span>朋友圈</span>
        </div>
        <div class="share-option" @click="shareTo('qq')">
          <img src="https://solitudenook.top/img/qq.svg" alt="QQ" class="share-icon" />
          <span>QQ好友</span>
        </div>
        <div class="share-option" @click="shareTo('qzone')">
          <img src="https://solitudenook.top/img/qzone.svg" alt="QQ空间" class="share-icon" />
          <span>QQ空间</span>
        </div>
      </div>
      <div class="share-cancel" @click="closeModal">取消</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'
import { Share } from '@capacitor/share'
import { Capacitor } from '@capacitor/core'
import { updateShare } from '../utils/api'

const appStore = useAppStore()
const { currentDate } = storeToRefs(appStore)

const isOpen = ref(false)
let currentType = ref('music')
let currentShareDate = ref('')

const SHARE_BASE = 'https://read-share.solitudenook.top/share.html'

function getShareData(type, date) {
  const data = appStore.getDateData(date)
  const href = `${SHARE_BASE}?date=${date}&type=${type}`
  
  let title = '', description = '', thumb = ''
  
  if (type === 'music' && data?.music) {
    title = data.music.title || '音乐分享'
    description = data.music.artist || '推荐一首好歌给你'
    thumb = data.music.cover || 'https://solitudenook.top/img/default-share.png'
  } else if (type === 'sentence' && data?.sentence) {
    title = '句子摘录'
    description = data.sentence.text || ''
    if (data.sentence.author) description += ` ——${data.sentence.author}`
    thumb = data.sentence.image || 'https://solitudenook.top/img/default-share.png'
  } else if (type === 'article' && data?.article) {
    title = data.article.title || '文章分享'
    description = (data.article.content || '').substring(0, 150)
    if (data.article.author) description = `文/${data.article.author} ` + description
    thumb = data.article.image || 'https://solitudenook.top/img/default-share.png'
  }
  
  // 确保缩略图是有效的 URL
  if (!thumb || thumb === '') {
    thumb = 'https://solitudenook.top/img/default-share.png'
  }
  
  description = description.replace(/\n/g, ' ').substring(0, 200)
  title = title.substring(0, 50)
  
  return { title, description, thumb, href }
}

async function shareTo(platform) {
  const { title, description, thumb, href } = getShareData(currentType.value, currentShareDate.value)
  
  // 更新分享计数
  try {
    await updateShare(currentShareDate.value, currentType.value, 1)
  } catch (err) {
    console.warn('更新分享计数失败', err)
  }
  
  // 使用 Capacitor Share 插件
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: title,
        text: description,
        url: href,
        dialogTitle: '分享到'
      })
    } catch (err) {
      console.warn('分享失败', err)
      appStore.showToast('分享失败，请稍后重试')
    }
  } else {
    // Web 环境：复制链接
    try {
      await navigator.clipboard.writeText(href)
      appStore.showToast('链接已复制，可分享给好友')
    } catch (err) {
      appStore.showToast('复制失败，请手动复制')
    }
  }
  
  closeModal()
}

function openModal(type, date) {
  currentType.value = type
  currentShareDate.value = date || currentDate.value
  isOpen.value = true
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  isOpen.value = false
  document.body.style.overflow = ''
}

function handleOpenShare(e) {
  openModal(e.detail.type, e.detail.date)
}

onMounted(() => {
  window.addEventListener('openShare', handleOpenShare)
})

onUnmounted(() => {
  window.removeEventListener('openShare', handleOpenShare)
})
</script>

<style scoped>
.share-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  visibility: hidden;
  opacity: 0;
  transition: visibility 0.3s, opacity 0.2s;
}

.share-modal.active {
  visibility: visible;
  opacity: 1;
}

.share-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
}

.share-panel {
  position: relative;
  background: var(--white);
  width: 100%;
  padding: 20px;
  border-radius: 16px 16px 0 0;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.share-modal.active .share-panel {
  transform: translateY(0);
}

.share-header {
  font-size: 1rem;
  color: var(--gray-5);
  text-align: center;
  margin-bottom: 20px;
}

.share-options {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.share-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  transition: transform 0.1s;
}

.share-option:active {
  transform: scale(0.95);
}

.share-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.share-option span {
  font-size: 0.75rem;
  color: var(--gray-5);
}

.share-cancel {
  text-align: center;
  padding: 12px;
  cursor: pointer;
  color: var(--gray-6);
  font-weight: 500;
  border-top: 1px solid var(--gray-1);
}

.share-cancel:active {
  background: var(--gray-1);
}
</style>
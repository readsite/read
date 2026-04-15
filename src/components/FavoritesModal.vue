<template>
  <div class="favorites-modal" :class="{ active: isOpen }">
    <div class="favorites-modal-content">
      <div class="favorites-header">
        <i class="ri-arrow-left-long-line close-favorites" @click="closeModal"></i>
        <h3>我的收藏</h3>
      </div>
      <div class="favorites-body" :class="{ empty: favorites.length === 0, 'has-favorites': favorites.length > 0 }">
        <div v-if="loading" class="loading-state">
          <i class="ri-loader-4-line"></i> 加载中...
        </div>
        <div v-else-if="favorites.length === 0" class="empty-favorites">
          <i class="ri-bookmark-fill"></i>
          <p>暂无收藏内容</p>
        </div>
        <div v-else>
          <div v-for="group in groupedFavorites" :key="group.date" class="favorites-date-group">
            <div class="date-group-header">- {{ group.formattedDate }} -</div>
            <div 
              v-for="item in group.items" 
              :key="`${item.date}_${item.type}`"
              class="swipe-container"
              @touchstart="onTouchStart($event, item)"
              @touchmove="onTouchMove($event, item)"
              @touchend="onTouchEnd($event, item)"
            >
              <div class="swipe-inner" :ref="el => setSwipeInnerRef(el, item)">
                <div class="card-content" @click="navigateTo(item.date, item.type)">
                  <div class="favorite-card" :class="`${item.type}-card`">
                    <img 
                      v-if="item.cover" 
                      class="card-cover" 
                      :src="item.cover" 
                      @error="handleImageError(item)"
                    />
                    <div v-else class="card-cover-placeholder">
                      <i :class="getTypeIcon(item.type)"></i>
                    </div>
                    <div class="card-info">
                      <div class="card-title-row" v-if="item.type === 'article'">
                        <div class="card-title">{{ item.title }}</div>
                        <div class="card-subtitle">{{ item.subtitle }}</div>
                      </div>
                      <template v-else>
                        <div class="card-title">{{ item.title || (item.type === 'sentence' ? '句子摘录' : '音乐分享') }}</div>
                        <div class="card-subtitle">{{ item.subtitle }}</div>
                      </template>
                      <div class="card-preview" v-if="item.preview">{{ truncate(item.preview, 80) }}</div>
                    </div>
                    <i :class="getTypeActionIcon(item.type)"></i>
                  </div>
                </div>
                <div class="delete-btn-area" @click="deleteFavorite(item.date, item.type)">
                  <i class="ri-delete-bin-line"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'
import { getItem, removeItem } from '../utils/kvStore'
import { updateFavorite } from '../utils/api'

const appStore = useAppStore()
const { currentDate } = storeToRefs(appStore)

const isOpen = ref(false)
const loading = ref(false)
const favorites = ref([])

// 滑动删除状态
const swipeStates = ref(new Map())
const DELETE_BTN_WIDTH = 70

const groupedFavorites = computed(() => {
  const groups = new Map()
  
  favorites.value.forEach(item => {
    if (!groups.has(item.date)) {
      groups.set(item.date, [])
    }
    groups.get(item.date).push(item)
  })
  
  return Array.from(groups.entries())
    .map(([date, items]) => ({
      date,
      formattedDate: formatDate(date),
      items: items.sort((a, b) => {
        const order = { music: 0, sentence: 1, article: 2 }
        return order[a.type] - order[b.type]
      })
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
})

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return `${year}年${parseInt(month)}月${parseInt(day)}日`
}

function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

function getTypeIcon(type) {
  const icons = {
    music: 'ri-music-line',
    sentence: 'ri-double-quotes-L',
    article: 'ri-file-text-line'
  }
  return icons[type] || 'ri-bookmark-line'
}

function getTypeActionIcon(type) {
  const icons = {
    music: 'ri-play-circle-line',
    sentence: 'ri-article-line',
    article: 'ri-newspaper-line'
  }
  return icons[type] || 'ri-eye-line'
}

async function loadFavorites() {
  loading.value = true
  
  // 从存储中读取收藏
  const favList = []
  const allKeys = getAllKeysFromStore()
  
  for (const key of allKeys) {
    const match = key.match(/^(\d{4}-\d{2}-\d{2})_(music|sentence|article)_favorite$/)
    if (match && getItem(key) === 'true') {
      const date = match[1]
      const type = match[2]
      
      // 尝试读取缓存的摘要信息
      const summaryKey = `fav_summary_${date}_${type}`
      const summaryStr = getItem(summaryKey)
      
      if (summaryStr) {
        try {
          const summary = JSON.parse(summaryStr)
          favList.push({
            date,
            type,
            title: summary.title || '',
            subtitle: summary.subtitle || '',
            cover: summary.cover || '',
            preview: summary.preview || ''
          })
        } catch (e) {
          favList.push({ date, type, title: '', subtitle: '', cover: '', preview: '' })
        }
      } else {
        favList.push({ date, type, title: '', subtitle: '', cover: '', preview: '' })
      }
    }
  }
  
  favorites.value = favList
  loading.value = false
  
  // 后台加载完整数据
  for (const item of favList) {
    const fullData = appStore.getDateData(item.date)
    if (fullData) {
      updateFavoriteItem(item, fullData)
    } else {
      // 异步加载数据
      appStore.loadDataForDate(item.date).then(data => {
        if (data) {
          updateFavoriteItem(item, data)
        }
      })
    }
  }
}

function getAllKeysFromStore() {
  // 由于我们使用 KV store，需要遍历所有键
  // 这里简化处理，实际应用中可能需要维护一个收藏列表
  const keys = []
  if (window._memoryStore) {
    for (const key of window._memoryStore.keys()) {
      keys.push(key)
    }
  }
  return keys
}

function updateFavoriteItem(item, data) {
  if (item.type === 'music' && data.music) {
    item.title = data.music.title || ''
    item.subtitle = data.music.artist || ''
    item.cover = data.music.cover || ''
    item.preview = ''
  } else if (item.type === 'sentence' && data.sentence) {
    item.title = '句子摘录'
    item.subtitle = data.sentence.author || ''
    item.cover = data.sentence.image || ''
    item.preview = data.sentence.text || ''
  } else if (item.type === 'article' && data.article) {
    item.title = data.article.title || ''
    item.subtitle = data.article.author || ''
    item.cover = data.article.image || ''
    item.preview = (data.article.content || '').replace(/\n/g, ' ').substring(0, 100)
  }
  
  // 保存摘要到缓存
  const summaryKey = `fav_summary_${item.date}_${item.type}`
  const summary = {
    title: item.title,
    subtitle: item.subtitle,
    cover: item.cover,
    preview: item.preview
  }
  setItem(summaryKey, JSON.stringify(summary))
}

async function deleteFavorite(date, type) {
  const key = `${date}_${type}_favorite`
  removeItem(key)
  
  // 删除摘要缓存
  const summaryKey = `fav_summary_${date}_${type}`
  removeItem(summaryKey)
  
  // 更新 UI
  favorites.value = favorites.value.filter(f => !(f.date === date && f.type === type))
  
  // 更新服务器统计
  try {
    await updateFavorite(date, type, -1)
    
    // 如果当前显示的日期是被删除收藏的日期，更新按钮状态
    if (currentDate.value === date) {
      window.dispatchEvent(new CustomEvent('favoriteStatusChanged', {
        detail: { date, type, isFavorited: false }
      }))
    }
  } catch (err) {
    console.warn('更新服务器统计失败', err)
  }
  
  appStore.showToast('已取消收藏')
}

function navigateTo(date, type) {
  if (!navigator.onLine) {
    appStore.showToast('网络连接不可用，请稍后再试')
    return
  }
  closeModal()
  appStore.switchToDate(date, type)
}

function handleImageError(item) {
  item.cover = ''
}

// 滑动删除逻辑
function onTouchStart(e, item) {
  const touch = e.touches[0]
  const state = swipeStates.value.get(item) || { startX: 0, startY: 0, currentTranslate: 0, isSwiping: false }
  state.startX = touch.clientX
  state.startY = touch.clientY
  state.isSwiping = true
  state.directionLocked = false
  swipeStates.value.set(item, state)
}

function onTouchMove(e, item) {
  const state = swipeStates.value.get(item)
  if (!state || !state.isSwiping) return
  
  const touch = e.touches[0]
  const deltaX = touch.clientX - state.startX
  const deltaY = touch.clientY - state.startY
  
  if (!state.directionLocked) {
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      state.directionLocked = true
      state.isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)
    }
  }
  
  if (!state.isHorizontal) return
  
  e.preventDefault()
  
  let newTranslate = deltaX
  if (newTranslate > 0) newTranslate *= 0.3
  else if (newTranslate < -DELETE_BTN_WIDTH) newTranslate = -DELETE_BTN_WIDTH + (newTranslate + DELETE_BTN_WIDTH) * 0.3
  
  newTranslate = Math.min(0, Math.max(-DELETE_BTN_WIDTH, newTranslate))
  state.currentTranslate = newTranslate
  
  const swipeInner = document.querySelector(`.swipe-container[data-item-idx="${getItemIndex(item)}"] .swipe-inner`)
  if (swipeInner) {
    swipeInner.style.transform = `translateX(${newTranslate}px)`
  }
}

function onTouchEnd(e, item) {
  const state = swipeStates.value.get(item)
  if (!state) return
  
  if (!state.isHorizontal) {
    swipeStates.value.delete(item)
    return
  }
  
  const finalTranslate = state.currentTranslate < -DELETE_BTN_WIDTH / 2 ? -DELETE_BTN_WIDTH : 0
  
  const swipeInner = document.querySelector(`.swipe-container[data-item-idx="${getItemIndex(item)}"] .swipe-inner`)
  if (swipeInner) {
    swipeInner.style.transform = `translateX(${finalTranslate}px)`
    swipeInner.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1)'
    setTimeout(() => {
      if (swipeInner) swipeInner.style.transition = ''
    }, 300)
  }
  
  swipeStates.value.delete(item)
}

function getItemIndex(item) {
  return favorites.value.findIndex(f => f.date === item.date && f.type === item.type)
}

function setSwipeInnerRef(el, item) {
  if (el) {
    const container = el.closest('.swipe-container')
    if (container) {
      container.setAttribute('data-item-idx', getItemIndex(item))
    }
  }
}

function openModal() {
  isOpen.value = true
  loadFavorites()
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  isOpen.value = false
  document.body.style.overflow = ''
}

function handleOpenFavorites() {
  openModal()
}

onMounted(() => {
  window.addEventListener('openFavorites', handleOpenFavorites)
})

onUnmounted(() => {
  window.removeEventListener('openFavorites', handleOpenFavorites)
})
</script>

<style scoped>
.favorites-modal {
  position: fixed;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background: var(--white);
  z-index: 1003;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.favorites-modal.active {
  transform: translateX(0);
}

.favorites-modal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.favorites-header {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  background: var(--white);
}

.favorites-header i {
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray-6);
}

.favorites-header h3 {
  font-size: 1.125rem;
  font-weight: 500;
  margin-left: 10px;
  color: var(--gray-6);
}

.favorites-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.favorites-body.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.favorites-body.has-favorites {
  background-color: var(--gray-0);
}

.empty-favorites {
  text-align: center;
  color: var(--gray-4);
}

.empty-favorites i {
  font-size: 3rem;
  margin-bottom: 16px;
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: var(--gray-4);
}

.loading-state i {
  animation: spin 1s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.favorites-date-group {
  margin-bottom: 20px;
}

.date-group-header {
  text-align: center;
  font-size: 0.875rem;
  color: var(--gray-4);
  padding: 16px 0;
}

.swipe-container {
  margin-bottom: 8px;
  overflow: hidden;
}

.swipe-inner {
  display: flex;
  width: calc(100% + 70px);
  transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.card-content {
  flex: 1;
  background: var(--white);
  cursor: pointer;
}

.delete-btn-area {
  width: 70px;
  background: #e74c3c;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.delete-btn-area i {
  font-size: 1.5rem;
  color: white;
}

.favorite-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--white);
}

.dark-mode .favorite-card {
  background: rgba(255, 255, 255, 0.1);
}

.card-cover {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
}

.card-cover-placeholder {
  width: 50px;
  height: 50px;
  background: var(--gray-1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-cover-placeholder i {
  font-size: 1.5rem;
  color: var(--gray-4);
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.card-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--gray-6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-subtitle {
  font-size: 0.75rem;
  color: var(--gray-4);
}

.card-preview {
  font-size: 0.8rem;
  color: var(--gray-5);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
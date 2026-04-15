<template>
  <div class="search-modal" :class="{ active: isOpen }">
    <div class="search-modal-content">
      <div class="search-header">
        <i class="ri-arrow-left-long-line close-search" @click="closeModal"></i>
        <div class="search-input-wrapper">
          <input 
            type="text" 
            v-model="keyword" 
            class="search-input" 
            placeholder="搜索音乐、句子、文章..."
            @input="onSearchInput"
            @keyup.enter="performSearch"
            ref="searchInput"
          />
          <button class="search-btn" @click="performSearch">
            <i class="ri-search-2-line"></i>
          </button>
        </div>
      </div>
      <div class="search-body">
        <div class="search-results">
          <div v-if="!searched" class="search-placeholder">
            <i class="ri-search-2-line"></i>
            <span>输入关键词开始探索</span>
          </div>
          <div v-else-if="searching" class="search-loading">
            <i class="ri-loader-4-line"></i> 搜索中...
          </div>
          <div v-else-if="results.length === 0" class="search-empty">
            <i class="ri-information-line"></i>
            <p>没有找到相关内容</p>
            <span>试试其他关键词吧</span>
          </div>
          <div v-else>
            <div 
              v-for="result in results" 
              :key="`${result.date}_${result.type}`"
              class="search-result-item"
              @click="navigateTo(result.date, result.type)"
            >
              <div class="search-result-header">
                <span class="search-result-type">{{ getTypeName(result.type) }}</span>
                <span class="search-result-date">{{ formatDate(result.date) }}</span>
              </div>
              <div class="search-result-title">{{ result.title }}</div>
              <div class="search-result-preview">{{ truncate(result.preview, 100) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'
import { getCachedPost, fetchPostFromNetwork } from '../utils/db'

const appStore = useAppStore()
const { publishedDates } = storeToRefs(appStore)

const isOpen = ref(false)
const keyword = ref('')
const searching = ref(false)
const searched = ref(false)
const results = ref([])
let searchAbortController = null
let searchDebounceTimer = null

const searchInput = ref(null)

function getTypeName(type) {
  const names = { music: '音乐', sentence: '句子', article: '文章' }
  return names[type] || type
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return `${year}.${parseInt(month)}.${parseInt(day)}`
}

function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  if (!keyword.value.trim()) {
    searched.value = false
    results.value = []
    return
  }
  searchDebounceTimer = setTimeout(() => {
    performSearch()
  }, 300)
}

async function performSearch() {
  const kw = keyword.value.trim()
  if (!kw) return
  
  if (searchAbortController) {
    searchAbortController.abort()
  }
  
  searchAbortController = new AbortController()
  searching.value = true
  searched.value = true
  results.value = []
  
  try {
    const allResults = []
    const dates = publishedDates.value
    
    // 分批搜索，避免同时请求过多
    const batchSize = 3
    for (let i = 0; i < dates.length; i += batchSize) {
      if (searchAbortController.signal.aborted) break
      
      const batch = dates.slice(i, i + batchSize)
      const batchPromises = batch.map(async (date) => {
        if (searchAbortController.signal.aborted) return []
        
        let data = appStore.getDateData(date)
        if (!data) {
          data = await getCachedPost(date)
          if (!data && navigator.onLine) {
            try {
              data = await fetchPostFromNetwork(date)
            } catch (e) {
              return []
            }
          }
        }
        
        if (!data) return []
        return searchInData(date, data, kw)
      })
      
      const batchResults = await Promise.all(batchPromises)
      allResults.push(...batchResults.flat())
      
      // 实时显示结果
      results.value = [...allResults]
    }
    
    results.value = allResults
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('搜索失败', err)
    }
  } finally {
    searching.value = false
    searchAbortController = null
  }
}

function searchInData(date, data, keyword) {
  const lowerKeyword = keyword.toLowerCase()
  const results = []
  
  // 搜索音乐
  if (data.music) {
    const title = data.music.title || ''
    const artist = data.music.artist || ''
    if (title.toLowerCase().includes(lowerKeyword) || artist.toLowerCase().includes(lowerKeyword)) {
      results.push({
        date,
        type: 'music',
        title: title || '无标题',
        preview: artist || '未知歌手'
      })
    }
  }
  
  // 搜索句子
  if (data.sentence) {
    const text = data.sentence.text || ''
    const author = data.sentence.author || ''
    if (text.toLowerCase().includes(lowerKeyword) || author.toLowerCase().includes(lowerKeyword)) {
      let preview = text.length > 100 ? text.substring(0, 100) + '...' : text
      results.push({
        date,
        type: 'sentence',
        title: '句子摘录',
        preview: preview + (author ? ` ——${author}` : '')
      })
    }
  }
  
  // 搜索文章
  if (data.article) {
    const title = data.article.title || ''
    const author = data.article.author || ''
    const content = data.article.content || ''
    if (title.toLowerCase().includes(lowerKeyword) || 
        author.toLowerCase().includes(lowerKeyword) || 
        content.toLowerCase().includes(lowerKeyword)) {
      let preview = content.length > 100 ? content.substring(0, 100) + '...' : content
      results.push({
        date,
        type: 'article',
        title: title || '无标题',
        preview: preview + (author ? ` ——${author}` : '')
      })
    }
  }
  
  return results
}

function navigateTo(date, type) {
  if (!navigator.onLine) {
    appStore.showToast('网络连接不可用，请稍后再试')
    return
  }
  closeModal()
  appStore.switchToDate(date, type)
}

function openModal() {
  isOpen.value = true
  keyword.value = ''
  results.value = []
  searched.value = false
  document.body.style.overflow = 'hidden'
  nextTick(() => {
    if (searchInput.value) {
      searchInput.value.focus()
    }
  })
}

function closeModal() {
  isOpen.value = false
  document.body.style.overflow = ''
  if (searchAbortController) {
    searchAbortController.abort()
  }
}

function handleOpenSearch() {
  openModal()
}

onMounted(() => {
  window.addEventListener('openSearch', handleOpenSearch)
})

onUnmounted(() => {
  window.removeEventListener('openSearch', handleOpenSearch)
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})
</script>

<style scoped>
.search-modal {
  position: fixed;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background: var(--white);
  z-index: 1005;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.search-modal.active {
  transform: translateX(0);
}

.search-modal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-header {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  background: var(--white);
  border-bottom: 1px solid var(--gray-1);
}

.search-header i {
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray-6);
}

.search-input-wrapper {
  position: relative;
  flex: 1;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1px solid var(--gray-2);
  border-radius: 8px;
  font-size: 0.9rem;
  background: var(--white);
  color: var(--gray-6);
  outline: none;
}

.search-input:focus {
  border-color: var(--gray-4);
}

.search-btn {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 40px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn i {
  font-size: 1.2rem;
  color: var(--gray-4);
}

.search-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-placeholder,
.search-loading,
.search-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--gray-4);
}

.search-placeholder i,
.search-loading i,
.search-empty i {
  font-size: 3rem;
  margin-bottom: 16px;
  display: block;
}

.search-loading i {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.search-result-item {
  padding: 12px;
  background: var(--gray-0);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.dark-mode .search-result-item {
  background: rgba(255, 255, 255, 0.1);
}

.search-result-item:active {
  background: var(--gray-1);
}

.search-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.search-result-type {
  font-size: 0.7rem;
  padding: 2px 8px;
  background: var(--gray-2);
  border-radius: 4px;
  color: var(--gray-6);
}

.search-result-date {
  font-size: 0.7rem;
  color: var(--gray-4);
}

.search-result-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--gray-6);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result-preview {
  font-size: 0.8rem;
  color: var(--gray-5);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
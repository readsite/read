<template>
  <div class="card" :class="{ 'card-hidden': !isVisible }">
    <div class="card-inner">
      <div class="article-image" v-if="articleImage">
        <img :src="articleImage" alt="文章配图" @click="openImagePreview" />
      </div>
      <div class="article-info">
        <p class="article-title">{{ articleTitle }}</p>
        <p class="article-author">文/{{ articleAuthor }}</p>
        <div class="article-content" v-html="formattedContent"></div>
      </div>
    </div>
    
    <div class="stats-actions">
      <button class="favorite-btn" @click="toggleFavorite">
        <i :class="isFavorited ? 'ri-bookmark-fill' : 'ri-bookmark-line'"></i>
        <span class="count">{{ favoriteCount }}</span>
      </button>
      <button class="comment-btn" @click="openComments">
        <i class="ri-chat-2-line"></i>
        <span class="count">{{ commentCount }}</span>
      </button>
      <button class="share-btn" @click="openShare">
        <i class="ri-share-box-line"></i>
        <span class="count">{{ shareCount }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'
import { updateFavorite, updateShare, fetchCommentsCount } from '../utils/api'
import { getItem, setItem } from '../utils/kvStore'

const appStore = useAppStore()
const { currentDate, currentTab } = storeToRefs(appStore)

const isVisible = computed(() => currentTab.value === 'article')

const articleTitle = ref('')
const articleAuthor = ref('')
const articleContent = ref('')
const articleImage = ref('')
const favoriteCount = ref(0)
const shareCount = ref(0)
const commentCount = ref(0)
const isFavorited = ref(false)

const formattedContent = computed(() => {
  return (articleContent.value || '').replace(/\n/g, '<br>')
})

async function loadData() {
  const date = currentDate.value
  if (!date) return
  
  const data = appStore.getDateData(date)
  if (!data || !data.article) return
  
  articleTitle.value = data.article.title || ''
  articleAuthor.value = data.article.author || '佚名'
  articleContent.value = data.article.content || ''
  articleImage.value = data.article.image || ''
  
  favoriteCount.value = data.articleStats?.favorites || 0
  shareCount.value = data.articleStats?.shares || 0
  
  const favoriteKey = `${date}_article_favorite`
  isFavorited.value = getItem(favoriteKey) === 'true'
  
  await loadCommentCount()
}

async function loadCommentCount() {
  try {
    const result = await fetchCommentsCount(currentDate.value, 'article')
    commentCount.value = result.count || 0
  } catch (err) {
    console.warn('获取评论数失败', err)
  }
}

async function toggleFavorite() {
  const date = currentDate.value
  if (!date) return
  
  const delta = isFavorited.value ? -1 : 1
  const newCount = favoriteCount.value + delta
  
  isFavorited.value = !isFavorited.value
  favoriteCount.value = newCount
  
  const favoriteKey = `${date}_article_favorite`
  if (isFavorited.value) {
    setItem(favoriteKey, 'true')
  } else {
    setItem(favoriteKey, 'false')
  }
  
  try {
    const result = await updateFavorite(date, 'article', delta)
    favoriteCount.value = result.articleStats?.favorites || newCount
  } catch (err) {
    isFavorited.value = !isFavorited.value
    favoriteCount.value = favoriteCount.value - delta
    appStore.showToast('操作失败，请稍后重试')
  }
}

function openComments() {
  window.dispatchEvent(new CustomEvent('openComments', { detail: { type: 'article' } }))
}

function openShare() {
  window.dispatchEvent(new CustomEvent('openShare', { detail: { type: 'article', date: currentDate.value } }))
}

function openImagePreview() {
  if (articleImage.value) {
    window.dispatchEvent(new CustomEvent('openImagePreview', { detail: { url: articleImage.value } }))
  }
}

function handleDataLoaded(e) {
  if (e.detail.date === currentDate.value) {
    loadData()
  }
}

function handleCommentCountUpdate(e) {
  if (e.detail.date === currentDate.value && e.detail.type === 'article') {
    commentCount.value = e.detail.count
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('dateDataLoaded', handleDataLoaded)
  window.addEventListener('commentCountUpdated', handleCommentCountUpdate)
})

onUnmounted(() => {
  window.removeEventListener('dateDataLoaded', handleDataLoaded)
  window.removeEventListener('commentCountUpdated', handleCommentCountUpdate)
})

watch(currentDate, () => {
  loadData()
})
</script>
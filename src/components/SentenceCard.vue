<template>
  <div class="card" :class="{ 'card-hidden': !isVisible }">
    <div class="card-inner">
      <div class="sentence-image" v-if="sentenceImage">
        <img :src="sentenceImage" alt="句子配图" @click="openImagePreview" />
      </div>
      <p id="sentenceText" v-html="formattedText"></p>
      <p class="from"><span>{{ sentenceAuthor }}</span></p>
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

const isVisible = computed(() => currentTab.value === 'sentence')

const sentenceText = ref('')
const sentenceAuthor = ref('')
const sentenceImage = ref('')
const favoriteCount = ref(0)
const shareCount = ref(0)
const commentCount = ref(0)
const isFavorited = ref(false)

const formattedText = computed(() => {
  return (sentenceText.value || '').replace(/\n/g, '<br>')
})

async function loadData() {
  const date = currentDate.value
  if (!date) return
  
  const data = appStore.getDateData(date)
  if (!data || !data.sentence) return
  
  sentenceText.value = data.sentence.text || ''
  sentenceAuthor.value = data.sentence.author ? '—' + data.sentence.author : ''
  sentenceImage.value = data.sentence.image || ''
  
  favoriteCount.value = data.sentenceStats?.favorites || 0
  shareCount.value = data.sentenceStats?.shares || 0
  
  const favoriteKey = `${date}_sentence_favorite`
  isFavorited.value = getItem(favoriteKey) === 'true'
  
  await loadCommentCount()
}

async function loadCommentCount() {
  try {
    const result = await fetchCommentsCount(currentDate.value, 'sentence')
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
  
  const favoriteKey = `${date}_sentence_favorite`
  if (isFavorited.value) {
    setItem(favoriteKey, 'true')
  } else {
    setItem(favoriteKey, 'false')
  }
  
  try {
    const result = await updateFavorite(date, 'sentence', delta)
    favoriteCount.value = result.sentenceStats?.favorites || newCount
  } catch (err) {
    isFavorited.value = !isFavorited.value
    favoriteCount.value = favoriteCount.value - delta
    appStore.showToast('操作失败，请稍后重试')
  }
}

function openComments() {
  window.dispatchEvent(new CustomEvent('openComments', { detail: { type: 'sentence' } }))
}

function openShare() {
  window.dispatchEvent(new CustomEvent('openShare', { detail: { type: 'sentence', date: currentDate.value } }))
}

function openImagePreview() {
  if (sentenceImage.value) {
    window.dispatchEvent(new CustomEvent('openImagePreview', { detail: { url: sentenceImage.value } }))
  }
}

function handleDataLoaded(e) {
  if (e.detail.date === currentDate.value) {
    loadData()
  }
}

function handleCommentCountUpdate(e) {
  if (e.detail.date === currentDate.value && e.detail.type === 'sentence') {
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
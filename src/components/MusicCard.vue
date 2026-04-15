<template>
  <div class="card" :class="{ 'card-hidden': !isVisible }">
    <div class="card-inner">
      <div class="album-box">
        <div class="album-image" :class="{ rotating: isPlaying }">
          <img :src="musicCover" alt="专辑封面" @click="openImagePreview" />
        </div>
      </div>
      
      <div class="player-control-wrapper">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="player-info-overlay">
          <div class="track-info">
            <p class="track-album">{{ musicTitle || '加载中...' }}</p>
            <p class="track-singer">{{ musicArtist || '未知歌手' }}</p>
          </div>
          <div class="play-pause-icon" @click="togglePlay">
            <i v-if="isPlaying" class="ri-pause-circle-line"></i>
            <i v-else class="ri-play-circle-line"></i>
          </div>
        </div>
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
import { audioManager } from '../utils/audioManager'
import { updateFavorite, updateShare, fetchCommentsCount } from '../utils/api'
import { getItem, setItem } from '../utils/kvStore'

const appStore = useAppStore()
const { currentDate, currentTab } = storeToRefs(appStore)

const isVisible = computed(() => currentTab.value === 'music')

const musicTitle = ref('')
const musicArtist = ref('')
const musicCover = ref('')
const musicSrc = ref('')
const isPlaying = ref(false)
const progressPercent = ref(0)
const favoriteCount = ref(0)
const shareCount = ref(0)
const commentCount = ref(0)
const isFavorited = ref(false)

let audioUnsubscribe = null
let timeUpdateUnsubscribe = null

async function loadData() {
  const date = currentDate.value
  if (!date) return
  
  const data = appStore.getDateData(date)
  if (!data || !data.music) return
  
  musicTitle.value = data.music.title || ''
  musicArtist.value = data.music.artist || ''
  musicCover.value = data.music.cover || ''
  musicSrc.value = data.music.src || ''
  
  favoriteCount.value = data.musicStats?.favorites || 0
  shareCount.value = data.musicStats?.shares || 0
  
  const favoriteKey = `${date}_music_favorite`
  isFavorited.value = getItem(favoriteKey) === 'true'
  
  // 初始化音频
  if (musicSrc.value) {
    audioManager.getOrCreate(date, musicSrc.value, musicTitle.value, musicArtist.value, musicCover.value)
    const player = audioManager.getPlayerState(date)
    if (player) {
      isPlaying.value = player.playing
    }
  }
  
  await loadCommentCount()
}

async function loadCommentCount() {
  try {
    const result = await fetchCommentsCount(currentDate.value, 'music')
    commentCount.value = result.count || 0
  } catch (err) {
    console.warn('获取评论数失败', err)
  }
}

function togglePlay() {
  const date = currentDate.value
  if (!date) return
  
  if (isPlaying.value) {
    audioManager.pause(date)
  } else {
    audioManager.play(date)
  }
}

async function toggleFavorite() {
  const date = currentDate.value
  if (!date) return
  
  const delta = isFavorited.value ? -1 : 1
  const newCount = favoriteCount.value + delta
  
  // 乐观更新
  isFavorited.value = !isFavorited.value
  favoriteCount.value = newCount
  
  const favoriteKey = `${date}_music_favorite`
  if (isFavorited.value) {
    setItem(favoriteKey, 'true')
  } else {
    setItem(favoriteKey, 'false')
  }
  
  try {
    const result = await updateFavorite(date, 'music', delta)
    favoriteCount.value = result.musicStats?.favorites || newCount
  } catch (err) {
    // 回滚
    isFavorited.value = !isFavorited.value
    favoriteCount.value = favoriteCount.value - delta
    appStore.showToast('操作失败，请稍后重试')
  }
}

function openComments() {
  window.dispatchEvent(new CustomEvent('openComments', { detail: { type: 'music' } }))
}

function openShare() {
  window.dispatchEvent(new CustomEvent('openShare', { detail: { type: 'music', date: currentDate.value } }))
}

function openImagePreview() {
  if (musicCover.value) {
    window.dispatchEvent(new CustomEvent('openImagePreview', { detail: { url: musicCover.value } }))
  }
}

function handleAudioStateChanged(e) {
  if (e.detail.date === currentDate.value) {
    const player = audioManager.getPlayerState(currentDate.value)
    isPlaying.value = player?.playing || false
  }
}

function handleAudioTimeUpdate(e) {
  if (e.detail.date === currentDate.value && e.detail.duration) {
    progressPercent.value = (e.detail.currentTime / e.detail.duration) * 100
  }
}

function handleDataLoaded(e) {
  if (e.detail.date === currentDate.value) {
    loadData()
  }
}

function handleCommentCountUpdate(e) {
  if (e.detail.date === currentDate.value && e.detail.type === 'music') {
    commentCount.value = e.detail.count
  }
}

onMounted(() => {
  loadData()
  
  window.addEventListener('audioStateChanged', handleAudioStateChanged)
  window.addEventListener('audioTimeUpdate', handleAudioTimeUpdate)
  window.addEventListener('dateDataLoaded', handleDataLoaded)
  window.addEventListener('commentCountUpdated', handleCommentCountUpdate)
})

onUnmounted(() => {
  window.removeEventListener('audioStateChanged', handleAudioStateChanged)
  window.removeEventListener('audioTimeUpdate', handleAudioTimeUpdate)
  window.removeEventListener('dateDataLoaded', handleDataLoaded)
  window.removeEventListener('commentCountUpdated', handleCommentCountUpdate)
})

watch(currentDate, () => {
  loadData()
})
</script>
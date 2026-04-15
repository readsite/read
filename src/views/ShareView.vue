<template>
  <div class="share-view" :class="{ 'dark-mode': isDarkMode }">
    <div class="share-header">
      <button class="back-btn" @click="goBack">
        <i class="ri-arrow-left-line"></i>
      </button>
      <span class="share-title">Read.</span>
    </div>
    
    <div class="share-content">
      <div class="share-card" v-if="data">
        <div v-if="type === 'music'" class="music-share">
          <div class="album-image">
            <img :src="data.music?.cover" alt="专辑封面" />
          </div>
          <h2 class="music-title">{{ data.music?.title }}</h2>
          <p class="music-artist">{{ data.music?.artist }}</p>
        </div>
        
        <div v-else-if="type === 'sentence'" class="sentence-share">
          <div class="sentence-image" v-if="data.sentence?.image">
            <img :src="data.sentence.image" alt="句子配图" />
          </div>
          <p class="sentence-text">{{ data.sentence?.text }}</p>
          <p class="sentence-author">——{{ data.sentence?.author || '佚名' }}</p>
        </div>
        
        <div v-else-if="type === 'article'" class="article-share">
          <div class="article-image" v-if="data.article?.image">
            <img :src="data.article.image" alt="文章配图" />
          </div>
          <h2 class="article-title">{{ data.article?.title }}</h2>
          <p class="article-author">文/{{ data.article?.author || '佚名' }}</p>
          <p class="article-excerpt">{{ articleExcerpt }}</p>
        </div>
        
        <div class="share-footer">
          <p class="app-name">Read.</p>
          <p class="app-desc">安于闲，乐于独 · 每日精选音乐、句子、文章</p>
          <div class="qr-code">
            <canvas ref="qrCanvas" width="120" height="120"></canvas>
          </div>
          <p class="scan-tip">扫码下载 App</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'

const route = useRoute()
const router = useRouter()
const isDarkMode = ref(false)

const type = ref(route.query.type || 'music')
const date = ref(route.query.date || '')
const data = ref(null)

const articleExcerpt = computed(() => {
  if (!data.value?.article?.content) return ''
  return data.value.article.content.substring(0, 200) + '...'
})

const qrCanvas = ref(null)

async function loadData() {
  if (!date.value) return
  
  try {
    const response = await fetch(`https://solitudenook.top/api/posts/${date.value}`)
    data.value = await response.json()
  } catch (err) {
    console.error('加载数据失败', err)
  }
}

function generateQRCode() {
  const appUrl = 'https://read.solitudenook.top'
  if (qrCanvas.value) {
    QRCode.toCanvas(qrCanvas.value, appUrl, {
      width: 120,
      margin: 1,
      color: {
        dark: isDarkMode.value ? '#ffffff' : '#000000',
        light: isDarkMode.value ? '#1e1e1e' : '#ffffff'
      }
    })
  }
}

function goBack() {
  router.back()
}

onMounted(() => {
  loadData()
  generateQRCode()
})
</script>

<style scoped>
.share-view {
  min-height: 100vh;
  background: var(--white);
  padding: 20px;
}

.share-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.back-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray-6);
}

.share-title {
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--gray-6);
}

.share-content {
  display: flex;
  justify-content: center;
}

.share-card {
  max-width: 400px;
  width: 100%;
  background: var(--white);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.album-image {
  width: 200px;
  height: 200px;
  margin: 0 auto 20px;
  border-radius: 50%;
  overflow: hidden;
}

.album-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.music-title,
.article-title {
  font-size: 1.3rem;
  text-align: center;
  margin-bottom: 8px;
  color: var(--gray-6);
}

.music-artist,
.article-author {
  text-align: center;
  color: var(--gray-4);
  margin-bottom: 16px;
}

.sentence-text {
  font-size: 1.1rem;
  line-height: 1.6;
  text-align: center;
  margin: 20px 0;
  color: var(--gray-6);
}

.sentence-author {
  text-align: right;
  color: var(--gray-4);
}

.sentence-image,
.article-image {
  width: 100%;
  margin-bottom: 20px;
  border-radius: 12px;
  overflow: hidden;
}

.sentence-image img,
.article-image img {
  width: 100%;
  height: auto;
  display: block;
}

.article-excerpt {
  line-height: 1.6;
  color: var(--gray-5);
  margin-top: 16px;
}

.share-footer {
  text-align: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--gray-1);
}

.app-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--gray-6);
  margin-bottom: 4px;
}

.app-desc {
  font-size: 0.8rem;
  color: var(--gray-4);
  margin-bottom: 16px;
}

.qr-code {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.scan-tip {
  font-size: 0.75rem;
  color: var(--gray-4);
}
</style>
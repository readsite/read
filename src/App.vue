<template>
  <div class="app-container" :class="{ 'dark-mode': isDarkMode }">
    <div class="page-content" :class="{ 'menu-shifted': sidebarOpen }">
      <TopNav />
      <div class="card-container">
        <MusicCard v-show="currentTab === 'music'" />
        <SentenceCard v-show="currentTab === 'sentence'" />
        <ArticleCard v-show="currentTab === 'article'" />
      </div>
    </div>
    
    <Sidebar />
    <TimelineModal />
    <FavoritesModal />
    <CommentModal />
    <SearchModal />
    <ShareModal />
    <ImagePreview />
    <PolicyModal />
    <UpdateModal />
    <Toast />
    
    <div class="offline-placeholder" v-if="!isOnline" @click="retryNetwork">
      <div class="offline-content">
        <i class="ri-wifi-off-line"></i>
        <p>网络连接不可用</p>
        <p class="retry-hint">点击页面刷新</p>
      </div>
    </div>
    
    <div class="initial-loader" v-if="isLoading">
      <div class="loader-content">
        <i class="ri-loader-4-line"></i>
        <p>正在加载...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from './store'
import TopNav from './components/TopNav.vue'
import MusicCard from './components/MusicCard.vue'
import SentenceCard from './components/SentenceCard.vue'
import ArticleCard from './components/ArticleCard.vue'
import Sidebar from './components/Sidebar.vue'
import TimelineModal from './components/TimelineModal.vue'
import FavoritesModal from './components/FavoritesModal.vue'
import CommentModal from './components/CommentModal.vue'
import SearchModal from './components/SearchModal.vue'
import ShareModal from './components/ShareModal.vue'
import ImagePreview from './components/ImagePreview.vue'
import PolicyModal from './components/PolicyModal.vue'
import UpdateModal from './components/UpdateModal.vue'
import Toast from './components/Toast.vue'

const appStore = useAppStore()
const { currentTab, sidebarOpen, isOnline, isLoading, isDarkMode } = storeToRefs(appStore)

const retryNetwork = () => {
  appStore.retryNetworkAndReload()
}

onMounted(() => {
  appStore.init()
})

onUnmounted(() => {
  appStore.cleanup()
})
</script>

<style>
@import './assets/styles/main.css';
</style>
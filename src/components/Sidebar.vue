<template>
  <div class="sidebar-overlay" :class="{ active: sidebarOpen }" @click="closeSidebar"></div>
  
  <div class="sidebar" :class="{ open: sidebarOpen }">
    <div class="sidebar-header">
      <span class="logo">Read.</span>
      <i class="ri-search-2-line close-sidebar" @click="openSearch"></i>
    </div>
    
    <div class="sidebar-content">
      <div class="sidebar-menu">
        <h3>安于闲，乐于独</h3>
        <p class="about-content">一歌，一句，一文<br>躲藏在时光背后的无尽地带</p>
      </div>
      
      <div class="sidebar-menu">
        <div class="menu-item" @click="openFavorites">
          <i class="ri-bookmark-line"></i> 我的收藏
        </div>
        <div class="menu-item" @click="openMyComments">
          <i class="ri-chat-2-line"></i> 我的评论
        </div>
        <div class="menu-item" @click="toggleTheme">
          <i :class="isDarkMode ? 'ri-sun-line' : 'ri-moon-clear-line'"></i>
          {{ isDarkMode ? '日间模式' : '夜间模式' }}
        </div>
        <div class="menu-item" @click="copyEmail">
          <i class="ri-mail-line"></i> 联系我们<span class="mail">cveyo@qq.com</span>
        </div>
        <div class="menu-item" @click="openChangelog">
          <i class="ri-history-line"></i> 更新日志
        </div>
        <div class="menu-item" @click="checkUpdate">
          <i class="ri-upload-line"></i> 当前版本<span class="version">V{{ currentVersion }}</span>
          <span class="update-dot" v-if="hasNewVersion"></span>
        </div>
      </div>
    </div>
    
    <div class="sidebar-footer">
      <div class="state">
        <p>本站部分素材来自网络收集，侵权请联系删除</p>
        <p style="text-align:center">© 2026 Read.</p>
      </div>
      <div class="footer-links">
        <a href="javascript:void(0)" class="footer-link" @click="openPolicy('privacy')">隐私政策</a>
        <span class="link-separator">|</span>
        <a href="javascript:void(0)" class="footer-link" @click="openPolicy('terms')">用户协议</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'
import { Capacitor } from '@capacitor/core'

const appStore = useAppStore()
const { sidebarOpen, isDarkMode } = storeToRefs(appStore)

const currentVersion = ref('1.0.0')
const hasNewVersion = ref(false)

function closeSidebar() {
  appStore.closeSidebar()
}

function openSearch() {
  closeSidebar()
  window.dispatchEvent(new CustomEvent('openSearch'))
}

function openFavorites() {
  closeSidebar()
  window.dispatchEvent(new CustomEvent('openFavorites'))
}

function openMyComments() {
  closeSidebar()
  window.dispatchEvent(new CustomEvent('openMyComments'))
}

function toggleTheme() {
  appStore.toggleTheme()
}

async function copyEmail() {
  const email = 'cveyo@qq.com'
  try {
    await navigator.clipboard.writeText(email)
    appStore.showToast('邮箱已复制')
  } catch (err) {
    appStore.showToast('复制失败，请手动复制')
  }
}

function openChangelog() {
  closeSidebar()
  window.dispatchEvent(new CustomEvent('openChangelog'))
}

function openPolicy(type) {
  closeSidebar()
  window.dispatchEvent(new CustomEvent('openPolicy', { detail: { type } }))
}

function checkUpdate() {
  window.dispatchEvent(new CustomEvent('checkUpdate'))
}

onMounted(() => {
  if (Capacitor.isNativePlatform()) {
    // 获取 App 版本
    import('@capacitor/app').then(({ App }) => {
      App.getInfo().then(info => {
        currentVersion.value = info.version
      })
    })
  }
})
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100%;
  background: var(--white);
  z-index: 1002;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1001;
  display: none;
}

.sidebar-overlay.active {
  display: block;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 10px;
  flex-shrink: 0;
}

.sidebar-header .logo {
  font-size: 2rem;
  color: var(--gray-6);
}

.sidebar-header i {
  font-size: 1.3rem;
  cursor: pointer;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.sidebar-menu {
  margin: 20px 0;
}

.about-content {
  margin-top: 10px;
  color: var(--gray-5);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid var(--gray-1);
  cursor: pointer;
}

.menu-item i {
  width: 24px;
  font-size: 1.2rem;
  margin-right: 12px;
}

.menu-item .mail,
.menu-item .version {
  font-size: 0.75rem;
  color: var(--gray-4);
  margin-left: auto;
}

.update-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: #e74c3c;
  margin-left: 8px;
  border-radius: 50%;
}

.sidebar-footer {
  flex-shrink: 0;
  padding: 20px;
  border-top: 1px solid var(--gray-1);
}

.state p {
  color: var(--gray-4);
  font-size: 0.7rem;
  text-align: center;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.footer-link {
  font-size: 0.7rem;
  color: var(--gray-4);
  text-decoration: none;
}

.link-separator {
  font-size: 0.7rem;
  color: var(--gray-3);
}
</style>
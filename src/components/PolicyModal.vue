<template>
  <div class="policy-modal" :class="{ active: isOpen }">
    <div class="policy-modal-content">
      <div class="policy-header">
        <i class="ri-arrow-left-long-line close-policy" @click="closeModal"></i>
        <h3>{{ title }}</h3>
      </div>
      <div class="policy-body" v-html="content"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isOpen = ref(false)
const title = ref('隐私政策')
const content = ref('<div class="loading-state"><i class="ri-loader-4-line"></i> 加载中...</div>')

const POLICY_URLS = {
  privacy: 'https://readsite.github.io/read-policylinks/privacy.html',
  terms: 'https://readsite.github.io/read-policylinks/terms.html'
}

async function loadPolicy(policyType) {
  title.value = policyType === 'privacy' ? '隐私政策' : '用户协议'
  content.value = '<div class="loading-state"><i class="ri-loader-4-line"></i> 加载中...</div>'
  
  try {
    const url = POLICY_URLS[policyType]
    const response = await fetch(url)
    if (!response.ok) throw new Error('加载失败')
    
    const htmlText = await response.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlText, 'text/html')
    
    let policyContent = doc.querySelector('.policy-card, .container, body')
    if (policyContent) {
      // 移除不需要的元素
      policyContent.querySelectorAll('script, style, .back-link, .footer').forEach(el => el.remove())
      content.value = policyContent.innerHTML
    } else {
      content.value = htmlText
    }
  } catch (err) {
    console.error('加载协议失败', err)
    content.value = `
      <div class="empty-state" style="text-align:center;padding:40px;">
        <i class="ri-error-warning-line"></i>
        <p>加载失败，请检查网络后重试</p>
        <button class="retry-btn" onclick="location.reload()">重试</button>
      </div>
    `
  }
}

function openModal(type) {
  isOpen.value = true
  loadPolicy(type)
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  isOpen.value = false
  document.body.style.overflow = ''
}

function handleOpenPolicy(e) {
  openModal(e.detail.type)
}

onMounted(() => {
  window.addEventListener('openPolicy', handleOpenPolicy)
})

onUnmounted(() => {
  window.removeEventListener('openPolicy', handleOpenPolicy)
})
</script>

<style scoped>
.policy-modal {
  position: fixed;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background: var(--white);
  z-index: 1006;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.policy-modal.active {
  transform: translateX(0);
}

.policy-modal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.policy-header {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  background: var(--white);
  border-bottom: 1px solid var(--gray-1);
}

.policy-header i {
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray-6);
}

.policy-header h3 {
  font-size: 1.125rem;
  font-weight: 500;
  margin-left: 10px;
  color: var(--gray-6);
}

.policy-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--gray-0);
}

.policy-body :deep(h1),
.policy-body :deep(h2),
.policy-body :deep(h3) {
  color: var(--gray-6);
  margin: 16px 0 8px;
}

.policy-body :deep(p),
.policy-body :deep(li) {
  color: var(--gray-5);
  line-height: 1.6;
  margin-bottom: 8px;
}

.policy-body :deep(ul) {
  margin-left: 20px;
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
</style>
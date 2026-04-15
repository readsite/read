<template>
  <div class="comment-modal" :class="{ active: isOpen }">
    <div class="comment-modal-content">
      <div class="comment-modal-header">
        <i class="ri-arrow-left-long-line close-comment-modal" @click="closeModal"></i>
        <h3>评论</h3>
      </div>
      <div class="comment-modal-body">
        <div class="comment-list-container">
          <div class="comment-list">
            <div v-for="comment in comments" :key="comment.id" class="comment-item" @click="showCommentActions(comment)">
              <div class="comment-header">
                <span class="comment-nickname">{{ comment.nickname || '匿名' }}</span>
                <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
              </div>
              <div class="comment-text">{{ comment.content }}</div>
            </div>
          </div>
          <div v-if="loadingComments" class="comment-loading">加载中...</div>
          <div v-else-if="comments.length === 0" class="comment-empty">暂无评论，来说两句吧~</div>
        </div>
        <div class="comment-form-area">
          <input type="text" class="nickname" v-model="nickname" placeholder="昵称（选填）" maxlength="50" />
          <textarea class="comment-content" v-model="commentContent" placeholder="写下你的评论..." rows="3" maxlength="500"></textarea>
          <button class="comment-submit-btn" @click="submitComment" :disabled="submitting">发表评论</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 评论操作菜单 -->
  <div class="comment-action-sheet" :class="{ active: actionSheetOpen }">
    <div class="action-overlay" @click="closeActionSheet"></div>
    <div class="action-panel">
      <div class="action-options">
        <div class="action-option" @click="copyComment">
          <i class="ri-file-copy-line"></i>
          <span>复制评论</span>
        </div>
        <div v-if="isOwner" class="action-option delete-option" @click="deleteComment">
          <i class="ri-delete-bin-line"></i>
          <span>删除评论</span>
        </div>
        <div v-else class="action-option" @click="reportComment">
          <i class="ri-alert-line"></i>
          <span>举报</span>
        </div>
      </div>
      <div class="action-cancel" @click="closeActionSheet">取消</div>
    </div>
  </div>
  
  <!-- 举报弹窗 -->
  <div class="report-modal" :class="{ active: reportModalOpen }">
    <div class="report-overlay" @click="closeReportModal"></div>
    <div class="report-panel">
      <div class="report-header">举报评论</div>
      <textarea class="report-reason" v-model="reportReason" rows="3" placeholder="请填写举报原因（必填）" maxlength="200"></textarea>
      <div class="report-actions">
        <button class="report-cancel" @click="closeReportModal">取消</button>
        <button class="report-submit" @click="submitReport">提交举报</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'
import { fetchComments, submitComment as apiSubmitComment, deleteComment as apiDeleteComment, fetchCommentsCount } from '../utils/api'
import { getItem, setItem } from '../utils/kvStore'

const appStore = useAppStore()
const { currentDate, currentTab } = storeToRefs(appStore)

const isOpen = ref(false)
const currentType = ref('music')
const comments = ref([])
const loadingComments = ref(false)
const nickname = ref('')
const commentContent = ref('')
const submitting = ref(false)

// 操作菜单
const actionSheetOpen = ref(false)
const activeComment = ref(null)
const isOwner = ref(false)

// 举报弹窗
const reportModalOpen = ref(false)
const reportReason = ref('')
const reportCommentId = ref(null)

function getDeviceToken() {
  let token = getItem('device_token')
  if (!token) {
    token = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16)
    setItem('device_token', token)
  }
  return token
}

async function loadComments() {
  if (!currentDate.value || !currentType.value) return
  
  loadingComments.value = true
  try {
    const result = await fetchComments(currentDate.value, currentType.value)
    comments.value = result || []
  } catch (err) {
    console.error('加载评论失败', err)
    comments.value = []
  } finally {
    loadingComments.value = false
  }
}

async function submitComment() {
  if (!commentContent.value.trim()) {
    appStore.showToast('评论内容不能为空')
    return
  }
  
  submitting.value = true
  const deviceToken = getDeviceToken()
  
  try {
    await apiSubmitComment(
      currentDate.value,
      currentType.value,
      nickname.value.trim(),
      commentContent.value.trim(),
      deviceToken
    )
    
    appStore.showToast('评论成功')
    nickname.value = ''
    commentContent.value = ''
    await loadComments()
    await updateCommentCount()
  } catch (err) {
    console.error('提交评论失败', err)
    appStore.showToast('评论失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

async function updateCommentCount() {
  try {
    const result = await fetchCommentsCount(currentDate.value, currentType.value)
    window.dispatchEvent(new CustomEvent('commentCountUpdated', {
      detail: {
        date: currentDate.value,
        type: currentType.value,
        count: result.count || 0
      }
    }))
  } catch (err) {
    console.warn('更新评论数失败', err)
  }
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function showCommentActions(comment) {
  activeComment.value = comment
  const deviceToken = getDeviceToken()
  isOwner.value = comment.owner_token === deviceToken
  actionSheetOpen.value = true
}

function closeActionSheet() {
  actionSheetOpen.value = false
  activeComment.value = null
}

async function copyComment() {
  if (activeComment.value) {
    try {
      await navigator.clipboard.writeText(activeComment.value.content)
      appStore.showToast('评论已复制')
    } catch (err) {
      appStore.showToast('复制失败')
    }
  }
  closeActionSheet()
}

async function deleteComment() {
  if (!activeComment.value) return
  
  const deviceToken = getDeviceToken()
  try {
    await apiDeleteComment(activeComment.value.id, deviceToken)
    appStore.showToast('删除成功')
    await loadComments()
    await updateCommentCount()
  } catch (err) {
    console.error('删除评论失败', err)
    appStore.showToast('删除失败，请稍后重试')
  }
  closeActionSheet()
}

function reportComment() {
  if (activeComment.value) {
    reportCommentId.value = activeComment.value.id
    reportReason.value = ''
    reportModalOpen.value = true
  }
  closeActionSheet()
}

function closeReportModal() {
  reportModalOpen.value = false
  reportCommentId.value = null
  reportReason.value = ''
}

async function submitReport() {
  if (!reportReason.value.trim()) {
    appStore.showToast('请填写举报原因')
    return
  }
  
  const reporterToken = getDeviceToken()
  
  try {
    const response = await fetch('https://solitudenook.top/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment_id: reportCommentId.value,
        reason: reportReason.value,
        reporter_token: reporterToken
      })
    })
    
    if (response.status === 409) {
      appStore.showToast('您已举报过该评论')
    } else if (!response.ok) {
      throw new Error('举报失败')
    } else {
      appStore.showToast('举报已提交，我们会尽快处理')
    }
  } catch (err) {
    console.error('举报失败', err)
    appStore.showToast('举报失败，请稍后重试')
  }
  
  closeReportModal()
}

function openModal(type) {
  currentType.value = type
  isOpen.value = true
  loadComments()
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  isOpen.value = false
  document.body.style.overflow = ''
}

function handleOpenComments(e) {
  openModal(e.detail.type)
}

onMounted(() => {
  window.addEventListener('openComments', handleOpenComments)
})

onUnmounted(() => {
  window.removeEventListener('openComments', handleOpenComments)
})
</script>

<style scoped>
.comment-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--white);
  z-index: 1004;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.comment-modal.active {
  transform: translateX(0);
}

.comment-modal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.comment-modal-header {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  background: var(--white);
  border-bottom: 1px solid var(--gray-1);
}

.comment-modal-header i {
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray-6);
}

.comment-modal-header h3 {
  font-size: 1.125rem;
  font-weight: 500;
  margin-left: 10px;
  color: var(--gray-6);
}

.comment-modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
  gap: 16px;
}

.comment-list-container {
  flex: 1;
  overflow-y: auto;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment-item {
  padding: 12px;
  background: var(--gray-0);
  border-radius: 8px;
  cursor: pointer;
}

.dark-mode .comment-item {
  background: rgba(255, 255, 255, 0.1);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.comment-nickname {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--gray-6);
  padding: 2px 8px;
  background: var(--gray-2);
  border-radius: 4px;
}

.comment-time {
  font-size: 0.7rem;
  color: var(--gray-4);
}

.comment-text {
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--gray-5);
  word-break: break-word;
}

.comment-loading,
.comment-empty {
  text-align: center;
  padding: 40px;
  color: var(--gray-4);
}

.comment-form-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--gray-1);
}

.nickname {
  padding: 10px 12px;
  border: 1px solid var(--gray-2);
  border-radius: 8px;
  font-size: 0.9rem;
  background: var(--white);
  color: var(--gray-6);
  outline: none;
}

.comment-content {
  padding: 10px 12px;
  border: 1px solid var(--gray-2);
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  background: var(--white);
  color: var(--gray-6);
  outline: none;
}

.comment-submit-btn {
  align-self: flex-end;
  background: var(--gray-7);
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
}

.comment-submit-btn:disabled {
  opacity: 0.6;
}

/* 操作菜单 */
.comment-action-sheet {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  visibility: hidden;
  opacity: 0;
  transition: visibility 0.2s, opacity 0.2s;
}

.comment-action-sheet.active {
  visibility: visible;
  opacity: 1;
}

.action-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
}

.action-panel {
  position: relative;
  background: var(--white);
  width: 100%;
  border-radius: 12px 12px 0 0;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.comment-action-sheet.active .action-panel {
  transform: translateY(0);
}

.action-options {
  padding: 8px 0;
}

.action-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  cursor: pointer;
  font-size: 1rem;
  color: var(--gray-6);
}

.action-option:active {
  background: var(--gray-1);
}

.action-option i {
  font-size: 1.2rem;
  width: 24px;
}

.action-option.delete-option {
  color: #e74c3c;
}

.action-option.delete-option i {
  color: #e74c3c;
}

.action-cancel {
  text-align: center;
  padding: 14px;
  cursor: pointer;
  color: var(--gray-5);
  border-top: 1px solid var(--gray-1);
}

/* 举报弹窗 */
.report-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2001;
  display: flex;
  align-items: flex-end;
  visibility: hidden;
  opacity: 0;
  transition: visibility 0.2s, opacity 0.2s;
}

.report-modal.active {
  visibility: visible;
  opacity: 1;
}

.report-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
}

.report-panel {
  position: relative;
  background: var(--white);
  width: 100%;
  padding: 20px;
  border-radius: 12px 12px 0 0;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.report-modal.active .report-panel {
  transform: translateY(0);
}

.report-header {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 16px;
  color: var(--gray-6);
}

.report-reason {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--gray-2);
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 16px;
  background: var(--white);
  color: var(--gray-6);
  outline: none;
}

.report-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.report-cancel,
.report-submit {
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

.report-cancel {
  background: var(--gray-1);
  color: var(--gray-5);
}

.report-submit {
  background: var(--gray-7);
  color: white;
}
</style>
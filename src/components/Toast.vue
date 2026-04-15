<template>
  <div class="toast-container" v-if="visible">
    <div class="toast">{{ message }}</div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'

const appStore = useAppStore()
const { toastVisible: visible, toastMessage: message } = storeToRefs(appStore)
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100000;
  pointer-events: none;
}

.toast {
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  white-space: nowrap;
  animation: fadeInOut 2s ease forwards;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: scale(0.9); }
  15% { opacity: 1; transform: scale(1); }
  85% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.9); }
}
</style>
<template>
  <div class="timeline-modal" :class="{ active: isOpen }">
    <div class="timeline-modal-content">
      <div class="timeline-header">
        <i class="ri-arrow-left-long-line close-timeline" @click="closeModal"></i>
        <h3>回顾</h3>
      </div>
      <div class="timeline-body">
        <div class="timeline-left">
          <ul class="month-list">
            <li 
              v-for="month in months" 
              :key="month.key"
              class="month-item"
              :class="{ active: activeMonth === month.key }"
              @click="selectMonth(month.key)"
            >
              {{ month.month }}月
            </li>
          </ul>
        </div>
        <div class="timeline-right">
          <div class="date-grid">
            <div 
              v-for="date in currentDates" 
              :key="date"
              class="time-box"
              :class="{ 
                'current-date-box': date === currentDate,
                'date-read': isDateRead(date)
              }"
              @click="goToDate(date)"
            >
              <p class="his-day">{{ getDay(date) }}</p>
              <span class="his-fix"></span>
              <div class="his-year-row">
                <p class="his-year">{{ getYear(date) }}</p>
                <span class="his-weekday">{{ getWeekday(date) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../store'
import { getDateReadStatus } from '../utils/db'

const appStore = useAppStore()
const { currentDate, publishedDates } = storeToRefs(appStore)

const isOpen = ref(false)
const activeMonth = ref('')
const readStatusMap = ref(new Map())

const months = computed(() => {
  const monthMap = new Map()
  publishedDates.value.forEach(date => {
    const [year, month] = date.split('-')
    const key = `${year}-${month}`
    if (!monthMap.has(key)) {
      monthMap.set(key, { key, year, month: parseInt(month), dates: [] })
    }
    monthMap.get(key).dates.push(date)
  })
  return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key))
})

const currentDates = computed(() => {
  const month = months.value.find(m => m.key === activeMonth.value)
  if (!month) return []
  return [...month.dates].sort((a, b) => b.localeCompare(a))
})

function openModal() {
  isOpen.value = true
  loadReadStatuses()
  if (months.value.length && !activeMonth.value) {
    activeMonth.value = months.value[0].key
  }
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  isOpen.value = false
  document.body.style.overflow = ''
}

function selectMonth(monthKey) {
  activeMonth.value = monthKey
}

async function loadReadStatuses() {
  const newMap = new Map()
  for (const date of publishedDates.value) {
    const status = await getDateReadStatus(date)
    const isFullyRead = status.music && status.sentence && status.article
    if (isFullyRead) {
      newMap.set(date, true)
    }
  }
  readStatusMap.value = newMap
}

function isDateRead(date) {
  return readStatusMap.value.get(date) || false
}

function getDay(date) {
  return parseInt(date.split('-')[2], 10)
}

function getYear(date) {
  return date.split('-')[0]
}

function getWeekday(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdays[date.getDay()]
}

function goToDate(date) {
  if (date === currentDate.value) {
    closeModal()
    return
  }
  appStore.switchToDate(date)
  closeModal()
}

function handleOpenTimeline() {
  openModal()
}

function handleDateDataLoaded() {
  loadReadStatuses()
}

onMounted(() => {
  window.addEventListener('openTimeline', handleOpenTimeline)
  window.addEventListener('dateDataLoaded', handleDateDataLoaded)
})

onUnmounted(() => {
  window.removeEventListener('openTimeline', handleOpenTimeline)
  window.removeEventListener('dateDataLoaded', handleDateDataLoaded)
})
</script>

<style scoped>
.timeline-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--white);
  z-index: 1003;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.timeline-modal.active {
  transform: translateX(0);
}

.timeline-modal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline-header {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  background: var(--white);
}

.timeline-header i {
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray-6);
}

.timeline-header h3 {
  font-size: 1.125rem;
  font-weight: 500;
  margin-left: 10px;
  color: var(--gray-6);
}

.timeline-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  background-color: var(--gray-0);
}

.timeline-left {
  width: 30%;
  overflow-y: auto;
  background: var(--white);
}

.month-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.month-item {
  padding: 12px 16px;
  cursor: pointer;
  color: var(--gray-5);
  transition: all 0.2s;
  font-size: 1rem;
}

.month-item.active {
  color: var(--gray-6);
  font-weight: 600;
  background: var(--gray-1);
  position: relative;
}

.month-item.active::after {
  content: '';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background-color: var(--gray-6);
  border-radius: 50%;
}

.timeline-right {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.time-box {
  background: var(--white);
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 8px;
}

.time-box:active {
  transform: scale(0.96);
}

.time-box.current-date-box {
  border: 1px solid var(--gray-3);
}

.time-box.date-read {
  opacity: 0.6;
}

.his-day {
  font-size: 2rem;
  font-weight: 500;
  color: var(--gray-6);
}

.his-fix {
  display: block;
  height: 1px;
  background-color: var(--gray-2);
  margin: 8px 0;
}

.his-year-row {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 8px;
}

.his-year {
  font-size: 0.75rem;
  color: var(--gray-4);
}

.his-weekday {
  font-size: 0.75rem;
  color: var(--gray-4);
}
</style>
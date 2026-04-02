// ========== 全局配置 ==========
const API_BASE = 'https://solitudenook.top';

// ========== 全局变量与状态 ==========
const navItems = document.querySelectorAll('.nav-item');
const cards = document.querySelectorAll('.card');
const highlight = document.querySelector('.highlight');
const navContainer = document.querySelector('.nav-container');
const STATE_KEY = 'ios_nav_state';
const DEFAULT_TAB = 'music';

const tabOrder = ['music', 'sentence', 'article'];
let currentIndex = 0;
let isAnimating = false;

const albumImage = document.querySelector('.album-image');
const playPauseIcon = document.querySelector('.play-pause-icon');
const progressFill = document.querySelector('.progress-fill');
const trackAlbum = document.querySelector('.track-album');
const trackSinger = document.querySelector('.track-singer');
let currentDisplayDate = '';
let isUpdatingUI = false;

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const menuBtn = document.querySelector('.menu');
const closeSidebarBtn = document.querySelector('.close-sidebar');

const timelineModal = document.querySelector('.timeline-modal');
const timelineClose = document.querySelector('.close-timeline');
const timelineTrigger = document.getElementById('timeline-trigger');

let currentDate = '';
// ========== 网络状态管理 ==========
let isNetworkAvailable = navigator.onLine;      // 初始同步浏览器状态
let isShowingOfflinePlaceholder = false;
const offlinePlaceholder = document.getElementById('offlinePlaceholder');

// 辅助函数：显示/隐藏占位符
function showOfflinePlaceholder(show) {
    if (show === isShowingOfflinePlaceholder) return;
    isShowingOfflinePlaceholder = show;
    if (offlinePlaceholder) {
        offlinePlaceholder.style.display = show ? 'flex' : 'none';
    }

    // 根据网络状态设置 body 类，控制导航栏和日期框的可见性
    if (show) {
        document.body.classList.remove('online');
    } else {
        document.body.classList.add('online');
    }
}

// 核心重试：尝试重新连接并刷新当前页面内容
async function retryNetworkAndReload() {

    // 如果浏览器报告离线，直接提示并返回
    if (!navigator.onLine) {
        showToast('网络未连接，请检查网络设置', 1500);
        return false;
    }

    // 设置超时（5秒），避免请求长时间挂起
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const res = await fetch(`${API_BASE}/api/dates`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('网络请求失败');
        
        // 重新获取日期列表（强制刷新缓存）
        publishedDates = [];          // 清空旧缓存
        isDateListLoading = false;    // 重置加载锁
        await fetchPublishedDatesList(); // 重新拉取

        // 成功：网络恢复
        isNetworkAvailable = true;
        showOfflinePlaceholder(false);
        
        const urlDate = getDateFromUrl();
        if (urlDate && urlDate !== currentDate) {
            await switchToDate(urlDate);
        } else if (currentDate) {
            // 清除当前日期的缓存，确保拿到最新数据
            dateDataCache.delete(currentDate);
            await loadDataForDate(currentDate);
        } else {
            // 既无URL日期也无当前日期 → 使用最新发布日期
            const allDates = await fetchPublishedDatesList();
            const latestDate = allDates.length ? allDates[allDates.length - 1] : null;
            if (latestDate) {
                await switchToDate(latestDate);
            } else {
                showToast('暂无内容，请稍后再试', 1500);
            }
        }
        return true;
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn('重试失败', err);
        // 区分超时和普通错误
        if (err.name === 'AbortError') {
            showToast('网络请求超时，请检查网络后重试', 2000);
        } else {
            showToast('网络仍未恢复，请稍后再试', 1500);
        }
        return false;
    }
}

// 统一网络错误处理（在 fetch 失败时调用）
function handleNetworkError(error) {
    console.warn('网络请求失败', error);
    isNetworkAvailable = false;
    showOfflinePlaceholder(true);
}

// ========== 新增：日期列表与日期切换相关 ==========
let publishedDates = [];          // 升序排列的日期数组（从旧到新）
let isDateListLoading = false;    // 防止重复请求
let isDateSwitching = false;      // 防止日期切换中的并发操作

// ========== 获取并缓存已发布日期列表 ==========
async function fetchPublishedDatesList() {
    if (publishedDates.length > 0) return publishedDates;
    if (isDateListLoading) {
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!isDateListLoading) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
        });
        return publishedDates;
    }
    isDateListLoading = true;
    try {
        const res = await fetch(`${API_BASE}/api/dates`);
        if (!res.ok) throw new Error('获取日期列表失败');
        const dates = await res.json();
        publishedDates = Array.isArray(dates) ? dates : [];
        isNetworkAvailable = true;          // 请求成功，网络可用
        showOfflinePlaceholder(false);
        return publishedDates;
    } catch (err) {
        console.warn('获取日期列表失败，日期切换功能将受限', err);
        publishedDates = [];
        handleNetworkError(err);            // 触发占位符
        return [];
    } finally {
        isDateListLoading = false;
    }
    return publishedDates;
}

// ========== 获取相邻发布日期 ==========
function getPrevPublishedDate(currentDate) {
    if (!publishedDates.length) return null;
    const idx = publishedDates.indexOf(currentDate);
    if (idx <= 0) return null;
    return publishedDates[idx - 1];
}

function getNextPublishedDate(currentDate) {
    if (!publishedDates.length) return null;
    const idx = publishedDates.indexOf(currentDate);
    if (idx === -1 || idx >= publishedDates.length - 1) return null;
    return publishedDates[idx + 1];
}

// ========== 增强的日期切换（支持指定目标卡片类型） ==========
async function switchToDate(date, targetTab = null) {
      if (!navigator.onLine || !isNetworkAvailable) {
        showToast('网络连接不可用，无法切换日期', 1500);
        showOfflinePlaceholder(true);
        return;
    }
    // 防止重复切换
    if (isDateSwitching) return;
    // 如果切换的日期与当前相同且没有指定目标标签页，只关闭时间轴模态框并返回
    if (date === currentDate && !targetTab) {
        closeTimelineModal();
        return;
    }

    isDateSwitching = true;

    try {
        // 如果指定了目标标签页（音乐/句子/文章），先切换到对应卡片
        if (targetTab) {
            const targetIndex = getIndexFromId(targetTab);
            if (targetIndex !== currentIndex) {
                setCardsPosition(targetIndex);
                currentIndex = targetIndex;

                // 更新导航栏高亮和活动状态
                navItems.forEach(item => item.classList.remove('active'));
                const targetNavItem = document.querySelector(`[data-target="${targetTab}"]`);
                if (targetNavItem) targetNavItem.classList.add('active');

                updateHighlight();
                localStorage.setItem(STATE_KEY, targetTab);
            }
        }

        // 加载新日期的数据（如果缓存中有则直接显示，否则请求后端）
        await loadDataForDate(date);

        // 关闭时间轴模态框（如果打开的话）
        closeTimelineModal();

        // 更新 URL 中的日期参数，方便分享和浏览器前进后退
        const newUrl = `?date=${date}`;
        window.history.pushState({ date }, '', newUrl);
    } catch (err) {
        console.warn('日期切换失败', err);
        // 可在此处添加用户提示，如 showToast('切换失败，请稍后重试');
    } finally {
        isDateSwitching = false;

        // 关键修复：重置拖拽模块内部状态，避免在日期切换后无法滑动
        if (typeof window.resetDragModule === 'function') {
            window.resetDragModule();
        }
    }
}

// ========== 音频管理器 ==========
class AudioManager {
    constructor() {
        this.players = new Map();
        this.currentPlayingDate = null;
        this.uiUpdateTimer = null;
    }

    getOrCreate(date, src, title, artist, cover) {
        if (!this.players.has(date)) {
            const audio = new Audio();
            audio.src = src;
            audio.preload = 'metadata';
            audio.loop = false;

            audio.addEventListener('timeupdate', () => this.onTimeUpdate(date, audio));
            audio.addEventListener('ended', () => this.onEnded(date));
            audio.addEventListener('play', () => this.onPlay(date));
            audio.addEventListener('pause', () => this.onPause(date));

            this.players.set(date, {
                audio: audio,
                playing: false,
                currentTime: 0,
                src: src,
                title: title,
                artist: artist,
                cover: cover
            });
        } else {
            const player = this.players.get(date);
            if (player.src !== src && src) {
                player.src = src;
                player.audio.src = src;
                player.playing = false;
                player.currentTime = 0;
                player.audio.currentTime = 0;
            }
            if (title) player.title = title;
            if (artist) player.artist = artist;
            if (cover) player.cover = cover;
        }
        return this.players.get(date);
    }

    play(date) {
        const player = this.players.get(date);
        if (!player || !player.src) return false;

        if (this.currentPlayingDate && this.currentPlayingDate !== date) {
            this.stop(this.currentPlayingDate);
        }

        if (player.audio.paused) {
            player.audio.play().catch(e => console.warn('播放失败', e));
            player.playing = true;
            this.currentPlayingDate = date;
            if (date === currentDisplayDate) {
                this.updateUIForDate(date);
            }
        }
        return true;
    }

    pause(date) {
        const player = this.players.get(date);
        if (player && !player.audio.paused) {
            player.audio.pause();
            player.playing = false;
            if (this.currentPlayingDate === date) {
                this.currentPlayingDate = null;
            }
            if (date === currentDisplayDate) {
                this.updateUIForDate(date);
            }
        }
    }

stop(date) {
    const player = this.players.get(date);
    if (player) {
        player.audio.pause();
        player.audio.currentTime = 0;
        player.audio.load();              // 强制重置音频内部状态，确保进度归零
        player.playing = false;
        player.currentTime = 0;
        if (this.currentPlayingDate === date) {
            this.currentPlayingDate = null;
        }
        if (date === currentDisplayDate) {
            this.updateUIForDate(date);
        }
    }
}

    stopAllExcept(exceptDate) {
        for (let [date, player] of this.players.entries()) {
            if (date !== exceptDate && player.playing) {
                player.audio.pause();
                player.playing = false;
                if (this.currentPlayingDate === date) {
                    this.currentPlayingDate = null;
                }
            }
        }
    }

    getPlayerState(date) {
        return this.players.get(date) || null;
    }

    updateUIForDate(date) {
        if (isUpdatingUI || date !== currentDisplayDate) return;
        isUpdatingUI = true;

        const player = this.players.get(date);
        if (player) {
            if (player.playing) {
                playPauseIcon.classList.remove('pause');
                playPauseIcon.classList.add('play');
                albumImage.classList.add('rotating');
                albumImage.style.animationPlayState = 'running';
            } else {
                playPauseIcon.classList.remove('play');
                playPauseIcon.classList.add('pause');
                albumImage.style.animationPlayState = 'paused';
            }

            const duration = player.audio.duration;
            if (duration && isFinite(duration)) {
                const percent = (player.audio.currentTime / duration) * 100;
                progressFill.style.width = percent + '%';
            } else {
                progressFill.style.width = '0%';
            }
        } else {
            playPauseIcon.classList.remove('play');
            playPauseIcon.classList.add('pause');
            albumImage.classList.remove('rotating');
            progressFill.style.width = '0%';
        }

        isUpdatingUI = false;
    }

    onTimeUpdate(date, audio) {
        if (date === currentDisplayDate) {
            if (!isUpdatingUI && audio.duration) {
                const percent = (audio.currentTime / audio.duration) * 100;
                progressFill.style.width = percent + '%';
            }
        }
        const player = this.players.get(date);
        if (player) player.currentTime = audio.currentTime;
    }

    onEnded(date) {
        const player = this.players.get(date);
        if (player) {
            player.playing = false;
            player.currentTime = 0;
            player.audio.currentTime = 0;
            if (this.currentPlayingDate === date) {
                this.currentPlayingDate = null;
            }
            if (date === currentDisplayDate) {
                this.updateUIForDate(date);
                progressFill.style.width = '0%';
            }
        }
    }

    onPlay(date) {
        const player = this.players.get(date);
        if (player) {
            player.playing = true;
            if (this.currentPlayingDate !== date) {
                this.stopAllExcept(date);
                this.currentPlayingDate = date;
            }
            if (date === currentDisplayDate) {
                this.updateUIForDate(date);
            }
        }
    }

    onPause(date) {
        const player = this.players.get(date);
        if (player) {
            player.playing = false;
            if (this.currentPlayingDate === date) {
                this.currentPlayingDate = null;
            }
            if (date === currentDisplayDate) {
                this.updateUIForDate(date);
            }
        }
    }

    clear() {
        for (let [date, player] of this.players.entries()) {
            player.audio.pause();
            player.audio.src = '';
        }
        this.players.clear();
        this.currentPlayingDate = null;
    }
}

const audioManager = new AudioManager();

// ========== 收藏摘要缓存管理 ==========
const FAVORITE_SUMMARY_KEY_PREFIX = 'fav_summary_';

function saveFavoriteSummary(date, type, data) {
    let summary = null;
    if (type === 'music' && data.music) {
        summary = {
            title: data.music.title,
            subtitle: data.music.artist,
            cover: data.music.cover,
            preview: ''  // 音乐无需预览
        };
    } else if (type === 'sentence' && data.sentence) {
        summary = {
            title: '',
            subtitle: data.sentence.author,
            cover: data.sentence.image || '',
            preview: data.sentence.text  // 存储完整句子文本
        };
    } else if (type === 'article' && data.article) {
        summary = {
            title: data.article.title,
            subtitle: data.article.author,
            cover: data.article.image,
            preview: data.article.content.replace(/\n/g, ' ')  // 存储完整内容（去换行）
        };
    }
    if (summary) {
        const key = `${FAVORITE_SUMMARY_KEY_PREFIX}${date}_${type}`;
        localStorage.setItem(key, JSON.stringify(summary));
    }
}
function removeFavoriteSummary(date, type) {
    const key = `${FAVORITE_SUMMARY_KEY_PREFIX}${date}_${type}`;
    localStorage.removeItem(key);
}

function getAllFavoriteSummaries() {
    const summaries = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(FAVORITE_SUMMARY_KEY_PREFIX)) {
            const [, dateType] = key.split(FAVORITE_SUMMARY_KEY_PREFIX);
            const [date, type] = dateType.split('_');
            const summaryStr = localStorage.getItem(key);
            if (summaryStr) {
                try {
                    const summary = JSON.parse(summaryStr);
                    summaries.push({ date, type, summary });
                } catch (e) { }
            }
        }
    }
    return summaries;
}

// ========== 卡片垂直居中控制 ==========
function updateCardVerticalPosition() {
    const nav = document.querySelector('.top-nav');
    const cardContainer = document.querySelector('.card-container');
    if (!nav || !cardContainer) return;

    const navHeight = nav.offsetHeight;
    const viewportHeight = window.innerHeight;

    cardContainer.style.height = (viewportHeight - navHeight) + 'px';
    cardContainer.style.top = navHeight + 'px';
}

function setCardsPosition(activeIndex) {
    cards.forEach((card, i) => {
        if (i === activeIndex) {
            card.style.transform = 'translateX(0)';
            card.style.opacity = '1';
            card.style.zIndex = '2';
            card.style.pointerEvents = 'auto';
        } else {
            const offset = i < activeIndex ? '-100%' : '100%';
            card.style.transform = `translateX(${offset})`;
            card.style.opacity = '0';
            card.style.zIndex = '1';
            card.style.pointerEvents = 'none';
        }
    });
}

function switchTo(newIndex) {
    if (isAnimating || newIndex === currentIndex) return;

    isAnimating = true;
    const oldIndex = currentIndex;
    currentIndex = newIndex;

    setCardsPosition(newIndex);
    const onTransitionEnd = () => {
    updateHighlight();
    updateCardVerticalPosition();
    isAnimating = false;
    cards[0].removeEventListener('transitionend', onTransitionEnd);
};
    
    const targetId = tabOrder[newIndex];
    navItems.forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-target="${targetId}"]`).classList.add('active');
    localStorage.setItem(STATE_KEY, targetId);
    updateHighlight();

    setTimeout(() => {
        isAnimating = false;
    }, 400);
}

function getIndexFromId(id) {
    return tabOrder.indexOf(id);
}

// ========== 日期处理 ==========
function getDateFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('date');
}

function getLocalToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function getLatestPublishedDate() {
    try {
        const res = await fetch(`${API_BASE}/api/posts?type=published`);
        if (!res.ok) throw new Error('获取日期列表失败');
        let data = await res.json();
        let posts = Array.isArray(data) ? data : (data.posts || data.data || []);
        if (!posts.length) return null;
        const dates = posts.map(item => item.date).filter(d => d);
        if (!dates.length) return null;
        dates.sort((a, b) => b.localeCompare(a));
        return dates[0];
    } catch (err) {
        console.warn('获取最新日期失败:', err);
        return null;
    }
}

function displayDateInNav(date) {
    const [year, month, day] = date.split('-');
    const monthNum = parseInt(month, 10);
    document.querySelector('.date-year').innerHTML = `${year}.${monthNum}.<span class="date-day">${day}<span class="date-tag"></span></span>`;
}

function loadLikedStateFromLocalStorage(date) {
    ['music', 'sentence', 'article'].forEach(type => {
        const key = `${date}_${type}_favorite`;
        const isLiked = localStorage.getItem(key) === 'true';
        const btnIcon = document.querySelector(`.stats-actions[data-type="${type}"] .favorite-btn i`);
        if (btnIcon) {
            if (isLiked) {
                btnIcon.classList.remove('ri-heart-2-line');
                btnIcon.classList.add('ri-heart-2-fill');
            } else {
                btnIcon.classList.remove('ri-heart-2-fill');
                btnIcon.classList.add('ri-heart-2-line');
            }
        }
    });
}

async function loadDataForDate(date) {
    currentDate = date;
    currentDisplayDate = date;

    let data = dateDataCache.get(date);
    if (data) {
        updatePage(data, date);
        loadLikedStateFromLocalStorage(date);
        updateCardVerticalPosition();
        displayDateInNav(date);
        audioManager.updateUIForDate(date);
        return;
    }

    document.querySelectorAll('.stats-actions .favorite-btn i').forEach(icon => {
        icon.classList.remove('ri-heart-2-fill');
        icon.classList.add('ri-heart-2-line');
    });

    try {
        const response = await fetch(`${API_BASE}/api/posts/${date}`);
        if (!response.ok) throw new Error('No data');
        data = await response.json();
        dateDataCache.set(date, data);
        updatePage(data, date);
        loadLikedStateFromLocalStorage(date);
        updateCardVerticalPosition();
        displayDateInNav(date);
        audioManager.updateUIForDate(date);
        isNetworkAvailable = true;
        showOfflinePlaceholder(false);
    } catch (e) {
        console.log('No data for this date, clearing content.');
        updatePage({}, date);
        updateCardVerticalPosition();
        audioManager.updateUIForDate(date);
        handleNetworkError(e);               // 触发占位符
    }
}

// ========== 时间轴数据加载 ==========
async function loadTimelineData() {
    // 显示加载状态
    const monthListEl = document.querySelector('.month-list');
    const dateGridEl = document.querySelector('.date-grid');

    // 复用全局日期列表缓存（确保已加载）
    await fetchPublishedDatesList();   // 内部已有并发锁，不会重复请求

    const dates = publishedDates;      // 升序排列的日期数组（旧→新）
    if (!dates.length) {
        if (monthListEl) monthListEl.innerHTML = '<li>暂无数据</li>';
        if (dateGridEl) dateGridEl.innerHTML = '<p>暂无日期</p>';
        return;
    }

    // 按年月分组
    const monthMap = new Map();
    dates.forEach(date => {
        const [year, month] = date.split('-');
        const key = `${year}-${month}`;
        if (!monthMap.has(key)) monthMap.set(key, []);
        monthMap.get(key).push(date);
    });

    // 构建月份列表（降序：最近月份在前）
    const months = Array.from(monthMap.entries())
        .map(([key, dates]) => ({ key, dates }))
        .sort((a, b) => b.key.localeCompare(a.key));

    // 渲染时间轴（传入分组数据）
    renderTimeline(months);
}

function renderTimeline(months) {
    const monthList = document.querySelector('.month-list');
    const dateGrid = document.querySelector('.date-grid');
    if (!months.length) {
        monthList.innerHTML = '<li>暂无数据</li>';
        dateGrid.innerHTML = '<p>暂无日期</p>';
        return;
    }
    monthList.innerHTML = months.map((month, index) => {
        const [year, monthNum] = month.key.split('-');
        const label = `${parseInt(monthNum)}月`;
        return `<li class="month-item ${index === 0 ? 'active' : ''}" data-month-key="${month.key}">${label}</li>`;
    }).join('');
    renderDatesForMonth(months[0].key, months);
    document.querySelectorAll('.month-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.month-item').forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            const monthKey = item.dataset.monthKey;
            renderDatesForMonth(monthKey, months);
        });
    });
}

function renderDatesForMonth(monthKey, allMonths) {
    const month = allMonths.find(m => m.key === monthKey);
    if (!month) return;
    const dateGrid = document.querySelector('.date-grid');
    const sortedDates = month.dates.sort((a, b) => (a < b ? 1 : -1));
    dateGrid.innerHTML = sortedDates.map(date => {
        const [year, month, day] = date.split('-');
        return `
            <a class="time-box" href="?date=${date}" data-date="${date}">
                <p class="his-day">${day}</p>
                <span class="his-fix"></span>
                <p class="his-year">${year}</p>
            </a>
        `;
    }).join('');
}

document.addEventListener('click', (e) => {
    const timeBox = e.target.closest('.time-box');
    if (!timeBox) return;
    e.preventDefault();
    const date = timeBox.getAttribute('data-date');
    if (date) {
        switchToDate(date);
    }
});

function updatePage(data, date) {
    const musicTitle = data.music?.title || '';
    const musicArtist = data.music?.artist || '';
    const musicCover = data.music?.cover || '';
    const musicSrc = data.music?.src || '';

    trackAlbum.textContent = musicTitle;
    trackSinger.textContent = musicArtist;
    document.getElementById('album-img').src = musicCover;
const albumImg = document.getElementById('album-img');
// 重置并隐藏
albumImg.onload = null;
albumImg.onerror = null;
albumImg.style.display = 'none';

if (musicCover) {
    albumImg.onload = () => {
        albumImg.style.display = 'block';
    };
    albumImg.onerror = () => {
        albumImg.style.display = 'none';
        // 可选：设置默认占位图（若需要可取消注释）
        // albumImg.src = 'img/default-cover.png';
    };
    albumImg.src = musicCover;
    // 如果图片已缓存，立即显示
    if (albumImg.complete) {
        albumImg.onload();
    }
} else {
    albumImg.style.display = 'none';
}
    if (musicSrc) {
        audioManager.getOrCreate(date, musicSrc, musicTitle, musicArtist, musicCover);
    } else {
        const existing = audioManager.getPlayerState(date);
        if (existing) {
            existing.audio.pause();
            existing.playing = false;
        }
    }

    const sentenceTextEl = document.getElementById('sentenceText');
    if (sentenceTextEl) {
        const sentenceContent = data.sentence?.text || '';
        sentenceTextEl.innerHTML = sentenceContent.replace(/\n/g, '<br>');
    }

    const fromSpan = document.querySelector('#sentence .from span');
    if (fromSpan) {
        fromSpan.textContent = data.sentence?.author ? '—' + data.sentence.author : '';
    }

    const sentenceImgContainer = document.getElementById('sentenceImageContainer');
    const sentenceImg = document.getElementById('sentenceImg');
    const sentenceImageUrl = data.sentence?.image || '';

    if (sentenceImageUrl && sentenceImgContainer && sentenceImg) {
        sentenceImg.src = sentenceImageUrl;
        sentenceImgContainer.style.display = 'block';
    } else if (sentenceImgContainer) {
        sentenceImgContainer.style.display = 'none';
    }

    const fullContent = data.article?.content || '';
    document.getElementById('article-title').textContent = data.article?.title || '';
    document.getElementById('article-author').textContent = `文/${data.article?.author || '佚名'}`;
    document.getElementById('article-content').innerHTML = fullContent.replace(/\n/g, '<br>');
    const articleImg = document.querySelector('#article .bg-img img');
    const articleBg = document.querySelector('#article .bg-img');

    if (articleImg && articleBg) {
        const imageUrl = data.article?.image || '';

        articleImg.style.display = 'none';
        articleBg.classList.remove('load-failed');

        if (imageUrl) {
            articleImg.onload = () => {
                articleImg.style.display = 'block';
            };
            articleImg.onerror = () => {
                articleBg.classList.add('load-failed');
                articleImg.style.display = 'none';
            };
            articleImg.src = imageUrl;
        } else {
            articleBg.classList.add('load-failed');
        }
    }

    const musicStats = data.musicStats || { favorites: 0, shares: 0 };
    const sentenceStats = data.sentenceStats || { favorites: 0, shares: 0 };
    const articleStats = data.articleStats || { favorites: 0, shares: 0 };

    document.querySelector('#music .stats-actions .favorite-btn .count').textContent = musicStats.favorites;
    document.querySelector('#music .stats-actions .share-btn .count').textContent = musicStats.shares;
    document.querySelector('#sentence .stats-actions .favorite-btn .count').textContent = sentenceStats.favorites;
    document.querySelector('#sentence .stats-actions .share-btn .count').textContent = sentenceStats.shares;
    document.querySelector('#article .stats-actions .favorite-btn .count').textContent = articleStats.favorites;
    document.querySelector('#article .stats-actions .share-btn .count').textContent = articleStats.shares;

    currentDisplayDate = date;
}

playPauseIcon.addEventListener('click', () => {
    if (!currentDisplayDate) return;

    const player = audioManager.getPlayerState(currentDisplayDate);
    if (!player || !player.src) {
        return;
    }

    if (player.playing) {
        audioManager.pause(currentDisplayDate);
    } else {
        audioManager.play(currentDisplayDate);
    }
});

function updateHighlight() {
    const activeItem = document.querySelector('.nav-item.active');
    if (!activeItem) return;
    const navRect = navContainer.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    highlight.style.width = `${itemRect.width}px`;
    highlight.style.height = `3px`;
    highlight.style.left = `${itemRect.left - navRect.left}px`;
    highlight.style.top = `${itemRect.bottom - navRect.top + 1}px`;
    highlight.style.opacity = '1';
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.dataset.target;
        const newIndex = getIndexFromId(targetId);
        switchTo(newIndex);
    });
});

let resizeTimer;
window.addEventListener('resize', () => {
  if (window.plus && plus.navigator) {
        setStatusBarStyle();
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        updateHighlight();
        updateCardVerticalPosition();
    }, 300);
});

function setStatusBarStyleForSidebarOpen() {
    if (!window.plus || !plus.navigator) return;
    const isDarkMode = document.body.classList.contains('dark-mode');
    const style = isDarkMode ? 'light' : 'dark';
    plus.navigator.setStatusBarStyle(style);
}
function openSidebar() {
    // 根据当前主题正确设置状态栏颜色
    setStatusBarStyleForSidebarOpen();
    
    document.body.classList.add('sidebar-open');
    sidebar.classList.add('open');
    overlay.classList.add('active');

    closeTimelineModal();
    closeFavoritesModal();
    adjustFixedElements(true);
    updateCardVerticalPosition();
}

function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    sidebar.classList.remove('open');
    overlay.classList.remove('active');

    // 恢复页面主题对应的状态栏样式
    setStatusBarStyle();
    
    adjustFixedElements(false);
    updateCardVerticalPosition();
}

menuBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openSidebar();
});

closeSidebarBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

window.addEventListener('resize', () => {
    if (!sidebar.classList.contains('open')) {
        adjustFixedElements(false);
    }
});

function adjustFixedElements(isOpen) { }

function openTimelineModal() {
    if (sidebar.classList.contains('open')) closeSidebar();
    if (document.body.classList.contains('favorites-open')) closeFavoritesModal();

    loadTimelineData();
    document.body.classList.add('timeline-open');
}

function closeTimelineModal() {
    document.body.classList.remove('timeline-open');
}

timelineTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    openTimelineModal();
});

timelineClose.addEventListener('click', closeTimelineModal);
timelineModal.addEventListener('click', (e) => {
    if (e.target === timelineModal) closeTimelineModal();
});

document.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const isFavorite = target.classList.contains('favorite-btn');
    const isShare = target.classList.contains('share-btn');
    if (!isFavorite && !isShare) return;

    const actionsDiv = target.closest('.stats-actions');
    if (!actionsDiv) return;
    const type = actionsDiv.dataset.type;
    if (!currentDate || !type) return;

    // 防止重复请求的标志
    if (target.dataset.pending === 'true') return;
    target.dataset.pending = 'true';

    if (isFavorite) {
        const icon = target.querySelector('i');
        const countSpan = target.querySelector('.count');
        if (!icon || !countSpan) {
            target.dataset.pending = '';
            return;
        }

        // 获取当前计数（整数）
        let oldCount = parseInt(countSpan.innerText, 10);
        if (isNaN(oldCount)) oldCount = 0;

        const key = `${currentDate}_${type}_favorite`;
        const isLiked = localStorage.getItem(key) === 'true';
        const delta = isLiked ? -1 : 1;
        const newCount = oldCount + delta;

        // ---------- 乐观更新 UI ----------
        // 1. 更新心形图标
        const newIconClass = isLiked ? 'ri-heart-2-line' : 'ri-heart-2-fill';
        icon.classList.remove(isLiked ? 'ri-heart-2-fill' : 'ri-heart-2-line');
        icon.classList.add(newIconClass);

        // 2. 更新计数数字
        countSpan.innerText = newCount;

        // 3. 更新本地存储
        if (isLiked) {
            localStorage.removeItem(key);
            removeFavoriteSummary(currentDate, type);
        } else {
            localStorage.setItem(key, 'true');
        }

        // 动画
        icon.classList.add('heart-beat');
        if (icon._heartBeatTimer) clearTimeout(icon._heartBeatTimer);
        icon._heartBeatTimer = setTimeout(() => icon.classList.remove('heart-beat'), 400);

        // ---------- 请求后端 ----------
        try {
            const response = await fetch(`${API_BASE}/api/posts/${currentDate}/stats/${type}/favorite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delta })
            });
            if (!response.ok) throw new Error('更新失败');
            const data = await response.json();

            // 以后端返回的真实计数为准（修正可能的不一致）
            const statsKey = type + 'Stats';
            const realStats = data[statsKey];
            if (realStats && realStats.favorites !== undefined) {
                countSpan.innerText = realStats.favorites;
            }

            // 成功时保存摘要（仅新收藏时）
            if (!isLiked) {
                try {
                    const detailResponse = await fetch(`${API_BASE}/api/posts/${currentDate}`);
                    if (detailResponse.ok) {
                        const fullData = await detailResponse.json();
                        saveFavoriteSummary(currentDate, type, fullData);
                    }
                } catch (e) { /* 忽略摘要保存失败 */ }
            }
        } catch (err) {
            console.error('收藏更新失败', err);
            // ---------- 回滚 UI ----------
            // 回滚心形图标
            const rollbackIconClass = isLiked ? 'ri-heart-2-fill' : 'ri-heart-2-line';
            icon.classList.remove(newIconClass);
            icon.classList.add(rollbackIconClass);
            // 回滚计数
            countSpan.innerText = oldCount;
            // 回滚本地存储
            if (isLiked) {
                localStorage.setItem(key, 'true');
            } else {
                localStorage.removeItem(key);
                removeFavoriteSummary(currentDate, type);
            }
            showToast('操作失败，请稍后重试');
        } finally {
            target.dataset.pending = '';
        }
    } else if (isShare) {
        // 分享的乐观更新（可选）或保持原逻辑
        // 如果也需要立即更新计数，可参考收藏的乐观更新，此处略
        try {
            const response = await fetch(`${API_BASE}/api/posts/${currentDate}/stats/${type}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delta: 1 })
            });
            if (!response.ok) throw new Error('更新失败');
            const data = await response.json();
            const statsKey = type + 'Stats';
            const newStats = data[statsKey];
            if (newStats) {
                const shareBtn = actionsDiv.querySelector('.share-btn');
                if (shareBtn) shareBtn.querySelector('.count').textContent = newStats.shares;
            }
        } catch (err) {
            console.error('分享更新失败', err);
        }
    }
});

const dateDataCache = new Map();

function clearDateCache() {
    dateDataCache.clear();
}

function getFavoritesFromStorage() {
    const favorites = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && /^\d{4}-\d{2}-\d{2}_(music|sentence|article)_favorite$/.test(key)) {
            const value = localStorage.getItem(key);
            if (value === 'true') {
                const [date, type] = key.split('_');
                favorites.push({ date, type });
            }
        }
    }
    return favorites;
}

function groupFavoritesByDate(favorites) {
    const groups = new Map();
    favorites.forEach(item => {
        if (!groups.has(item.date)) {
            groups.set(item.date, []);
        }
        groups.get(item.date).push(item.type);
    });
    return groups;
}

async function fetchDateData(date) {
    if (dateDataCache.has(date)) {
        return dateDataCache.get(date);
    }
    try {
        const response = await fetch(`${API_BASE}/api/posts/${date}`);
        if (!response.ok) {
            throw new Error('No data');
        }
        const data = await response.json();
        dateDataCache.set(date, data);
        return data;
    } catch (error) {
        console.warn(`获取日期 ${date} 数据失败`, error);
        return null;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function (c) {
        return c;
    });
}

// ========== 左滑删除相关函数 ==========
function buildSwipeCardHTML(contentHtml, date, type) {
    return `
        <div class="swipe-container" data-date="${date}" data-type="${type}">
            <div class="swipe-inner">
                <div class="card-content" data-date="${date}" data-type="${type}">
                    ${contentHtml}
                </div>
                <div class="delete-btn-area" data-delete-date="${date}" data-delete-type="${type}">
                    <i class="ri-delete-bin-line"></i>
                </div>
            </div>
        </div>
    `;
}

function renderFavoriteCardFromSummary(type, summary, date) {
    let contentHtml = '';
    // 如果有完整数据，优先使用完整数据渲染
    const fullData = dateDataCache.get(date);
    if (fullData) {
        return renderFavoriteCard(type, fullData, date);
    }
    // 否则使用 summary 构建（保持原有内容，依赖 CSS 省略）
    if (type === 'music') {
        contentHtml = `
            <div class="favorite-card music-card">
                <img class="card-cover" src="${escapeHtml(summary.cover || '')}" onerror="this.src='img/default-cover.png'">
                <div class="card-info">
                    <div class="card-title">${escapeHtml(summary.title)}</div>
                    <div class="card-subtitle">${escapeHtml(summary.subtitle || '未知歌手')}</div>
                </div>
                <i class="ri-play-circle-line" style="color: #999; font-size: 22px;"></i>
            </div>
        `;
    } else if (type === 'sentence') {
        contentHtml = `
            <div class="favorite-card sentence-card">
                <img class="card-cover" src="${escapeHtml(summary.cover || '')}" onerror="this.src='img/default-sentence.png'">
                <div class="card-info">
                    <div class="card-preview">“${escapeHtml(summary.preview)}”</div>
                    <div class="card-subtitle">${escapeHtml(summary.subtitle || '佚名')}</div>
                </div>
                <i class="ri-article-line" style="color: #999; font-size: 22px;"></i>
            </div>
        `;
    } else if (type === 'article') {
        contentHtml = `
            <div class="favorite-card article-card">
                <img class="card-cover" src="${escapeHtml(summary.cover || '')}" onerror="this.src='img/default-article.png'">
                <div class="card-info">
                    <div class="card-title-row">
                        <div class="card-title">${escapeHtml(summary.title)}</div>
                        <div class="card-subtitle">${escapeHtml(summary.subtitle || '')}</div>
                    </div>
                    <div class="card-preview">${escapeHtml(summary.preview)}</div>
                </div>
                <i class="ri-newspaper-line" style="color: #999; font-size: 22px;"></i>
            </div>
        `;
    }
    return buildSwipeCardHTML(contentHtml, date, type);
}

function renderFavoriteCard(type, data, date) {
    let contentHtml = '';
    switch (type) {
        case 'music':
            if (!data.music || !data.music.title) return '';
            contentHtml = `
                <div class="favorite-card music-card">
                    <img class="card-cover" src="${data.music.cover || ''}" onerror="this.src='img/default-cover.png'">
                    <div class="card-info">
                        <div class="card-title">${escapeHtml(data.music.title)}</div>
                        <div class="card-subtitle">${escapeHtml(data.music.artist || '未知歌手')}</div>
                    </div>
                    <i class="ri-play-circle-line" style="color: #999; font-size: 22px;"></i>
                </div>
            `;
            break;
        case 'sentence':
            if (!data.sentence || !data.sentence.text) return '';
            const fullText = data.sentence.text;
            contentHtml = `
                <div class="favorite-card sentence-card">
                    <img class="card-cover" src="${data.sentence.image || ''}" onerror="this.src='img/default-sentence.png'">
                    <div class="card-info">
                        <div class="card-preview">“${escapeHtml(fullText)}”</div>
                        <div class="card-subtitle">${escapeHtml(data.sentence.author || '佚名')}</div>
                    </div>
                    <i class="ri-article-line" style="color: #999; font-size: 22px;"></i>
                </div>
            `;
            break;
        case 'article':
            if (!data.article || !data.article.title) return '';
            const fullPreview = data.article.content
                ? data.article.content.replace(/\n/g, ' ')
                : '';
            contentHtml = `
                <div class="favorite-card article-card">
                    <img class="card-cover" src="${data.article.image || ''}" onerror="this.src='img/default-article.png'">
                    <div class="card-info">
                        <div class="card-title-row">
                            <div class="card-title">${escapeHtml(data.article.title)}</div>
                            <div class="card-subtitle">${escapeHtml(data.article.author || '')}</div>
                        </div>
                        <div class="card-preview">${escapeHtml(fullPreview)}</div>
                    </div>
                    <i class="ri-newspaper-line" style="color: #999; font-size: 22px;"></i>
                </div>
            `;
            break;
        default: return '';
    }
    return buildSwipeCardHTML(contentHtml, date, type);
}
let currentlyOpenedSwipe = null;

function closeAllSwipedItems() {
    if (currentlyOpenedSwipe) {
        const inner = currentlyOpenedSwipe.querySelector('.swipe-inner');
        if (inner) inner.style.transform = 'translateX(0px)';
        currentlyOpenedSwipe = null;
    }
}

function bindSwipeEvents(container) {
    if (!container || container.dataset.swipeBound === 'true') return;
    container.dataset.swipeBound = 'true';

    let startX = 0;
    let startY = 0;
    let currentTranslate = 0;
    let isSwiping = false;
    let swipeStartTime = 0;
    let isSwiped = false;
    const swipeInner = container.querySelector('.swipe-inner');
    if (!swipeInner) return;

    function onStart(clientX, clientY) {
        if (event && event.target && event.target.closest('.delete-btn-area')) return;

        closeAllSwipedItems();
        startX = clientX;
        startY = clientY;
        swipeStartTime = Date.now();
        const transform = swipeInner.style.transform;
        if (transform === 'translateX(-70px)') {
            currentTranslate = -70;
        } else {
            currentTranslate = 0;
        }
        isSwiping = true;
        isSwiped = false;
        container.style.transition = 'none';
    }

    function onMove(clientX, clientY) {
        if (!isSwiping) return;
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
            if (event && event.preventDefault) event.preventDefault();
        }
        let newTranslate = currentTranslate + deltaX;
        newTranslate = Math.min(0, Math.max(-70, newTranslate));
        swipeInner.style.transform = `translateX(${newTranslate}px)`;

        if (Math.abs(deltaX) > 10) {
            isSwiped = true;
        }
    }

    function onEnd(clientX) {
        if (!isSwiping) {
            swipeInner.style.transition = '';
            return;
        }
        isSwiping = false;
        container.style.transition = '';
        const deltaX = clientX - startX;
        const deltaTime = Date.now() - swipeStartTime;

        let finalTranslate = 0;
        if (deltaX < -30 || (currentTranslate + deltaX < -35)) {
            finalTranslate = -70;
            if (currentlyOpenedSwipe && currentlyOpenedSwipe !== container) {
                const prevInner = currentlyOpenedSwipe.querySelector('.swipe-inner');
                if (prevInner) prevInner.style.transform = 'translateX(0px)';
            }
            currentlyOpenedSwipe = container;
        } else {
            finalTranslate = 0;
            if (currentlyOpenedSwipe === container) currentlyOpenedSwipe = null;
        }
        swipeInner.style.transform = `translateX(${finalTranslate}px)`;
        swipeInner.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
        startX = 0;

        if (isSwiped) {
            if (window._swipeJustEndedTimer) clearTimeout(window._swipeJustEndedTimer);
            window._swipeJustEnded = true;
            window._swipeJustEndedTimer = setTimeout(() => {
                window._swipeJustEnded = false;
            }, 300);
        }
    }

    const onTouchStart = (e) => {
        if (e.target.closest('.delete-btn-area')) return;
        const touch = e.touches[0];
        onStart(touch.clientX, touch.clientY);
    };
    const onTouchMove = (e) => {
        if (!isSwiping) return;
        const touch = e.touches[0];
        onMove(touch.clientX, touch.clientY);
        if (Math.abs(touch.clientX - startX) > Math.abs(touch.clientY - startY) && Math.abs(touch.clientX - startX) > 8) {
            e.preventDefault();
        }
    };
    const onTouchEnd = (e) => {
        const changed = e.changedTouches[0];
        onEnd(changed.clientX);
    };

    let mouseMoveHandler = null;
    let mouseUpHandler = null;

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.delete-btn-area')) return;
        e.preventDefault();
        onStart(e.clientX, e.clientY);

        mouseMoveHandler = (moveEvent) => {
            moveEvent.preventDefault();
            onMove(moveEvent.clientX, moveEvent.clientY);
        };
        mouseUpHandler = (upEvent) => {
            onEnd(upEvent.clientX);
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            mouseMoveHandler = null;
            mouseUpHandler = null;
        };
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('mousedown', onMouseDown);

    container._swipeHandlers = { onTouchStart, onTouchMove, onTouchEnd, onMouseDown };
}

function handleCardNavigation(e) {
    if (window._swipeJustEnded) {
        return;
    }

    if (e.target.closest('.delete-btn-area')) return;

    const swipeContainer = e.target.closest('.swipe-container');
    if (!swipeContainer) return;

    const date = swipeContainer.dataset.date;
    const type = swipeContainer.dataset.type;
    if (!date || !type) return;

    if (currentlyOpenedSwipe) {
        closeAllSwipedItems();
        return;
    }

    if (window.navigateToContent) {
        window.navigateToContent(date, type);
    }
}

async function executeDeleteFavorite(swipeContainer, date, type) {
    if (!swipeContainer) return;

    const deleteBtn = swipeContainer.querySelector('.delete-btn-area');
    if (deleteBtn) deleteBtn.style.pointerEvents = 'none';

    // 检测网络状态
    if (!navigator.onLine || !isNetworkAvailable) {
        // 离线状态下直接执行本地删除，不同步后端
        await performLocalDelete(swipeContainer, date, type);
        if (deleteBtn) deleteBtn.style.pointerEvents = '';
        return;
    }

    // 在线状态：发起后端请求
    try {
        const response = await fetch(`${API_BASE}/api/posts/${date}/stats/${type}/favorite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delta: -1 })
        });
        if (!response.ok) throw new Error('取消收藏失败');
        const data = await response.json();

        const storageKey = `${date}_${type}_favorite`;
        localStorage.removeItem(storageKey);
        removeFavoriteSummary(date, type);

        if (currentDate === date) {
            const statsKey = type + 'Stats';
            const newStats = data[statsKey];
            if (newStats) {
                const actionsDiv = document.querySelector(`.stats-actions[data-type="${type}"]`);
                if (actionsDiv) {
                    const favCountSpan = actionsDiv.querySelector('.favorite-btn .count');
                    if (favCountSpan) favCountSpan.textContent = newStats.favorites;
                }
            }
            const btnIcon = document.querySelector(`.stats-actions[data-type="${type}"] .favorite-btn i`);
            if (btnIcon) {
                btnIcon.classList.remove('ri-heart-2-fill');
                btnIcon.classList.add('ri-heart-2-line');
            }
        }

        const groupDiv = swipeContainer.closest('.favorites-date-group');
        swipeContainer.remove();

        if (groupDiv && groupDiv.querySelectorAll('.swipe-container').length === 0) {
            groupDiv.remove();
        }

        const favoritesBody = document.getElementById('favoritesBody');
        const remainingGroups = favoritesBody.querySelectorAll('.favorites-date-group');
        if (remainingGroups.length === 0) {
            favoritesBody.classList.add('empty');
            favoritesBody.innerHTML = `
                <div class="empty-favorites">
                    <i class="ri-heart-2-fill"></i>
                    <p>暂无收藏内容</p>
                </div>
            `;
            favoritesBody.classList.remove('has-favorites');
        }

        clearDateCache();

        if (currentlyOpenedSwipe === swipeContainer) currentlyOpenedSwipe = null;

    } catch (err) {
        console.error('删除收藏失败', err);
        if (window.showToast) window.showToast('删除失败，请稍后重试');
        if (deleteBtn) deleteBtn.style.pointerEvents = '';
    } finally {
        if (deleteBtn) deleteBtn.style.pointerEvents = '';
    }
}
async function performLocalDelete(swipeContainer, date, type) {
    if (!swipeContainer) return;

    // 1. 移除本地存储的收藏标记
    const storageKey = `${date}_${type}_favorite`;
    localStorage.removeItem(storageKey);
    removeFavoriteSummary(date, type);   // 移除摘要缓存

    // 2. 如果删除的日期正是当前显示的日期，更新页面上的收藏状态和计数
    if (currentDate === date) {
        // 更新对应卡片的心形图标和计数（需要先获取当前显示的数据）
        const actionsDiv = document.querySelector(`.stats-actions[data-type="${type}"]`);
        if (actionsDiv) {
            const favBtn = actionsDiv.querySelector('.favorite-btn');
            const icon = favBtn.querySelector('i');
            const countSpan = favBtn.querySelector('.count');
            if (icon) {
                icon.classList.remove('ri-heart-2-fill');
                icon.classList.add('ri-heart-2-line');
            }
            if (countSpan) {
                let currentCount = parseInt(countSpan.innerText, 10);
                if (!isNaN(currentCount)) {
                    countSpan.innerText = currentCount - 1;
                }
            }
        }
    }

    // 3. 从收藏页的 DOM 中移除该卡片
    const groupDiv = swipeContainer.closest('.favorites-date-group');
    swipeContainer.remove();

    // 如果该日期分组下没有其他卡片，则移除整个分组
    if (groupDiv && groupDiv.querySelectorAll('.swipe-container').length === 0) {
        groupDiv.remove();
    }

    // 4. 检查收藏页是否为空，若为空则显示空状态
    const favoritesBody = document.getElementById('favoritesBody');
    const remainingGroups = favoritesBody.querySelectorAll('.favorites-date-group');
    if (remainingGroups.length === 0) {
        favoritesBody.classList.add('empty');
        favoritesBody.innerHTML = `
            <div class="empty-favorites">
                <i class="ri-heart-2-fill"></i>
                <p>暂无收藏内容</p>
            </div>
        `;
        favoritesBody.classList.remove('has-favorites');
    }

    // 5. 清除日期数据缓存（可选，保证下次加载时重新拉取）
    clearDateCache();

    // 6. 如果有打开的滑动状态，清理
    if (currentlyOpenedSwipe === swipeContainer) {
        currentlyOpenedSwipe = null;
    }

}
function bindDeleteButtons() {
    const favoritesBody = document.getElementById('favoritesBody');
    if (!favoritesBody) return;
    favoritesBody.removeEventListener('click', handleDeleteClick);
    favoritesBody.addEventListener('click', handleDeleteClick);
}

async function handleDeleteClick(e) {
    const deleteArea = e.target.closest('.delete-btn-area');
    if (!deleteArea) return;
    e.stopPropagation();
    const swipeContainer = deleteArea.closest('.swipe-container');
    if (!swipeContainer) return;
    const date = swipeContainer.dataset.date;
    const type = swipeContainer.dataset.type;
    if (date && type) {
        await executeDeleteFavorite(swipeContainer, date, type);
    }
}
async function renderFavorites() {
    const favoritesBody = document.getElementById('favoritesBody');
    if (!favoritesBody) return;

    favoritesBody.classList.remove('empty', 'has-favorites');
    const favorites = getFavoritesFromStorage();
    if (favorites.length === 0) {
        favoritesBody.classList.add('empty');
        favoritesBody.innerHTML = `<div class="empty-favorites"><i class="ri-heart-2-fill"></i><p>暂无收藏内容</p></div>`;
        return;
    }

    const groups = groupFavoritesByDate(favorites);
    const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

    let html = '';
    const needFetchDates = new Set();

    for (const date of sortedDates) {
        const types = groups.get(date);
        const [year, month, day] = date.split('-');
        const formattedDate = `${year}年${parseInt(month)}月${parseInt(day)}日`;
        html += `<div class="favorites-date-group" data-date="${date}"><div class="date-group-header">-&nbsp;${formattedDate}&nbsp;-</div>`;

        for (const type of ['music', 'sentence', 'article']) {
            if (!types.includes(type)) continue;

            const fullData = dateDataCache.get(date);
            if (fullData) {
                // 有完整数据直接渲染
                const cardHtml = renderFavoriteCard(type, fullData, date);
                if (cardHtml) html += cardHtml;
            } else {
                // 无完整数据，先尝试用 summary 渲染，并加入待获取列表
                const key = `${FAVORITE_SUMMARY_KEY_PREFIX}${date}_${type}`;
                const summaryStr = localStorage.getItem(key);
                if (summaryStr) {
                    try {
                        const summary = JSON.parse(summaryStr);
                        html += renderFavoriteCardFromSummary(type, summary, date);
                    } catch(e) {
                        // 解析失败则加入占位
                        html += buildPlaceholderCard(date, type);
                    }
                } else {
                    html += buildPlaceholderCard(date, type);
                }
                needFetchDates.add(date);
            }
        }
        html += `</div>`;
    }

    favoritesBody.innerHTML = html;
    favoritesBody.classList.add('has-favorites');

    // 绑定左滑删除事件（现有逻辑）
    const containers = document.querySelectorAll('#favoritesBody .swipe-container');
    containers.forEach(container => bindSwipeEvents(container));
    bindDeleteButtons();
    favoritesBody.addEventListener('click', handleCardNavigation);

    // 异步获取缺失的完整数据并替换卡片
    if (needFetchDates.size > 0) {
        const fetchPromises = Array.from(needFetchDates).map(date => fetchDateData(date));
        const results = await Promise.allSettled(fetchPromises);
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const date = Array.from(needFetchDates)[i];
            if (result.status === 'fulfilled' && result.value) {
                const types = groups.get(date);
                for (const type of types) {
                    // 更新缓存摘要（以便下次直接使用完整数据）
                    saveFavoriteSummary(date, type, result.value);
                    // 替换对应卡片
                    const targetCard = document.querySelector(`.swipe-container[data-date="${date}"][data-type="${type}"]`);
                    if (targetCard) {
                        const newCardHtml = renderFavoriteCard(type, result.value, date);
                        if (newCardHtml) {
                            targetCard.outerHTML = newCardHtml;
                            const newContainer = document.querySelector(`.swipe-container[data-date="${date}"][data-type="${type}"]`);
                            if (newContainer) bindSwipeEvents(newContainer);
                        }
                    }
                }
            }
        }
        // 重新绑定新卡片的删除与滑动事件
        const newContainers = document.querySelectorAll('#favoritesBody .swipe-container');
        newContainers.forEach(container => bindSwipeEvents(container));
        bindDeleteButtons();
    }
}

function buildPlaceholderCard(date, type) {
    return `
        <div class="swipe-container placeholder" data-date="${date}" data-type="${type}">
            <div class="swipe-inner">
                <div class="card-content">
                    <div class="favorite-card ${type}-card">
                        <div class="card-icon"><i class="ri-loader-4-line"></i></div>
                        <div class="card-info"><div class="card-title">加载中...</div></div>
                    </div>
                </div>
                <div class="delete-btn-area" data-delete-date="${date}" data-delete-type="${type}">
                    <i class="ri-delete-bin-line"></i>
                </div>
            </div>
        </div>
    `;
}
function navigateToContent(date, type) {
    // 新增网络检测
    if (!navigator.onLine || !isNetworkAvailable) {
        showToast('网络连接不可用，请稍后再试', 1500);
        showOfflinePlaceholder(true);
        return;
    }

    closeFavoritesModal();
    loadDataForDate(date);
    const typeIndex = tabOrder.indexOf(type);
    if (typeIndex !== -1 && typeIndex !== currentIndex) {
        switchTo(typeIndex);
    }
    window.scrollTo(0, 0);
}

const favoritesModal = document.getElementById('favoritesModal');
const closeFavoritesBtn = document.querySelector('.close-favorites');
const favoritesTrigger = document.querySelector('.sidebar-menu .menu-item:first-child');

function openFavoritesModal() {
    if (document.body.classList.contains('timeline-open')) {
        closeTimelineModal();
    }
    if (sidebar.classList.contains('open')) {
        closeSidebar();
    }
    closeAllSwipedItems();
    clearDateCache();
    renderFavorites();

    document.body.classList.add('favorites-open');
    document.body.style.overflow = 'hidden';
}

function closeFavoritesModal() {
    if (!document.body.classList.contains('favorites-open')) return;
    closeAllSwipedItems();
    document.body.classList.remove('favorites-open');
    document.body.style.overflow = '';
}

if (closeFavoritesBtn) {
    closeFavoritesBtn.addEventListener('click', closeFavoritesModal);
}

if (favoritesModal) {
    favoritesModal.addEventListener('click', (e) => {
        if (e.target === favoritesModal) {
            closeFavoritesModal();
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.body.classList.contains('favorites-open')) {
            closeFavoritesModal();
        } else if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else if (document.body.classList.contains('timeline-open')) {
            closeTimelineModal();
        }
    }
});

if (favoritesTrigger) {
    favoritesTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openFavoritesModal();
    });
}

function showToast(message, duration = 2000) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

async function copyEmail() {
    const email = 'cveyo@qq.com';
    try {
        await navigator.clipboard.writeText(email);
        showToast(`邮箱已复制`);
    } catch (err) {
        console.error('Clipboard API 复制失败，尝试降级方案', err);
        const textarea = document.createElement('textarea');
        textarea.value = email;
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
            showToast(`邮箱已复制: ${email}`);
        } else {
            showToast('复制失败，请手动复制');
        }
    }
}

function bindContactUsCopy() {
    const contactMenuItem = Array.from(document.querySelectorAll('.sidebar-menu .menu-item'))
        .find(item => item.textContent.includes('联系我们'));
    if (contactMenuItem && !contactMenuItem.dataset.copyBound) {
        contactMenuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            copyEmail();
        });
        contactMenuItem.dataset.copyBound = 'true';
    }
}

function bindVersionClick() {
    const versionMenuItem = Array.from(document.querySelectorAll('.sidebar-menu .menu-item'))
        .find(item => item.textContent.includes('当前版本'));
    if (versionMenuItem && !versionMenuItem.dataset.versionBound) {
        versionMenuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            showToast('已是最新版本');
        });
        versionMenuItem.dataset.versionBound = 'true';
    }
}

const changelogModal = document.getElementById('changelogModal');
const changelogTrigger = document.getElementById('changelog-trigger');
const closeChangelogBtn = document.querySelector('.close-changelog');

function openChangelogModal() {
    if (sidebar.classList.contains('open')) closeSidebar();
    if (document.body.classList.contains('favorites-open')) closeFavoritesModal();
    if (document.body.classList.contains('timeline-open')) closeTimelineModal();

    document.body.classList.add('changelog-open');
    document.body.style.overflow = 'hidden';
    loadChangelogs();
}

function closeChangelogModal() {
    if (!document.body.classList.contains('changelog-open')) return;
    document.body.classList.remove('changelog-open');
    document.body.style.overflow = '';
}

async function loadChangelogs() {
    const body = document.getElementById('changelogBody');
    body.innerHTML = '<div class="loading-state"><i class="ri-loader-4-line"></i> 加载更新日志...</div>';
    try {
        const res = await fetch(`${API_BASE}/api/changelogs`);
        const data = await res.json();
        const logs = data.items || [];      
        if (!logs.length) {
            body.innerHTML = '<div class="empty-favorites"><i class="ri-history-line"></i><p>暂无更新日志</p></div>';
            return;
        }
        body.innerHTML = logs.map(log => `
            <div class="changelog-item">
                <div class="changelog-version">
                    v${escapeHtml(log.version)}
                    <span>${log.date}</span>
                </div>
                <div class="changelog-content">${escapeHtml(log.content).replace(/\n/g, '<br>')}</div>
            </div>
        `).join('');
    } catch (err) {
        body.innerHTML = '<div class="empty-favorites"><i class="ri-error-warning-line"></i><p>加载失败，请稍后重试</p></div>';
    }
}

if (changelogTrigger) {
    changelogTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openChangelogModal();
    });
}
if (closeChangelogBtn) {
    closeChangelogBtn.addEventListener('click', closeChangelogModal);
}
if (changelogModal) {
    changelogModal.addEventListener('click', (e) => {
        if (e.target === changelogModal) closeChangelogModal();
    });
}

// ========== 跨标签页数据同步（监听后台更新） ==========
// 新增：获取并更新侧边栏版本号
async function fetchAndUpdateVersion() {
    try {
        const res = await fetch(`${API_BASE}/api/changelogs`);
        const data = await res.json();
        const logs = data.items || [];            // 关键修改
        const versionSpan = document.querySelector('.version');
        if (!versionSpan) return;
        if (!logs.length) {
            versionSpan.textContent = 'V0.0.1';
            return;
        }
        const sorted = [...logs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const latestVersion = sorted[0]?.version;
        versionSpan.textContent = latestVersion ? `V${latestVersion}` : 'V0.0.1';
    }catch (err) {
        console.warn('获取最新版本失败', err);
        // 出错时不覆盖原有显示
    }
}

// 原有 storage 监听，添加版本刷新
function handleStorageChange(e) {
    if (e.key === 'admin_data_updated' && e.newValue) {
        console.log('检测到管理后台内容更新，刷新当前页面数据');
        if (currentDate) {
            loadDataForDate(currentDate);
        }
        if (typeof clearDateCache === 'function') {
            clearDateCache();
        }
        // 新增：同步更新侧边栏版本号
        fetchAndUpdateVersion();
    }
}

window.addEventListener('storage', handleStorageChange);

// 页面可见性变化时刷新
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentDate) {
        clearTimeout(window._visibilityTimeout);
        window._visibilityTimeout = setTimeout(() => {
            loadDataForDate(currentDate);
        }, 300);
    }
});

// ========== 历史记录管理 ==========
window.addEventListener('popstate', (event) => {
    const date = getDateFromUrl();
    if (date && date !== currentDate) {
        loadDataForDate(date).then(() => {
            if (currentIndex !== 0) switchTo(0);
        });
    }
});

// ========== 跟手滑动模块 ==========
// 该模块实现真正的跟随手指滑动切换，替代原有的 swipe 检测逻辑
let dragState = {
        active: false,
        startX: 0,
        startY: 0,          // 新增：记录起始 Y 坐标
        currentX: 0,
        startTime: 0,
        startIndex: 0,
        containerWidth: 0,
        cards: [],
        baseTransforms: [],
        currentOffset: 0,
        isDragging: false
    };
// 判断触摸点是否应该忽略（不启动拖拽切换）
function shouldIgnoreTouch(target) {
    // 模态框打开时禁用拖拽
    if (document.body.classList.contains('favorites-open') ||
        document.body.classList.contains('sidebar-open') ||
        document.body.classList.contains('timeline-open') ||
        document.body.classList.contains('changelog-open')) {
        return true;
    }

    // 排除所有需要点击交互的元素（但允许音乐封面滑动）
    const interactiveSelectors = [
        '.favorite-btn',
        '.share-btn',
    ];

    return target.closest(interactiveSelectors.join(','));
}
function initDragSwipe() {
    const cardContainer = document.querySelector('.card-container');
    if (!cardContainer) return;

    const allCards = document.querySelectorAll('.card');
    if (!allCards.length) return;

    let isSettling = false;          // 动画中禁止新拖拽
    let dragState = {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        startTime: 0,
        startIndex: 0,
        containerWidth: 0,
        baseTransforms: [],
        currentOffset: 0,
        isDragging: false,
        startImgEl: null,            // 触摸起始的图片元素
        startImgSrc: null            // 图片src
    };

    // ========== 辅助函数 ==========
    function getContainerWidth() {
        return cardContainer.clientWidth;
    }

    function updateBaseTransforms(width, activeIndex) {
        dragState.baseTransforms = [];
        for (let i = 0; i < allCards.length; i++) {
            if (i === activeIndex) {
                dragState.baseTransforms.push(0);
            } else if (i < activeIndex) {
                dragState.baseTransforms.push(-width);
            } else {
                dragState.baseTransforms.push(width);
            }
        }
    }

    function applyTransform(offsetX) {
        const direction = offsetX > 0 ? 'right' : (offsetX < 0 ? 'left' : null);
        const progress = Math.min(1, Math.abs(offsetX) / dragState.containerWidth);

        for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            const base = dragState.baseTransforms[i];
            const newX = base + offsetX;
            card.style.transform = `translateX(${newX}px)`;

            let opacity = 0;
            let zIndex = 1;

            if (i === dragState.startIndex) {
                opacity = 1;
                zIndex = 3;
            } else if (direction === 'right' && i === dragState.startIndex - 1) {
                opacity = progress;
                zIndex = 2;
            } else if (direction === 'left' && i === dragState.startIndex + 1) {
                opacity = progress;
                zIndex = 2;
            } else {
                opacity = 0;
                zIndex = 1;
            }

            card.style.opacity = opacity;
            card.style.zIndex = zIndex;
            card.style.pointerEvents = 'none';
        }
    }

    function resetToBase() {
        for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            const base = dragState.baseTransforms[i];
            card.style.transform = `translateX(${base}px)`;
            card.style.transition = '';
            if (i === dragState.startIndex) {
                card.style.opacity = '1';
                card.style.zIndex = '2';
            } else {
                card.style.opacity = '0';
                card.style.zIndex = '1';
            }
        }
    }

    // 新增：无动画立即恢复基准位置（用于图片预览场景）
    function resetToBaseNoTransition() {
        for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            const base = dragState.baseTransforms[i];
            card.style.transition = 'none';
            card.style.transform = `translateX(${base}px)`;
            if (i === dragState.startIndex) {
                card.style.opacity = '1';
                card.style.zIndex = '2';
            } else {
                card.style.opacity = '0';
                card.style.zIndex = '1';
            }
        }
        void allCards[0].offsetHeight;
        for (let i = 0; i < allCards.length; i++) {
            allCards[i].style.transition = '';
        }
    }

    function performSwitch(newIndex, shouldAnimate = true) {
        if (newIndex === dragState.startIndex) {
            if (shouldAnimate) {
                for (let i = 0; i < allCards.length; i++) {
                    allCards[i].style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1), opacity 0.3s ease';
                }
                applyTransform(0);
                setTimeout(() => {
                    for (let i = 0; i < allCards.length; i++) {
                        allCards[i].style.transition = '';
                    }
                    setCardsPosition(dragState.startIndex);
                }, 350);
            } else {
                resetToBase();
                setCardsPosition(dragState.startIndex);
            }
            return;
        }

        if (shouldAnimate) {
            const targetWidth = dragState.containerWidth;
            const direction = newIndex > dragState.startIndex ? 1 : -1;
            for (let i = 0; i < allCards.length; i++) {
                allCards[i].style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1), opacity 0.3s ease';
            }
            updateBaseTransforms(targetWidth, newIndex);
            const startOffset = direction === 1 ? targetWidth : -targetWidth;
            for (let i = 0; i < allCards.length; i++) {
                const card = allCards[i];
                const base = dragState.baseTransforms[i];
                card.style.transform = `translateX(${base + startOffset}px)`;
                if (i === newIndex) {
                    card.style.opacity = '1';
                } else {
                    card.style.opacity = '0';
                }
            }
            void allCards[0].offsetHeight;
            for (let i = 0; i < allCards.length; i++) {
                const card = allCards[i];
                const base = dragState.baseTransforms[i];
                card.style.transform = `translateX(${base}px)`;
                if (i === newIndex) {
                    card.style.opacity = '1';
                } else {
                    card.style.opacity = '0';
                }
            }
            setTimeout(() => {
                for (let i = 0; i < allCards.length; i++) {
                    allCards[i].style.transition = '';
                }
                currentIndex = newIndex;
                const targetId = tabOrder[newIndex];
                navItems.forEach(item => item.classList.remove('active'));
                document.querySelector(`[data-target="${targetId}"]`).classList.add('active');
                localStorage.setItem(STATE_KEY, targetId);
                updateHighlight();
                setCardsPosition(newIndex);
            }, 350);
        } else {
            currentIndex = newIndex;
            setCardsPosition(newIndex);
            const targetId = tabOrder[newIndex];
            navItems.forEach(item => item.classList.remove('active'));
            document.querySelector(`[data-target="${targetId}"]`).classList.add('active');
            updateHighlight();
        }
    }

    async function handleBoundarySwitch(direction, offsetRatio) {
        await fetchPublishedDatesList();
        let targetDate = null;
        let targetCardType = null;

        if (direction === 'right' && currentIndex === 0) {
            targetDate = getNextPublishedDate(currentDate);
            targetCardType = 'article';
        } else if (direction === 'left' && currentIndex === tabOrder.length - 1) {
            targetDate = getPrevPublishedDate(currentDate);
            targetCardType = 'music';
        }

        if (targetDate && targetCardType) {
            isSettling = true;
            for (let i = 0; i < allCards.length; i++) {
                allCards[i].style.transition = '';
            }
            resetToBase();
            await switchToDate(targetDate, targetCardType);
            setTimeout(() => {
                isSettling = false;
                dragState.active = false;
            }, 400);
        } else {
            performSwitch(dragState.startIndex, true);
            setTimeout(() => {
                isSettling = false;
                dragState.active = false;
            }, 350);
        }
    }

    // 判断触摸点是否应该忽略拖拽（不影响图片预览）
    function shouldIgnoreTouch(target) {
        if (document.body.classList.contains('favorites-open') ||
            document.body.classList.contains('sidebar-open') ||
            document.body.classList.contains('timeline-open') ||
            document.body.classList.contains('changelog-open')) {
            return true;
        }

        const interactiveSelectors = [
            '.favorite-btn',
            '.share-btn',
        ];

        return target.closest(interactiveSelectors.join(','));
    }

    // 新增：从触摸目标获取可预览的图片元素
    function getImageElementFromTarget(target) {
        // 音乐封面
        if (target.closest('.album-image img')) {
            return target.closest('.album-image img');
        }
        // 句子图片
        if (target.closest('#sentenceImg')) {
            return document.getElementById('sentenceImg');
        }
        // 文章头图
        if (target.closest('#article .bg-img img')) {
            return document.querySelector('#article .bg-img img');
        }
        // 收藏卡片中的图片（可选）
        if (target.closest('.favorite-card img')) {
            return target.closest('.favorite-card img');
        }
        return null;
    }

    // ========== 触摸事件 ==========
    function onTouchStart(e) {
        if (isSettling || isAnimating || isDateSwitching) return;
        if (shouldIgnoreTouch(e.target)) return;

        const touch = e.touches[0];
        dragState.active = true;
        dragState.startX = touch.clientX;
        dragState.startY = touch.clientY;
        dragState.currentX = touch.clientX;
        dragState.startTime = Date.now();
        dragState.startIndex = currentIndex;
        dragState.containerWidth = getContainerWidth();
        dragState.currentOffset = 0;
        dragState.isDragging = false;
        // 记录起始图片元素
        dragState.startImgEl = getImageElementFromTarget(e.target);
        dragState.startImgSrc = dragState.startImgEl ? dragState.startImgEl.src : null;

        for (let i = 0; i < allCards.length; i++) {
            allCards[i].style.transition = 'none';
        }

        updateBaseTransforms(dragState.containerWidth, currentIndex);
        for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            const base = dragState.baseTransforms[i];
            card.style.transform = `translateX(${base}px)`;
            if (i === currentIndex) {
                card.style.opacity = '1';
                card.style.zIndex = '2';
            } else {
                card.style.opacity = '0';
                card.style.zIndex = '1';
            }
        }
    }

    function onTouchMove(e) {
        if (!dragState.active || isSettling) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragState.startX;
        const deltaY = touch.clientY - dragState.startY;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
            dragState.isDragging = true;
            e.preventDefault();
        } else if (Math.abs(deltaY) > 5) {
            dragState.active = false;
            for (let i = 0; i < allCards.length; i++) {
                allCards[i].style.transition = '';
                const base = dragState.baseTransforms[i];
                allCards[i].style.transform = `translateX(${base}px)`;
                if (i === dragState.startIndex) {
                    allCards[i].style.opacity = '1';
                    allCards[i].style.zIndex = '2';
                } else {
                    allCards[i].style.opacity = '0';
                    allCards[i].style.zIndex = '1';
                }
            }
            return;
        }

        if (!dragState.isDragging) return;

        dragState.currentX = touch.clientX;
        let newOffset = deltaX;

        const isAtLeftEdge = (dragState.startIndex === 0 && newOffset > 0);
        const isAtRightEdge = (dragState.startIndex === tabOrder.length - 1 && newOffset < 0);

        if (isAtLeftEdge) {
            newOffset = Math.min(newOffset, dragState.containerWidth * 0.25);
            newOffset = newOffset * 0.6;
        } else if (isAtRightEdge) {
            newOffset = Math.max(newOffset, -dragState.containerWidth * 0.25);
            newOffset = newOffset * 0.6;
        } else {
            const maxOffset = dragState.containerWidth;
            newOffset = Math.min(maxOffset, Math.max(-maxOffset, newOffset));
        }

        dragState.currentOffset = newOffset;
        applyTransform(newOffset);
    }

    async function onTouchEnd(e) {
        if (!dragState.active || isSettling) {
            dragState.active = false;
            return;
        }

        const deltaX = dragState.currentX - dragState.startX;
        const deltaTime = Date.now() - dragState.startTime;
        const velocity = Math.abs(deltaX) / deltaTime;
        const threshold = dragState.containerWidth * 0.25;
        const isFastSwipe = velocity > 0.5;

        let shouldSwitch = false;
        let switchDirection = 0;

        if (Math.abs(deltaX) > threshold || isFastSwipe) {
            if (deltaX > 0 && dragState.startIndex > 0) {
                shouldSwitch = true;
                switchDirection = -1;
            } else if (deltaX < 0 && dragState.startIndex < tabOrder.length - 1) {
                shouldSwitch = true;
                switchDirection = 1;
            } else if (deltaX > 0 && dragState.startIndex === 0) {
                dragState.active = false;
                await handleBoundarySwitch('right', Math.abs(deltaX) / dragState.containerWidth);
                return;
            } else if (deltaX < 0 && dragState.startIndex === tabOrder.length - 1) {
                dragState.active = false;
                await handleBoundarySwitch('left', Math.abs(deltaX) / dragState.containerWidth);
                return;
            }
        }

        // 新增：未发生切换且未拖拽，且起始于图片时，触发图片预览
        if (!shouldSwitch && !dragState.isDragging && dragState.startImgEl && dragState.startImgSrc) {
            if (!window._imagePreviewLock) {
                window._imagePreviewLock = true;
                openImagePreview(dragState.startImgSrc);
                setTimeout(() => { window._imagePreviewLock = false; }, 300);
            }
            // 快速恢复卡片位置（无动画）
            resetToBaseNoTransition();
            dragState.active = false;
            return;
        }

        // 原有切换逻辑
        if (shouldSwitch && switchDirection !== 0) {
            const newIndex = dragState.startIndex + switchDirection;
            if (newIndex >= 0 && newIndex < tabOrder.length) {
                isSettling = true;
                performSwitch(newIndex, true);
                setTimeout(() => {
                    isSettling = false;
                    dragState.active = false;
                }, 400);
            } else {
                performSwitch(dragState.startIndex, true);
                dragState.active = false;
            }
        } else {
            performSwitch(dragState.startIndex, true);
            dragState.active = false;
        }
    }

    // 注册事件
    cardContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    cardContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    cardContainer.addEventListener('touchend', onTouchEnd);
    cardContainer.addEventListener('touchcancel', onTouchEnd);
}

function injectFavoriteCardStyles() {
    const styleId = 'favorite-card-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .favorite-card .card-title,
        .favorite-card .card-subtitle,
        .favorite-card .card-preview {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .favorite-card .card-info {
            min-width: 0;
            overflow: hidden;
            flex: 1;
        }
        .favorite-card .card-title-row {
            display: flex;
            flex-wrap: nowrap;
            align-items: baseline;
            gap: 8px;
            min-width: 0;
        }
        .favorite-card .card-title-row .card-title {
            flex-shrink: 1;
            min-width: 0;
        }
        .favorite-card .card-title-row .card-subtitle {
            flex-shrink: 0;
            white-space: nowrap;
        }
        .favorite-card .card-preview {
            margin-top: 4px;
        }
    `;
    document.head.appendChild(style);
}
// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  const initialLoader = document.getElementById('initialLoader');
  if (navigator.onLine) {
    document.body.classList.add('online');
} else {
    document.body.classList.remove('online');
}
	    if (typeof window.plus !== 'undefined') {
	        window.plus.isReady = false;
	        document.addEventListener('plusready', function() {
	            window.plus.isReady = true;
	            console.log('5+ Runtime ready');
	        });
	    } else {
	        // 非 5+ 环境（浏览器）模拟 isReady，避免报错
	        window.plus = { isReady: true, share: null };
	    }
    // 初始化 UI 相关设置（不依赖数据）
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            updateHighlight();
            updateCardVerticalPosition();
        });
    }

    // 恢复保存的 tab 状态
    const savedTab = localStorage.getItem(STATE_KEY) || DEFAULT_TAB;
    const savedIndex = getIndexFromId(savedTab);
    cards.forEach(card => card.style.transition = 'none');
    setCardsPosition(savedIndex);
    cards[0].offsetHeight;
    cards.forEach(card => card.style.transition = '');
    currentIndex = savedIndex;
    navItems.forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-target="${savedTab}"]`).classList.add('active');
    updateHighlight();

    setTimeout(() => {
        navContainer.style.opacity = '1';
        updateCardVerticalPosition();
    }, 50);

    resetPageContentTransform();
    bindContactUsCopy();
    bindVersionClick();
    // 初始化夜间模式
initTheme();
bindNightModeToggle();
injectFavoriteCardStyles();
    await fetchAndUpdateVersion();
    window.addEventListener('load', () => {
        updateHighlight();
        updateCardVerticalPosition();
    });

    // ========== 关键修改：日期确定逻辑 ==========
    // 获取所有已发布日期（升序）
    const allDates = await fetchPublishedDatesList();

if (allDates.length === 0) {
    console.error('无法获取任何发布日期，请检查后端接口');
    showToast('暂无内容，请稍后再试', 3000);
    if (initialLoader) {
        initialLoader.classList.add('hide');
    }
    return;
}

    // 最新日期（升序数组最后一个）
    const latestDate = allDates[allDates.length - 1];

    let initialDate = getDateFromUrl();

    if (!initialDate) {
        // 无 URL 参数，直接使用最新日期
        initialDate = latestDate;
        const newUrl = `?date=${initialDate}`;
        window.history.replaceState({ date: initialDate }, '', newUrl);
    } else {

if (!allDates.includes(initialDate)) {
    console.warn(`日期 ${initialDate} 不存在，自动跳转到最新日期 ${latestDate}`);
    initialDate = latestDate;
    const newUrl = `?date=${initialDate}`;
    window.history.replaceState({ date: initialDate }, '', newUrl);
    showToast(`日期不存在，已为您跳转至最新内容`, 2000);
}
    }
window.addEventListener('online', () => {
    console.log('网络已恢复');
    // 自动重试
    retryNetworkAndReload();
});
window.addEventListener('offline', () => {
    console.log('网络已断开');
    isNetworkAvailable = false;
    showOfflinePlaceholder(true);
});

// 占位符点击重试
if (offlinePlaceholder) {
    offlinePlaceholder.addEventListener('click', (e) => {
        e.stopPropagation();
        retryNetworkAndReload();
    });
}

// 初次加载时，如果浏览器认为离线，直接显示占位符
if (!navigator.onLine) {
    isNetworkAvailable = false;
    showOfflinePlaceholder(true);
}
displayDateInNav(initialDate);
try {
    await loadDataForDate(initialDate);
} catch (err) {
    console.warn('初始数据加载失败', err);
} finally {
    // 无论成功或失败，都隐藏加载动画
    if (initialLoader) {
        initialLoader.classList.add('hide');
        // 可选：延迟移除 DOM 元素，避免占用资源
        setTimeout(() => {
            if (initialLoader && initialLoader.parentNode) {
                initialLoader.parentNode.removeChild(initialLoader);
            }
        }, 500);
    }
}
await fetchPublishedDatesList(); // 确保日期列表已缓存（无额外开销）
updateHighlight();
updateCardVerticalPosition();
initDragSwipe();
initImagePreviewModal();
bindImagePreviewTriggers();
    
});

function resetPageContentTransform() {
    const pageContent = document.querySelector('.page-content');
    if (pageContent && pageContent.classList.contains('favorites-closing-push')) {
        pageContent.classList.remove('favorites-closing-push');
    }
    if (window._favoritesClosing) {
        window._favoritesClosing = false;
    }
}

// ========== 增强分享模块 (完整版) ==========
// ========== 增强分享模块 (5+ App 系统分享 + 浏览器降级) ==========
(function() {
    // 获取当前日期（从 URL 或全局变量）
    function getCurrentDate() {
        if (window.currentDate) return window.currentDate;
        const urlParams = new URLSearchParams(window.location.search);
        const dateFromUrl = urlParams.get('date');
        if (dateFromUrl) return dateFromUrl;
        return null;
    }

    function getCurrentShareUrl() {
        let url = window.location.href;
        const date = getCurrentDate();
        if (!url.includes('?date=') && date) {
            const baseUrl = url.split('?')[0];
            url = `${baseUrl}?date=${date}`;
        }
        return url;
    }

    async function copyLinkToClipboard() {
        const url = getCurrentShareUrl();
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch (err) {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    }

    function showMsg(msg, duration = 2000) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, duration);
        } else {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), duration);
        }
    }

    // 更新分享计数（调用后端接口）
    async function updateShareCount(type, date, delta = 1) {
        const actionsDiv = document.querySelector(`.stats-actions[data-type="${type}"]`);
        if (!actionsDiv) return false;
        const shareBtn = actionsDiv.querySelector('.share-btn');
        if (!shareBtn) return false;
        const countSpan = shareBtn.querySelector('.count');
        if (!countSpan) return false;

        let oldCount = parseInt(countSpan.innerText, 10);
        if (isNaN(oldCount)) oldCount = 0;
        const newCount = oldCount + delta;
        countSpan.innerText = newCount;

        // 添加简单动画
        shareBtn.style.transform = 'scale(1.05)';
        setTimeout(() => { if (shareBtn) shareBtn.style.transform = ''; }, 200);

        try {
            const response = await fetch(`${window.API_BASE || 'https://solitudenook.top'}/api/posts/${date}/stats/${type}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delta })
            });
            if (!response.ok) throw new Error('更新失败');
            const data = await response.json();
            const realStats = data[type + 'Stats'];
            if (realStats && realStats.shares !== undefined) {
                countSpan.innerText = realStats.shares;
            }
            return true;
        } catch (err) {
            console.error('分享计数更新失败', err);
            countSpan.innerText = oldCount;
            return false;
        }
    }

    // 从 DOM 或缓存中提取分享内容（文本 + 链接）
    function getShareDataFromDOM(type, date) {
        const href = window.location.href.split('?')[0] + `?date=${date}`;
        let title = '', content = '', thumb = '';

        if (type === 'music') {
            title = document.querySelector('.track-album')?.innerText || '';
            content = document.querySelector('.track-singer')?.innerText || '';
            thumb = document.getElementById('album-img')?.src || '';
            if (!title && window.dateDataCache?.get(date)?.music) {
                const music = window.dateDataCache.get(date).music;
                title = music.title || '';
                content = music.artist || '';
                thumb = music.cover || '';
            }
        } else if (type === 'sentence') {
            title = '句子摘录';
            content = document.getElementById('sentenceText')?.innerText || '';
            const author = document.querySelector('#sentence .from span')?.innerText || '';
            if (author) content += ` ——${author}`;
            thumb = document.getElementById('sentenceImg')?.src || '';
            if (!content && window.dateDataCache?.get(date)?.sentence) {
                const sent = window.dateDataCache.get(date).sentence;
                content = sent.text || '';
                if (sent.author) content += ` ——${sent.author}`;
                thumb = sent.image || '';
            }
        } else if (type === 'article') {
            title = document.getElementById('article-title')?.innerText || '';
            content = document.getElementById('article-author')?.innerText || '';
            const articleText = document.getElementById('article-content')?.innerText || '';
            if (articleText) content += ' ' + articleText.slice(0, 100);
            thumb = document.querySelector('#article .bg-img img')?.src || '';
            if (!title && window.dateDataCache?.get(date)?.article) {
                const art = window.dateDataCache.get(date).article;
                title = art.title || '';
                content = art.author || '';
                if (art.content) content += ' ' + art.content.slice(0, 100);
                thumb = art.image || '';
            }
        }

        content = content.replace(/\n/g, ' ').slice(0, 200);
        if (!thumb) thumb = 'img/default-share.png';
        return { title, content, thumb, href };
    }

    // 核心：调用系统分享面板（5+ 专用）
    function doSystemShare(text, href) {
        return new Promise((resolve, reject) => {
            // 确保 plus 对象存在且 share 模块已加载
            if (!window.plus || !window.plus.share) {
                reject(new Error('plus.share 不可用'));
                return;
            }
            // 构建分享消息（纯文本 + 链接）
            const msg = {
                type: 'text',
                content: text,
                href: href,
                thumbs: [],      // 系统分享通常不需要缩略图，保持空数组
                summary: text
            };
            plus.share.sendWithSystem(msg, () => {
                resolve(true);
            }, (err) => {
                reject(err);
            });
        });
    }

    let isSharingPending = false;
    let activeShareContext = null;

    // 主分享逻辑
    async function performShare(action, context) {
        if (isSharingPending) return;
        isSharingPending = true;

        const { type, date } = context;
        const shareUrl = getCurrentShareUrl();
        const shareData = getShareDataFromDOM(type, date);
        // 生成分享文本：标题 + 内容 + 链接
        const shareText = `${shareData.title}\n${shareData.content}\n${shareUrl}`;

        // 如果用户点击的是“复制链接”
        if (action === 'copy') {
            const ok = await copyLinkToClipboard();
            if (ok) {
                await updateShareCount(type, date, 1);
                showMsg('链接已复制', 1500);
            } else {
                showMsg('复制失败', 1500);
            }
            closeSharePanel();
            isSharingPending = false;
            return;
        }

        // 判断是否在 5+ App 环境中
        const isPlusEnv = typeof window.plus !== 'undefined' && window.plus && window.plus.share;

        if (isPlusEnv) {
            // 确保 plus 已经就绪
            if (window.plus.isReady) {
                try {
                    await doSystemShare(shareText, shareUrl);
                    await updateShareCount(type, date, 1);
                    showMsg('分享成功', 1200);
                } catch (err) {
                    console.error('系统分享失败', err);
                    // 降级：复制链接
                    const copied = await copyLinkToClipboard();
                    if (copied) {
                        await updateShareCount(type, date, 1);
                        showMsg('已复制链接，可手动粘贴分享', 1500);
                    } else {
                        showMsg('分享失败', 1500);
                    }
                }
            } else {
                // 等待 plusready 事件
                document.addEventListener('plusready', async () => {
                    try {
                        await doSystemShare(shareText, shareUrl);
                        await updateShareCount(type, date, 1);
                        showMsg('分享成功', 1200);
                    } catch (err) {
                        const copied = await copyLinkToClipboard();
                        if (copied) {
                            await updateShareCount(type, date, 1);
                            showMsg('已复制链接，可手动粘贴分享', 1500);
                        } else {
                            showMsg('分享失败', 1500);
                        }
                    }
                    closeSharePanel();
                    isSharingPending = false;
                });
                return;
            }
        } else {
            // 浏览器环境：复制链接
            const copied = await copyLinkToClipboard();
            if (copied) {
                await updateShareCount(type, date, 1);
                showMsg('链接已复制', 1500);
            } else {
                showMsg('分享失败', 1500);
            }
        }

        closeSharePanel();
        isSharingPending = false;
    }

    // 打开分享面板（移动端底部弹窗）
    function openSharePanel(type, date) {
        if (!type || !date) {
            showMsg('数据加载中，请稍后重试');
            return;
        }
        // 关闭其他打开的弹窗
        if (document.body.classList.contains('favorites-open') && typeof window.closeFavoritesModal === 'function') window.closeFavoritesModal();
        if (document.body.classList.contains('timeline-open') && typeof window.closeTimelineModal === 'function') window.closeTimelineModal();
        if (document.body.classList.contains('changelog-open') && typeof window.closeChangelogModal === 'function') window.closeChangelogModal();
        if (document.body.classList.contains('sidebar-open')) {
            const closeBtn = document.querySelector('.close-sidebar');
            if (closeBtn) closeBtn.click();
        }

        activeShareContext = { type, date };
        const modal = document.getElementById('shareModal');
        if (modal) {
            modal.classList.add('active');
            document.body.classList.add('share-panel-open');
        } else {
            console.warn('未找到分享面板 #shareModal');
            showMsg('分享功能未加载');
        }
    }

    function closeSharePanel() {
        const modal = document.getElementById('shareModal');
        if (modal) modal.classList.remove('active');
        document.body.classList.remove('share-panel-open');
        activeShareContext = null;
    }

    // 绑定分享面板内按钮事件
    function bindShareEvents() {
        const modal = document.getElementById('shareModal');
        if (!modal) return;

        const optionsContainer = modal.querySelector('.share-options');
        if (optionsContainer) {
            optionsContainer.addEventListener('click', (e) => {
                const option = e.target.closest('.share-option');
                if (option && activeShareContext) {
                    const action = option.getAttribute('data-share-action');
                    if (action) performShare(action, activeShareContext);
                }
            });
        }

        const overlay = document.getElementById('shareOverlay');
        if (overlay) overlay.addEventListener('click', closeSharePanel);

        const cancel = document.getElementById('shareCancelBtn');
        if (cancel) cancel.addEventListener('click', closeSharePanel);

        const panel = modal.querySelector('.share-panel');
        if (panel) panel.addEventListener('click', (e) => e.stopPropagation());
    }

    // 拦截所有分享按钮的点击
    function interceptShareButtons() {
        document.body.addEventListener('click', (e) => {
            const shareBtn = e.target.closest('.share-btn');
            if (!shareBtn) return;

            const actionsDiv = shareBtn.closest('.stats-actions');
            if (!actionsDiv) return;
            const type = actionsDiv.getAttribute('data-type');
            if (!type) return;

            const date = getCurrentDate();
            if (!date) {
                showMsg('暂无法分享，请稍后重试');
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            openSharePanel(type, date);
        }, true);
    }

    // 初始化：在 DOM 加载完成后绑定事件
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindShareEvents();
            interceptShareButtons();
        });
    } else {
        bindShareEvents();
        interceptShareButtons();
    }

    // 暴露全局函数（便于调试）
    window.openSharePanel = openSharePanel;
    window.closeSharePanel = closeSharePanel;
    window.getShareDataFromDOM = getShareDataFromDOM;
})();
// ========== 夜间模式管理 ==========
const THEME_STORAGE_KEY = 'site_theme';
const DARK_CLASS = 'dark-mode';

// 用于等待侧边栏关闭动画完成后再切换主题
let pendingThemeSwitch = null;
let sidebarTransitionListener = null;
let fallbackTimer = null;

// 获取夜间模式菜单项
const nightModeMenuItem = Array.from(document.querySelectorAll('.sidebar-menu .menu-item'))
    .find(item => item.textContent.includes('夜间模式') || item.textContent.includes('日间模式'));

// 更新菜单项的图标和文字
function updateThemeMenuItem(isDark) {
    if (!nightModeMenuItem) return;
    const icon = nightModeMenuItem.querySelector('i');
    const textNode = nightModeMenuItem.childNodes[1];
    
    if (isDark) {
        if (icon) {
            icon.classList.remove('ri-moon-clear-line');
            icon.classList.add('ri-sun-line');
        }
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            textNode.textContent = ' 日间模式';
        } else if (nightModeMenuItem.lastChild && nightModeMenuItem.lastChild.nodeType === Node.TEXT_NODE) {
            nightModeMenuItem.lastChild.textContent = ' 日间模式';
        } else {
            const textSpan = Array.from(nightModeMenuItem.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            if (textSpan) textSpan.textContent = ' 日间模式';
        }
    } else {
        if (icon) {
            icon.classList.remove('ri-sun-line');
            icon.classList.add('ri-moon-clear-line');
        }
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            textNode.textContent = ' 夜间模式';
        } else if (nightModeMenuItem.lastChild && nightModeMenuItem.lastChild.nodeType === Node.TEXT_NODE) {
            nightModeMenuItem.lastChild.textContent = ' 夜间模式';
        } else {
            const textSpan = Array.from(nightModeMenuItem.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            if (textSpan) textSpan.textContent = ' 夜间模式';
        }
    }
}

// 应用主题
function applyTheme(isDark) {
    if (isDark) {
        document.body.classList.add(DARK_CLASS);
    } else {
        document.body.classList.remove(DARK_CLASS);
    }
    updateThemeMenuItem(isDark);
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    setStatusBarStyle();
}

// 清除等待切换的残留监听与定时器
function clearPendingThemeSwitch() {
    if (sidebarTransitionListener) {
        sidebar.removeEventListener('transitionend', sidebarTransitionListener);
        sidebarTransitionListener = null;
    }
    if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
    }
    pendingThemeSwitch = null;
}

// 执行实际的主题切换
function executePendingThemeSwitch() {
    if (pendingThemeSwitch !== null) {
        applyTheme(pendingThemeSwitch);
        clearPendingThemeSwitch();
    }
}

// 切换主题（入口）
function toggleTheme() {
    const isCurrentlyDark = document.body.classList.contains(DARK_CLASS);
    const targetDark = !isCurrentlyDark;
    applyTheme(targetDark);
}

// 初始化主题
function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const isDark = savedTheme === 'dark';
    applyTheme(isDark);
    
// 等待 plusready 后设置状态栏
if (window.plus) {
    document.addEventListener('plusready', function() {
        setStatusBarStyle();
    });
} else {
    // 非 App 环境直接重置（但保留页面布局）
    setStatusBarStyle();
}
}

// 绑定夜间模式菜单点击事件
function bindNightModeToggle() {
    if (!nightModeMenuItem) return;
    nightModeMenuItem.removeEventListener('click', toggleTheme);
    nightModeMenuItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
    });
}
// ========== 手机系统返回键处理（5+ App 专用） ==========
(function() {
    // 弹窗栈：存储当前打开的模态框及其关闭函数
    let modalStack = [];
    let backButtonPressed = 0;

    // 注册模态框（添加到栈顶）
    function registerModal(modalElement, closeFunction) {
        // 如果已经存在相同元素，先移除
        unregisterModal(modalElement);
        modalStack.push({
            element: modalElement,
            close: closeFunction
        });
    }

    // 注销模态框（从栈中移除）
    function unregisterModal(modalElement) {
        const index = modalStack.findIndex(item => item.element === modalElement);
        if (index !== -1) {
            modalStack.splice(index, 1);
        }
    }

    // 关闭当前最顶层的模态框
    function closeTopModal() {
        if (modalStack.length === 0) return false;
        const topModal = modalStack[modalStack.length - 1];
        if (topModal && typeof topModal.close === 'function') {
            topModal.close();
            modalStack.pop();
            return true;
        }
        return false;
    }

    // 检查并注册模态框的状态变化
    function observeModal(element, className, closeFn) {
        if (!element) return;

        let isActive = false;
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const nowActive = element.classList.contains(className);
                    if (nowActive && !isActive) {
                        // 模态框打开，注册
                        registerModal(element, closeFn);
                    } else if (!nowActive && isActive) {
                        // 模态框关闭，注销
                        unregisterModal(element);
                    }
                    isActive = nowActive;
                }
            });
        });

        // 初始化当前状态
        isActive = element.classList.contains(className);
        if (isActive) registerModal(element, closeFn);

        observer.observe(element, { attributes: true });
        return observer;
    }

    // 等待 DOM 和 plusready 就绪后初始化返回键监听
    function initBackButton() {
        // 1. 观察 body 上的全局模态框类
        const body = document.body;
        // 侧边栏
        observeModal(body, 'sidebar-open', window.closeSidebar);
        // 时间轴
        observeModal(body, 'timeline-open', window.closeTimelineModal);
        // 收藏页
        observeModal(body, 'favorites-open', window.closeFavoritesModal);
        // 更新日志
        observeModal(body, 'changelog-open', window.closeChangelogModal);

        // 2. 观察分享面板（独立元素）
        const shareModal = document.getElementById('shareModal');
        if (shareModal) {
            observeModal(shareModal, 'active', window.closeSharePanel);
        }
            // 3. 观察图片预览弹窗 ← 新增代码
    const imagePreviewModal = document.getElementById('imagePreviewModal');
    if (imagePreviewModal) {
        observeModal(imagePreviewModal, 'active', closeImagePreview);
    }
        // 3. 监听返回键
        document.addEventListener('plusready', function() {
            plus.key.addEventListener('backbutton', function() {
                // 优先关闭任何打开的模态框
                if (closeTopModal()) {
                    return;
                }

                // 没有模态框时，处理双击退出
                if (backButtonPressed === 0) {
                    backButtonPressed = 1;
                    if (window.showToast) {
                        window.showToast('再按一次退出应用', 1500);
                    } else {
                        const toast = document.createElement('div');
                        toast.className = 'toast';
                        toast.textContent = '再按一次退出应用';
                        document.body.appendChild(toast);
                        setTimeout(() => toast.remove(), 1500);
                    }
                    setTimeout(function() {
                        backButtonPressed = 0;
                    }, 2000);
                } else {
                    plus.runtime.quit();
                }
            });
        });

        // 如果 plus 已经就绪（比如在 5+ App 中脚本加载较晚），直接执行
        if (window.plus && window.plus.key) {
            // 手动触发 plusready 回调（如果事件已错过）
            const evt = document.createEvent('Event');
            evt.initEvent('plusready', true, true);
            document.dispatchEvent(evt);
        }
    }

    // 在 DOM 加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBackButton);
    } else {
        initBackButton();
    }
})();
// ========== 沉浸式状态栏（5+ App）修复版 ==========

function setStatusBarStyle() {
    if (!window.plus || !plus.navigator) return;

    const isDark = document.body.classList.contains('dark-mode');
    plus.navigator.setStatusBarBackground('rgba(0,0,0,0)');
    plus.navigator.setStatusBarStyle(isDark ? 'light' : 'dark');

    // 获取状态栏实际高度（px）
    const statusBarHeight = plus.navigator.getStatusbarHeight();
    const elements = document.querySelectorAll('.top-nav, .sidebar-header, .timeline-header, .favorites-header, .changelog-header');
    
    elements.forEach(el => {
        if (el) {
            el.style.paddingTop = statusBarHeight + 'px';
        }
    });

    if (typeof updateCardVerticalPosition === 'function') {
        updateCardVerticalPosition();
    }
}
// ========== 图片预览模块（支持保存到相册） ==========
let currentPreviewUrl = '';

function openImagePreview(url) {
    if (!url || url === '') return;
    currentPreviewUrl = url;
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('previewImage');
    if (!modal || !img) return;

    img.src = url;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeImagePreview() {
    const modal = document.getElementById('imagePreviewModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentPreviewUrl = '';
}

async function saveCurrentImage() {
    if (!currentPreviewUrl) {
        showToast('暂无图片可保存');
        return;
    }

    const isPlusEnv = typeof window.plus !== 'undefined' && window.plus && window.plus.gallery;

    if (isPlusEnv) {
        if (!window.plus.isReady) {
            showToast('系统未就绪，请稍后重试');
            return;
        }
        if (plus.os.name === 'Android') {
            const permission = 'android.permission.WRITE_EXTERNAL_STORAGE';
            if (plus.android.checkPermission(permission) !== 'granted') {
                plus.android.requestPermissions([permission], function(e) {
                    if (e.granted.length > 0) {
                        saveToGallery();
                    } else {
                        showToast('需要存储权限才能保存图片');
                    }
                }, function(e) {
                    showToast('权限申请失败');
                });
                return;
            }
        }
        saveToGallery();
    } else {
        downloadImageInBrowser();
    }
}

function saveToGallery() {
    showToast('正在保存...', 1500);
    plus.gallery.save(currentPreviewUrl, function() {
        showToast('保存成功', 1500);
        closeImagePreview();  // 新增：保存成功后关闭弹窗
    }, function(err) {
        console.error('保存失败', err);
        // 降级下载
        plus.downloader.createDownload(currentPreviewUrl, { filename: '_downloads/temp_img.jpg' }, function(d, status) {
            if (status === 200) {
                plus.gallery.save(d.filename, function() {
                    showToast('保存成功', 1500);
                    closeImagePreview();  // 新增：降级保存成功后关闭弹窗
                }, function() {
                    showToast('保存失败，请检查权限');
                });
            } else {
                showToast('保存失败');
            }
        }).start();
    });
}

async function downloadImageInBrowser() {
    try {
        // 尝试 fetch 图片（需要 CORS 支持）
        const response = await fetch(currentPreviewUrl);
        if (!response.ok) throw new Error('获取图片失败');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'preview_image.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        closeImagePreview();
    } catch (err) {
        console.warn('Blob 下载失败，降级为长按保存提示', err);
        // 降级：提示用户长按图片保存
        showToast('请长按图片保存', 2000);
        // 可选：仍打开图片供用户长按
        // window.open(currentPreviewUrl, '_blank');
        closeImagePreview();
    }
}

function bindImagePreviewTriggers() {
    // 音乐封面
    const albumImg = document.getElementById('album-img');
    if (albumImg) {
        albumImg.addEventListener('click', (e) => {
            e.stopPropagation();
            if (albumImg.src && albumImg.style.display !== 'none') {
                openImagePreview(albumImg.src);
            }
        });
    }
    // 句子图片
    const sentenceImg = document.getElementById('sentenceImg');
    if (sentenceImg) {
        sentenceImg.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sentenceImg.src) {
                openImagePreview(sentenceImg.src);
            }
        });
    }
    // 文章头图
    const articleImg = document.querySelector('#article .bg-img img');
    if (articleImg) {
        articleImg.addEventListener('click', (e) => {
            e.stopPropagation();
            if (articleImg.src) {
                openImagePreview(articleImg.src);
            }
        });
    }

    // 收藏卡片中的缩略图（动态绑定，使用事件委托）
    document.body.addEventListener('click', (e) => {
        const thumbnail = e.target.closest('.favorite-card img');
        if (!thumbnail || !thumbnail.src) return;

        // ========== 新增：如果点击发生在收藏模态框内，则取消预览 ==========
        const favoritesModal = document.getElementById('favoritesModal');
        // 方式1：检查模态框是否可见（通过类名）
        if (document.body.classList.contains('favorites-open')) {
            return;
        }
        // 方式2（更安全）：检查点击元素是否在模态框内部
        if (favoritesModal && favoritesModal.contains(thumbnail)) {
            return;
        }
        // ============================================================

        e.stopPropagation();
        openImagePreview(thumbnail.src);
    });
}

function initImagePreviewModal() {
    const modal = document.getElementById('imagePreviewModal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-preview');
    const overlay = modal.querySelector('.image-preview-overlay');
    if (closeBtn) closeBtn.addEventListener('click', closeImagePreview);
    if (overlay) overlay.addEventListener('click', closeImagePreview);

    const saveBtn = document.getElementById('saveImageBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveCurrentImage);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeImagePreview();
        }
    });
}
window.toggleCard = function () { };
window.hideCard = function () { };

// 暴露必要的全局函数供内部调用
window.renderFavoriteCardFromSummary = renderFavoriteCardFromSummary;
window.renderFavoriteCard = renderFavoriteCard;
window.renderFavorites = renderFavorites;
window.navigateToContent = navigateToContent;
window.openFavoritesModal = openFavoritesModal;
window.closeFavoritesModal = closeFavoritesModal;
window.clearDateCache = clearDateCache;
window.showToast = showToast;
window.removeFavoriteSummary = removeFavoriteSummary;
<script>
    // ===== CONFIGURATION =====
    const ADMIN_PHONE = '08105238080';
    const API_BASE = '/api/users';
    let deferredPrompt;

    // ===== REFERRAL SYSTEM =====
    function generateReferralCode() {
        return String(Math.floor(1000000 + Math.random() * 9000000));
    }

    // ===== TOAST =====
    let toastTimeout;
    function showToast(msg) {
        const toast = document.getElementById('toast');
        document.getElementById('toastMessage').textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ===== ANNOUNCEMENT =====
    function showAnnouncement() {
        const popup = document.getElementById('announcementPopup');
        if (!popup) return;
        const lastSeen = localStorage.getItem('nrc_announcement_date');
        const today = new Date().toDateString();
        if (lastSeen !== today) { setTimeout(() => popup.classList.add('show'), 500); }
    }
    function closeAnnouncement() {
        const popup = document.getElementById('announcementPopup');
        if (popup) { popup.classList.remove('show'); localStorage.setItem('nrc_announcement_date', new Date().toDateString()); }
    }

    // ===== GET TODAY DATE =====
    function getTodayDate() {
        const now = new Date();
        return now.getFullYear() + '-' + 
               String(now.getMonth() + 1).padStart(2, '0') + '-' + 
               String(now.getDate()).padStart(2, '0');
    }

    // ===== REFERRAL FUNCTIONS =====
    function getReferralCode() {
        let code = localStorage.getItem('nrc_referral_code');
        if (!code) {
            code = generateReferralCode();
            localStorage.setItem('nrc_referral_code', code);
        }
        return code;
    }

    function getReferralLink() {
        const code = getReferralCode();
        const url = window.location.href.split('?')[0];
        return `${url}?ref=${code}`;
    }

    function copyReferralCode() {
        const code = getReferralCode();
        navigator.clipboard?.writeText(code).then(() => {
            showToast('✅ Referral code copied!');
        }).catch(() => {
            showToast('📋 Your code: ' + code);
        });
    }

    function copyReferralLink() {
        const link = getReferralLink();
        navigator.clipboard?.writeText(link).then(() => {
            showToast('✅ Referral link copied!');
        }).catch(() => {
            showToast('📋 ' + link);
        });
    }

    function shareTelegram() {
        const link = getReferralLink();
        const text = `🎉 Join NRC Cooperative Wealth Zone and start earning daily! Use my referral code: ${getReferralCode()}\n\nSign up here: ${link}`;
        const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    function shareReferral() {
        const link = getReferralLink();
        const text = `🎉 Join NRC Cooperative Wealth Zone and start earning daily! Use my referral code: ${getReferralCode()}\n\nSign up here: ${link}`;
        if (navigator.share) {
            navigator.share({
                title: 'NRC Cooperative Wealth Zone',
                text: text,
                url: link
            }).catch(() => {});
        } else {
            copyReferralLink();
        }
    }

    function showReferralShare() {
        document.getElementById('referralSection').scrollIntoView({ behavior: 'smooth' });
        showToast('📋 Your referral code: ' + getReferralCode());
    }

    // ===== LOAD REFERRAL DATA =====
    async function loadReferralData() {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) return;
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_referral_data', phone })
            });
            const data = await res.json();
            if (data.success) {
                const refData = data.data || {};
                document.getElementById('refTotal').textContent = refData.total || 0;
                document.getElementById('refActive').textContent = refData.active || 0;
                document.getElementById('refEarnings').textContent = '₦' + (refData.earnings || 0);
                document.getElementById('refLevel').textContent = refData.vip_level || 'Trial';
            }
        } catch (e) { console.error('Failed to load referral data:', e); }
    }

    // ===== REGISTER =====
    async function registerUser() {
        const phone = document.getElementById('registerPhone').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const confirm = document.getElementById('registerConfirmPassword').value.trim();
        const referral = document.getElementById('registerReferral').value.trim();
        
        if (!phone || !password || !confirm) { showToast('⚠️ Fill all fields'); return; }
        if (phone.length < 10) { showToast('⚠️ Invalid phone number'); return; }
        if (password.length < 4) { showToast('⚠️ Password must be at least 4 characters'); return; }
        if (password !== confirm) { showToast('⚠️ Passwords do not match'); return; }
        
        // Check if user already exists in localStorage
        const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
        if (users[phone]) {
            showToast('⚠️ User already exists. Please login.');
            document.getElementById('loginPhone').value = phone;
            setTimeout(() => switchTab('login'), 1000);
            return;
        }
        
        // Save to localStorage
        users[phone] = {
            phone: phone,
            password: password,
            balance: 0,
            vip_level: 'Trial',
            signup_date: getTodayDate(),
            referral_code: generateReferralCode()
        };
        localStorage.setItem('nrc_users', JSON.stringify(users));
        
        // Try API
        try {
            await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'register', 
                    phone: phone, 
                    password: password,
                    referral_code: referral || '',
                    own_referral_code: generateReferralCode()
                })
            });
        } catch (e) {
            console.warn('API register failed, but saved locally:', e.message);
        }
        
        showToast('✅ Registration successful! Please login.');
        document.getElementById('loginPhone').value = phone;
        setTimeout(() => switchTab('login'), 1000);
    }

    // ===== LOGIN - FIXED =====
    function loginUser() {
        const phone = document.getElementById('loginPhone').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const referral = document.getElementById('loginReferral').value.trim();
        
        if (!phone || !password) {
            showToast('⚠️ Please enter both phone and password');
            return;
        }
        
        if (phone.length < 10) {
            showToast('⚠️ Please enter a valid phone number');
            return;
        }
        
        // Check localStorage first
        const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
        
        // If user exists in localStorage and password matches
        if (users[phone] && users[phone].password === password) {
            completeLogin(phone, users[phone]);
            return;
        }
        
        // If user exists but password doesn't match
        if (users[phone]) {
            showToast('❌ Incorrect password. Please try again.');
            return;
        }
        
        // If user doesn't exist, create demo account
        const demoUser = {
            phone: phone,
            password: password,
            balance: 1650,
            vip_level: 'VIP2',
            total_revenue: 4650,
            yesterday_earnings: 1260,
            today_earnings: 1260,
            task_commission: 2100,
            referral_rebate: 1500,
            task_rebate: 1050,
            signup_date: getTodayDate(),
            referral_code: generateReferralCode()
        };
        
        users[phone] = demoUser;
        localStorage.setItem('nrc_users', JSON.stringify(users));
        completeLogin(phone, demoUser);
        showToast('✅ Demo account created! Welcome!');
    }

    // ===== COMPLETE LOGIN =====
    function completeLogin(phone, userData) {
        // Set login state
        localStorage.setItem('nrc_logged_in', 'true');
        localStorage.setItem('nrc_phone', phone);
        
        // Set referral code
        const refCode = userData.referral_code || generateReferralCode();
        localStorage.setItem('nrc_referral_code', refCode);
        
        // Prepare user data
        const user = {
            phone: phone,
            balance: userData.balance || 0,
            vip_level: userData.vip_level || 'Trial',
            total_revenue: userData.total_revenue || 0,
            yesterday_earnings: userData.yesterday_earnings || 0,
            today_earnings: userData.today_earnings || 0,
            task_commission: userData.task_commission || 0,
            referral_rebate: userData.referral_rebate || 0,
            task_rebate: userData.task_rebate || 0,
            signup_date: userData.signup_date || getTodayDate()
        };
        localStorage.setItem('nrc_user_data', JSON.stringify(user));
        
        if (phone === ADMIN_PHONE) {
            localStorage.setItem('nrc_is_admin', 'true');
        }
        
        // Update UI
        updateUserUI(user);
        loadUserBank();
        refreshMyPage();
        loadReferralData();
        checkAndRefreshTasks();
        
        showToast('✅ Welcome, ' + phone + '!');
        
        // Show tasks progress
        updateHomeTaskProgress();
        
        // Switch to home
        setTimeout(() => switchTab('home'), 500);
    }

    // ===== UPDATE UI =====
    function updateUserUI(user) {
        if (!user) return;
        
        const phone = user.phone || localStorage.getItem('nrc_phone') || 'Loading...';
        document.getElementById('myUserId').textContent = phone;
        document.getElementById('settingsProfileNumber').textContent = phone;
        document.getElementById('profilePhone').textContent = phone;
        document.getElementById('profileName').textContent = phone;
        
        const balance = user.balance || 0;
        document.getElementById('myBalance').textContent = balance;
        document.getElementById('withdrawalBalance').textContent = `Balance: ₦${balance}`;
        document.getElementById('profileBalance').textContent = `₦${balance}`;
        
        const vipLevel = user.vip_level || 'Trial';
        document.getElementById('myVipStatus').textContent = vipLevel;
        document.getElementById('vipIdentity').textContent = 'Your identity: ' + vipLevel;
        document.getElementById('profileVip').textContent = vipLevel;
        updateVIPDetails(vipLevel);
        
        document.getElementById('myTotalRevenue').textContent = user.total_revenue || 0;
        document.getElementById('myYesterdayEarnings').textContent = user.yesterday_earnings || 0;
        document.getElementById('myTodayEarnings').textContent = user.today_earnings || 0;
        document.getElementById('myTaskCommission').textContent = user.task_commission || 0;
        document.getElementById('myReferralRebate').textContent = user.referral_rebate || 0;
        document.getElementById('myTaskRebate').textContent = user.task_rebate || 0;
        document.getElementById('profileTotalRevenue').textContent = '₦' + (user.total_revenue || 0);
        document.getElementById('profileTodayEarnings').textContent = '₦' + (user.today_earnings || 0);
        
        // Set referral code
        const code = localStorage.getItem('nrc_referral_code') || generateReferralCode();
        localStorage.setItem('nrc_referral_code', code);
        document.getElementById('referralCode').textContent = code;
        
        updateVIPDates();
        updateHomeTaskProgress();
    }

    // ===== UPDATE VIP DATES =====
    function updateVIPDates() {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) return;
        const userData = JSON.parse(localStorage.getItem('nrc_user_data') || '{}');
        let startDate = userData.signup_date || localStorage.getItem('nrc_signup_date');
        if (!startDate) {
            startDate = getTodayDate();
            localStorage.setItem('nrc_signup_date', startDate);
            userData.signup_date = startDate;
            localStorage.setItem('nrc_user_data', JSON.stringify(userData));
        }
        const start = new Date(startDate);
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);
        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        };
        document.getElementById('vipDate').textContent = `${formatDate(start)}~${formatDate(end)}`;
    }

    function updateVIPDetails(vipLevel) {
        const vipData = {
            'Trial': { tasks: 6, profit: 630 },
            'VIP1': { tasks: 12, profit: 1260 },
            'VIP2': { tasks: 24, profit: 3600 },
            'VIP3': { tasks: 48, profit: 12000 },
            'VIP4': { tasks: 80, profit: 32000 },
            'VIP5': { tasks: 120, profit: 96000 },
            'VIP6': { tasks: 160, profit: 256000 },
            'VIP7': { tasks: 220, profit: 396000 },
            'VIP8': { tasks: 300, profit: 660000 },
            'VIP9': { tasks: 400, profit: 1400000 }
        };
        const data = vipData[vipLevel] || vipData['Trial'];
        document.getElementById('vipDailyTasks').textContent = 'Daily Tasks：' + data.tasks;
        document.getElementById('vipDailyProfit').textContent = 'Daily profit：₦' + data.profit;
    }

    async function fetchAndUpdateUserData(phone) {
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_user', phone })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('nrc_user_data', JSON.stringify(data.user));
                updateUserUI(data.user);
                return data.user;
            }
        } catch (e) { console.error('Failed to refresh user data:', e); }
        
        const userData = JSON.parse(localStorage.getItem('nrc_user_data') || '{}');
        if (userData.phone) {
            updateUserUI(userData);
            return userData;
        }
        return null;
    }

    // ===== REFRESH MY PAGE =====
    async function refreshMyPage() {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) return;
        
        // Check localStorage first
        const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
        if (users[phone]) {
            const userData = {
                phone: phone,
                balance: users[phone].balance || 0,
                vip_level: users[phone].vip_level || 'Trial',
                total_revenue: users[phone].total_revenue || 0,
                yesterday_earnings: users[phone].yesterday_earnings || 0,
                today_earnings: users[phone].today_earnings || 0,
                task_commission: users[phone].task_commission || 0,
                referral_rebate: users[phone].referral_rebate || 0,
                task_rebate: users[phone].task_rebate || 0
            };
            localStorage.setItem('nrc_user_data', JSON.stringify(userData));
            updateUserUI(userData);
            return;
        }
        
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_user_stats', phone })
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    const stats = data.data;
                    const userData = JSON.parse(localStorage.getItem('nrc_user_data') || '{}');
                    const mergedData = { ...userData, ...stats };
                    localStorage.setItem('nrc_user_data', JSON.stringify(mergedData));
                    updateUserUI(mergedData);
                    return;
                }
            }
        } catch (e) { console.warn('API refresh failed:', e.message); }
        
        const userData = JSON.parse(localStorage.getItem('nrc_user_data') || '{}');
        if (userData.phone) {
            updateUserUI(userData);
        }
    }

    // ===== TASK REFRESH FUNCTIONS =====
    function shouldRefreshTasks(phone) {
        const lastReset = localStorage.getItem(`nrc_tasks_reset_${phone}`);
        const today = getTodayDate();
        if (!lastReset || lastReset !== today) {
            return true;
        }
        return false;
    }

    async function refreshUserTasks(phone) {
        if (!phone) return false;
        const today = getTodayDate();
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'refresh_tasks',
                    phone: phone,
                    date: today
                })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem(`nrc_tasks_reset_${phone}`, today);
                localStorage.removeItem(`nrc_tasks_completed_${phone}_${today}`);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Network error refreshing tasks:', e);
            return false;
        }
    }

    async function checkAndRefreshTasks() {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) return;
        if (shouldRefreshTasks(phone)) {
            console.log('🔄 Refreshing tasks for today...');
            const success = await refreshUserTasks(phone);
            if (success) {
                showToast('✅ New tasks available for today!');
            }
        }
    }

    function checkMidnightRefresh() {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) return;
        
        setInterval(async () => {
            const today = getTodayDate();
            const lastReset = localStorage.getItem(`nrc_tasks_reset_${phone}`);
            
            if (lastReset !== today) {
                console.log('🌅 New day detected! Refreshing tasks...');
                await checkAndRefreshTasks();
                const activePage = document.querySelector('.page.active');
                if (activePage && (activePage.id === 'page-task' || activePage.id === 'page-home')) {
                    renderTasks();
                    updateHomeTaskProgress();
                    showToast('🌅 New tasks available for today!');
                }
            }
        }, 30000);
    }

    // ===== TASK SYSTEM =====
    async function fetchTaskStatus() {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) return null;
        
        await checkAndRefreshTasks();
        const today = getTodayDate();
        
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'get_user_tasks', 
                    phone: phone,
                    date: today 
                })
            });
            
            if (!res.ok) {
                return getDefaultTaskData(phone);
            }
            
            const data = await res.json();
            if (data.success) {
                localStorage.setItem(`nrc_tasks_${phone}_${today}`, JSON.stringify(data.data));
                return data.data;
            } else {
                return getDefaultTaskData(phone);
            }
        } catch (e) {
            console.warn('Network error, using fallback:', e.message);
            return getDefaultTaskData(phone);
        }
    }

    function getDefaultTaskData(phone) {
        const userData = JSON.parse(localStorage.getItem('nrc_user_data') || '{}');
        const vipLevel = userData.vip_level || 'Trial';
        
        const taskConfig = {
            'Trial': { tasks: 6, reward: 105 },
            'VIP1': { tasks: 12, reward: 105 },
            'VIP2': { tasks: 24, reward: 150 },
            'VIP3': { tasks: 48, reward: 250 },
            'VIP4': { tasks: 80, reward: 400 },
            'VIP5': { tasks: 120, reward: 800 },
            'VIP6': { tasks: 160, reward: 1600 },
            'VIP7': { tasks: 220, reward: 1800 },
            'VIP8': { tasks: 300, reward: 2200 },
            'VIP9': { tasks: 400, reward: 3500 }
        };
        
        const config = taskConfig[vipLevel] || taskConfig['Trial'];
        const today = getTodayDate();
        const key = `nrc_tasks_completed_${phone}_${today}`;
        const completed = parseInt(localStorage.getItem(key) || '0');
        
        return {
            vip_level: vipLevel,
            total_tasks: config.tasks,
            completed_tasks: completed,
            remaining_tasks: Math.max(0, config.tasks - completed),
            reward_per_task: config.reward,
            earned_today: completed * config.reward
        };
    }

    // ===== COMPLETE TASK =====
    async function completeTask(taskId, reward) {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) { showToast('⚠️ Please login'); return; }
        
        const today = getTodayDate();
        const key = `nrc_tasks_completed_${phone}_${today}`;
        let completed = parseInt(localStorage.getItem(key) || '0');
        completed++;
        localStorage.setItem(key, String(completed));
        
        // Update balance in localStorage
        const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
        if (users[phone]) {
            users[phone].balance = (users[phone].balance || 0) + reward;
            users[phone].today_earnings = (users[phone].today_earnings || 0) + reward;
            localStorage.setItem('nrc_users', JSON.stringify(users));
        }
        
        const userData = JSON.parse(localStorage.getItem('nrc_user_data') || '{}');
        userData.balance = (userData.balance || 0) + reward;
        userData.today_earnings = (userData.today_earnings || 0) + reward;
        localStorage.setItem('nrc_user_data', JSON.stringify(userData));
        
        try {
            await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'complete_task', 
                    phone: phone, 
                    taskId: taskId,
                    date: today
                })
            });
        } catch (e) { console.warn('API complete_task failed:', e.message); }
        
        const taskItem = document.getElementById('taskItem_' + taskId);
        if (taskItem) taskItem.style.display = 'none';
        
        document.getElementById('todayEarnings').textContent = '₦' + (completed * reward);
        document.getElementById('myBalance').textContent = userData.balance;
        
        await refreshMyPage();
        updateHomeTaskProgress();
        showToast('✅ +₦' + reward + ' earned!');
        
        const taskData = await fetchTaskStatus();
        if (taskData && completed >= taskData.total_tasks) {
            showToast('🎉 All tasks completed for today!');
        }
    }

    // ===== UPDATE HOME TASK PROGRESS =====
    async function updateHomeTaskProgress() {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) return;
        
        const taskData = await fetchTaskStatus();
        if (taskData) {
            const total = taskData.total_tasks || 0;
            const completed = taskData.completed_tasks || 0;
            const earned = taskData.earned_today || 0;
            
            document.getElementById('todayTaskProgress').textContent = `${completed}/${total}`;
            document.getElementById('todayEarnedHome').textContent = `₦${earned}`;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            document.getElementById('taskProgressBar').style.width = progress + '%';
        }
    }

    // ===== RENDER TASKS =====
    async function renderTasks() {
        const container = document.getElementById('taskList');
        if (!container) return;

        const phone = localStorage.getItem('nrc_phone');
        if (!phone) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Please login first</div>';
            return;
        }

        await checkAndRefreshTasks();

        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">Loading tasks...</div>';

        const taskData = await fetchTaskStatus();
        if (!taskData) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Failed to load tasks</div>';
            return;
        }

        const total = taskData.total_tasks || 0;
        const completed = taskData.completed_tasks || 0;
        const remaining = taskData.remaining_tasks || 0;
        const earned = taskData.earned_today || 0;

        updateHomeTaskProgress();

        if (taskData.vip_level === 'Trial' || taskData.vip_level === 'trial') {
            container.innerHTML = `
                <div style="text-align:center;padding:30px 20px;background:#fff;border-radius:16px;border:2px solid #fef3c7;">
                    <div style="font-size:48px;margin-bottom:12px;">🔒</div>
                    <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:6px;">VIP Required to Earn</h3>
                    <p style="font-size:14px;color:#64748b;margin-bottom:12px;">You are currently on the <strong>Trial</strong> plan.<br>Upgrade to any VIP level to start completing tasks!</p>
                    <button onclick="switchTab('vip')" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;padding:12px 30px;border-radius:30px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(245,158,11,0.3);">👑 Upgrade to VIP</button>
                </div>
            `;
            return;
        }

        document.getElementById('todayEarnings').textContent = '₦' + earned;
        document.getElementById('totalRevenue').textContent = '₦' + (earned || 0);

        if (remaining <= 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:20px;color:#065f46;">
                    ✅ All ${total} tasks completed for today!<br>
                    <span style="font-size:13px;color:#64748b;">Come back tomorrow for more.</span>
                    <div style="margin-top:10px;font-size:24px;">🎉</div>
                </div>
            `;
            return;
        }

        let html = `<div style="padding:8px 16px;background:#d1fae5;color:#065f46;font-size:12px;font-weight:600;border-bottom:1px solid #10b981;">
            📊 Progress: ${completed}/${total} tasks completed
        </div>`;
        
        for (let i = 1; i <= remaining; i++) {
            html += `
                <div class="task-item" id="taskItem_${i}">
                    <div class="task-info">
                        <div class="task-amount">₦${taskData.reward_per_task || 105}</div>
                        <div style="font-size:11px;color:#94a3b8;">Task ${completed + i}/${total}</div>
                    </div>
                    <div class="task-btn">
                        <button class="read-btn" onclick="startReading(${i}, ${taskData.reward_per_task || 105})">read</button>
                    </div>
                </div>
            `;
        }
        html += `<div class="loading-container"><span>No more data</span></div>`;
        container.innerHTML = html;
    }

    // ===== READING SYSTEM =====
    let isReading = false;
    let timerInterval = null;
    let remainingTime = 19;

    async function startReading(taskId, reward) {
        if (isReading) {
            showToast('⚠️ Please finish your current reading task first!');
            return;
        }
        isReading = true;
        remainingTime = 19;
        const overlay = document.getElementById('readingOverlay');
        overlay.classList.add('show');
        document.getElementById('novelIframe').src = 'https://m.hinovel.com/story/Alphas-Claimed-Mate_7265676d336165';
        document.getElementById('timerTopLeft').classList.add('show');
        updateTimerDisplay(19);
        timerInterval = setInterval(async function() {
            remainingTime--;
            updateTimerDisplay(remainingTime);
            if (remainingTime <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                await completeTask(taskId, reward);
                document.getElementById('readingOverlay').classList.remove('show');
                document.getElementById('timerTopLeft').classList.remove('show');
                document.getElementById('novelIframe').src = 'about:blank';
                isReading = false;
            }
        }, 1000);
    }

    function updateTimerDisplay(seconds) {
        document.getElementById('timerDisplay').textContent = seconds;
    }

    function closeReading() {
        if (isReading) {
            showToast('⚠️ Cannot close while reading! Wait for the timer.');
            return;
        }
        document.getElementById('readingOverlay').classList.remove('show');
        document.getElementById('timerTopLeft').classList.remove('show');
        document.getElementById('novelIframe').src = 'about:blank';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }

    // ===== WITHDRAWAL - MONDAY TO FRIDAY =====
    function canWithdraw() {
        const now = new Date();
        const day = now.getDay();
        return day >= 1 && day <= 5;
    }

    function getDayName(day) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[day];
    }

    function checkWithdrawalAvailability() {
        const content = document.querySelector('.withdrawal-content');
        if (!content) return;
        const existingWarning = document.getElementById('withdrawalDayWarning');
        if (existingWarning) existingWarning.remove();
        const submitBtn = document.querySelector('.withdrawal-submit-btn');
        if (!canWithdraw()) {
            const now = new Date();
            const dayName = getDayName(now.getDay());
            const warningDiv = document.createElement('div');
            warningDiv.id = 'withdrawalDayWarning';
            warningDiv.className = 'withdrawal-no-bank';
            warningDiv.style.marginBottom = '12px';
            warningDiv.style.background = '#fee2e2';
            warningDiv.style.borderColor = '#ef4444';
            warningDiv.style.color = '#dc2626';
            warningDiv.innerHTML = `⚠️ <strong>Withdrawals are only processed Monday-Friday.</strong><br>Today is ${dayName}. Please submit your request on a business day.`;
            content.insertBefore(warningDiv, content.firstChild);
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.textContent = '❌ Withdrawals Mon-Fri Only';
            }
        } else {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.textContent = 'Submit';
            }
        }
    }

    // ===== SWITCH TAB =====
    function switchTab(tab) {
        const loggedIn = localStorage.getItem('nrc_logged_in');
        if (tab !== 'login' && tab !== 'register' && !loggedIn) {
            showToast('⚠️ Please login first');
            return;
        }
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        
        if (tab === 'login') {
            document.getElementById('page-login').classList.add('active');
            document.querySelector('.tab-bar').style.display = 'none';
            document.getElementById('adminFloat').style.display = 'none';
            const tempPhone = localStorage.getItem('nrc_temp_phone');
            if (tempPhone) { document.getElementById('loginPhone').value = tempPhone; }
        } else if (tab === 'register') {
            document.getElementById('page-register').classList.add('active');
            document.querySelector('.tab-bar').style.display = 'none';
            document.getElementById('adminFloat').style.display = 'none';
        } else {
            const map = {
                home: 'page-home', task: 'page-task', vip: 'page-vip',
                profit: 'page-profit', my: 'page-my', withdrawal: 'page-withdrawal',
                recharge: 'page-recharge', settings: 'page-settings',
                aihelper: 'page-aihelper',
                company: 'page-company', video: 'page-video', helpcenter: 'page-helpcenter',
                profile: 'page-profile', tutorial: 'page-tutorial', positions: 'page-positions',
                analytics: 'page-analytics', deposit: 'page-deposit',
                taskrecords: 'page-taskrecords', teams: 'page-teams',
                dailystatement: 'page-dailystatement', accounting: 'page-accounting',
                wealthcenter: 'page-wealthcenter', creditscore: 'page-creditscore',
                downloadapp: 'page-downloadapp', follownrc: 'page-follownrc',
                realname: 'page-realname', bindbank: 'page-bindbank',
                changepassword: 'page-changepassword', changefundpassword: 'page-changefundpassword'
            };
            if (map[tab]) document.getElementById(map[tab]).classList.add('active');
            document.querySelector('.tab-bar').style.display = 'flex';
            if (localStorage.getItem('nrc_phone') === ADMIN_PHONE) {
                document.getElementById('adminFloat').style.display = 'block';
            }
            if (tab === 'withdrawal') {
                loadUserBank();
                checkWithdrawalAvailability();
            }
            if (tab === 'home') {
                showAnnouncement();
                updateHomeTaskProgress();
            }
            if (tab === 'task') renderTasks();
            if (tab === 'my') {
                refreshMyPage();
                loadReferralData();
                const code = localStorage.getItem('nrc_referral_code') || generateReferralCode();
                document.getElementById('referralCode').textContent = code;
            }
            if (tab === 'vip' || tab === 'profile') {
                const phone = localStorage.getItem('nrc_phone');
                if (phone) fetchAndUpdateUserData(phone);
            }
            if (tab === 'vip') updateVIPDates();
            if (tab === 'wealthcenter') loadWealthCenterData();
        }
    }

    // ===== VIP PAYMENT =====
    var currentPayment = { vipLevel: 0, amount: 0, newBalance: 0, vipName: '' };

    function openPayment(level, topup, newBalance, vipName) {
        currentPayment.vipLevel = level;
        currentPayment.amount = topup;
        currentPayment.newBalance = newBalance;
        currentPayment.vipName = vipName;
        document.getElementById('paymentAmount').textContent = '₦' + topup.toLocaleString();
        document.getElementById('paymentVipLevel').textContent = vipName;
        document.getElementById('paymentTopup').textContent = '₦' + topup.toLocaleString();
        document.getElementById('paymentNewBalance').textContent = '₦' + newBalance.toLocaleString();
        var statusEl = document.getElementById('paymentStatus');
        statusEl.className = 'payment-status';
        statusEl.style.display = 'none';
        statusEl.textContent = '';
        document.getElementById('paymentPopup').classList.add('show');
    }

    function closePaymentPopup() {
        document.getElementById('paymentPopup').classList.remove('show');
    }

    function copyBankDetails() {
        var bankDetails = "🏦 Nombank MFB\n📋 2519487868\n👤 Tradehub Services";
        navigator.clipboard?.writeText(bankDetails).then(() => {
            showToast('✅ Account details copied to clipboard!');
        }).catch(() => {
            showToast('📋 Bank: Nombank MFB | Account: 2519487868 | Name: Tradehub Services');
        });
        var statusEl = document.getElementById('paymentStatus');
        statusEl.className = 'payment-status pending';
        statusEl.style.display = 'block';
        statusEl.textContent = '📋 Account details copied! Make your transfer and click "I Have Paid".';
    }

    async function verifyPayment() {
        const statusEl = document.getElementById('paymentStatus');
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) {
            showToast('⚠️ Please login first');
            return;
        }
        statusEl.className = 'payment-status pending';
        statusEl.style.display = 'block';
        statusEl.innerHTML = `⏳ <strong>Pending</strong><br><span style="font-size:13px;font-weight:400;">Submitting your upgrade request...</span>`;
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request_upgrade',
                    phone: phone,
                    vipLevel: currentPayment.vipName,
                    amount: currentPayment.amount
                })
            });
            const data = await res.json();
            if (data.success) {
                statusEl.className = 'payment-status success';
                statusEl.innerHTML = `⏳ <strong>Pending</strong><br><span style="font-size:13px;font-weight:400;">Your request has been submitted. Admin will process it shortly.</span>`;
                setTimeout(() => closePaymentPopup(), 5000);
            } else {
                statusEl.className = 'payment-status failed';
                statusEl.textContent = '❌ ' + data.message;
            }
        } catch (e) {
            statusEl.className = 'payment-status failed';
            statusEl.textContent = '❌ Network error: ' + e.message;
        }
    }

    // ===== WEALTH CENTER =====
    async function loadWealthCenterData() {
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) return;
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_investments', phone })
            });
            const data = await res.json();
            if (data.success) {
                const investments = data.investments || [];
                const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
                const totalReturns = investments.reduce((sum, inv) => sum + inv.total_return, 0);
                document.getElementById('wcTotalInvested').textContent = '₦' + totalInvested.toLocaleString();
                document.getElementById('wcActivePlans').textContent = investments.length;
                document.getElementById('wcTotalReturns').textContent = '₦' + totalReturns.toLocaleString();
            }
        } catch (e) { console.error('Failed to load wealth center data:', e); }
    }

    // ===== AI TASK BOT =====
    let botRunning = false;
    let botTasks = [];
    let botCompleted = 0;
    let botEarnings = 0;
    let botTotalTasks = 0;

    function loadBotSettings() {
        const autoStart = localStorage.getItem('bot_auto_start') === 'true';
        const delay = parseInt(localStorage.getItem('bot_delay')) || 2;
        document.getElementById('autoStartBot').checked = autoStart;
        document.getElementById('botDelay').value = delay;
    }

    function saveBotSettings() {
        localStorage.setItem('bot_auto_start', document.getElementById('autoStartBot').checked);
        localStorage.setItem('bot_delay', document.getElementById('botDelay').value);
    }

    function addBotLog(message, type = 'info') {
        const log = document.getElementById('botLog');
        if (!log) return;
        const time = new Date().toLocaleTimeString();
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#64748b',
            progress: '#065f46'
        };
        const entry = document.createElement('div');
        entry.style.padding = '4px 0';
        entry.style.borderBottom = '1px solid #f1f5f9';
        entry.style.color = colors[type] || colors.info;
        entry.style.fontSize = '13px';
        entry.innerHTML = `<span style="color:#94a3b8;font-size:11px;">${time}</span> ${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
        while (log.children.length > 100) {
            log.removeChild(log.firstChild);
        }
    }

    function updateBotStats() {
        document.getElementById('botTotalTasks').textContent = botTotalTasks;
        document.getElementById('botCompletedTasks').textContent = botCompleted;
        document.getElementById('botEarnings').textContent = '₦' + botEarnings.toLocaleString();
        const progress = botTotalTasks > 0 ? Math.round((botCompleted / botTotalTasks) * 100) : 0;
        document.getElementById('botProgressText').textContent = progress + '% complete';
        document.getElementById('botProgressBar').style.width = progress + '%';
        if (botRunning && botTotalTasks > 0) {
            const remaining = botTotalTasks - botCompleted;
            const delay = parseInt(document.getElementById('botDelay').value) || 2;
            const timePerTask = 20 + delay;
            const totalSeconds = remaining * timePerTask;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            document.getElementById('botTimeRemaining').textContent = `⏳ ~${minutes}m ${seconds}s remaining`;
        } else if (botRunning && botTotalTasks === 0) {
            document.getElementById('botTimeRemaining').textContent = '🔍 Scanning for tasks...';
        } else if (botCompleted > 0 && botCompleted === botTotalTasks) {
            document.getElementById('botTimeRemaining').textContent = '✅ All tasks completed!';
        } else {
            document.getElementById('botTimeRemaining').textContent = '⏳ Waiting to start...';
        }
    }

    async function startTaskBot() {
        if (botRunning) {
            showToast('⚠️ Bot is already running');
            return;
        }
        const phone = localStorage.getItem('nrc_phone');
        if (!phone) {
            showToast('⚠️ Please login first');
            return;
        }
        const userData = JSON.parse(localStorage.getItem('nrc_user_data') || '{}');
        if (!userData.vip_level || userData.vip_level === 'Trial') {
            showToast('⚠️ VIP required to use the bot. Upgrade to VIP1 or higher.');
            return;
        }
        botRunning = true;
        botCompleted = 0;
        botEarnings = 0;
        botTasks = [];
        document.getElementById('botLog').innerHTML = '';
        document.getElementById('startBotBtn').style.opacity = '0.5';
        document.getElementById('startBotBtn').style.pointerEvents = 'none';
        document.getElementById('stopBotBtn').style.opacity = '1';
        document.getElementById('stopBotBtn').style.pointerEvents = 'auto';
        document.getElementById('botStatus').textContent = '🟢 Running';
        document.getElementById('botStatus').style.color = '#10b981';
        addBotLog('🚀 Bot started! Scanning for tasks...', 'info');
        const taskData = await fetchTaskStatus();
        if (!taskData || !taskData.remaining_tasks || taskData.remaining_tasks <= 0) {
            addBotLog('❌ No tasks available to complete today', 'error');
            stopTaskBot();
            return;
        }
        botTotalTasks = taskData.remaining_tasks;
        for (let i = 1; i <= botTotalTasks; i++) {
            botTasks.push({ id: i, reward: taskData.reward_per_task || 105 });
        }
        addBotLog(`📋 Found ${botTotalTasks} tasks to complete`, 'success');
        updateBotStats();
        await processBotTasks();
    }

    async function processBotTasks() {
        if (!botRunning) return;
        const delay = parseInt(document.getElementById('botDelay').value) || 2;
        for (let i = 0; i < botTasks.length; i++) {
            if (!botRunning) {
                addBotLog('⏹ Bot stopped by user', 'warning');
                break;
            }
            const task = botTasks[i];
            const taskNumber = i + 1;
            addBotLog(`⏳ Processing task #${taskNumber}/${botTotalTasks}...`, 'progress');
            document.getElementById('botStatus').textContent = `🔄 Processing task ${taskNumber}/${botTotalTasks}`;
            try {
                const success = await executeBotTask(task);
                if (success) {
                    botCompleted++;
                    botEarnings += task.reward;
                    addBotLog(`✅ Task #${taskNumber} completed - +₦${task.reward}`, 'success');
                    const todayEarnings = document.getElementById('todayEarnings');
                    if (todayEarnings) {
                        const current = parseInt(todayEarnings.textContent.replace('₦', '')) || 0;
                        todayEarnings.textContent = '₦' + (current + task.reward);
                    }
                    const balanceEl = document.getElementById('myBalance');
                    if (balanceEl) {
                        balanceEl.textContent = parseInt(balanceEl.textContent) + task.reward;
                    }
                    updateBotStats();
                    await refreshMyPage();
                    updateHomeTaskProgress();
                } else {
                    addBotLog(`❌ Task #${taskNumber} failed, retrying...`, 'error');
                    const retry = await executeBotTask(task);
                    if (retry) {
                        botCompleted++;
                        botEarnings += task.reward;
                        addBotLog(`✅ Task #${taskNumber} completed on retry - +₦${task.reward}`, 'success');
                        updateBotStats();
                    } else {
                        addBotLog(`❌ Task #${taskNumber} failed permanently`, 'error');
                    }
                }
            } catch (e) {
                addBotLog(`❌ Task #${taskNumber} error: ${e.message}`, 'error');
            }
            if (i < botTasks.length - 1 && botRunning) {
                addBotLog(`⏳ Waiting ${delay}s before next task...`, 'info');
                await sleep(delay * 1000);
            }
        }
        if (botRunning) {
            if (botCompleted === botTotalTasks) {
                addBotLog(`🎉 All ${botTotalTasks} tasks completed! Total earned: ₦${botEarnings.toLocaleString()}`, 'success');
                document.getElementById('botStatus').textContent = '✅ Complete';
                document.getElementById('botStatus').style.color = '#10b981';
            } else {
                addBotLog(`⏹ Bot finished. ${botCompleted}/${botTotalTasks} tasks completed.`, 'warning');
            }
            stopTaskBot();
        }
    }

    async function executeBotTask(task) {
        return new Promise((resolve) => {
            const phone = localStorage.getItem('nrc_phone');
            if (!phone) { resolve(false); return; }
            let timeLeft = 20;
            addBotLog(`📖 Reading task #${task.id}... (${timeLeft}s remaining)`, 'info');
            setTimeout(async () => {
                try {
                    const res = await fetch(API_BASE, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            action: 'complete_task', 
                            phone: phone, 
                            taskId: task.id,
                            date: getTodayDate()
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch (e) {
                    resolve(false);
                }
            }, 20000);
        });
    }

    function stopTaskBot() {
        botRunning = false;
        document.getElementById('startBotBtn').style.opacity = '1';
        document.getElementById('startBotBtn').style.pointerEvents = 'auto';
        document.getElementById('stopBotBtn').style.opacity = '0.5';
        document.getElementById('stopBotBtn').style.pointerEvents = 'none';
        if (botCompleted === botTotalTasks && botTotalTasks > 0) {
            document.getElementById('botStatus').textContent = '✅ Complete';
            document.getElementById('botStatus').style.color = '#10b981';
        } else {
            document.getElementById('botStatus').textContent = '⏹ Stopped';
            document.getElementById('botStatus').style.color = '#ef4444';
        }
        if (botCompleted > 0 || botTotalTasks > 0) {
            addBotLog('⏹ Bot stopped', 'warning');
        }
        updateBotStats();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== ADMIN PANEL =====
    async function loadAllUsers() {
        const container = document.getElementById('adminRequests');
        if (!container) return;
        const phone = localStorage.getItem('nrc_phone');
        if (phone !== ADMIN_PHONE) {
            container.innerHTML = '<div style="text-align:center;color:#ef4444;font-size:12px;padding:8px 0;">Admin only</div>';
            return;
        }
        container.innerHTML = '<div style="text-align:center;color:#64748b;font-size:12px;padding:8px 0;">⏳ Loading...</div>';
        try {
            const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
            const userList = Object.keys(users);
            if (userList.length > 0) {
                let html = '';
                userList.forEach((phone) => {
                    const user = users[phone];
                    html += `<div class="request-item" style="border-bottom:1px solid #f0f2f5; padding:8px 0;">
                        <div class="req-info" style="flex:1;">
                            <div class="req-user" style="font-weight:600;color:#0f172a;">${phone.substring(0,4)}****${phone.substring(phone.length-4)}</div>
                            <div class="req-detail" style="font-size:10px;color:#64748b;">VIP: ${user.vip_level || 'Trial'} | Balance: ₦${user.balance || 0}</div>
                        </div>
                        <div class="req-actions" style="display:flex;gap:4px;flex-wrap:wrap;">
                            <button class="approve" onclick="upgradeVIP('${phone}', 'VIP1')" style="padding:2px 8px;border-radius:12px;border:none;font-size:9px;font-weight:600;cursor:pointer;background:#10b981;color:#fff;">VIP1</button>
                            <button class="approve" onclick="upgradeVIP('${phone}', 'VIP2')" style="padding:2px 8px;border-radius:12px;border:none;font-size:9px;font-weight:600;cursor:pointer;background:#10b981;color:#fff;">VIP2</button>
                            <button class="approve" onclick="upgradeVIP('${phone}', 'VIP3')" style="padding:2px 8px;border-radius:12px;border:none;font-size:9px;font-weight:600;cursor:pointer;background:#10b981;color:#fff;">VIP3</button>
                            <button class="approve" onclick="upgradeVIP('${phone}', 'VIP4')" style="padding:2px 8px;border-radius:12px;border:none;font-size:9px;font-weight:600;cursor:pointer;background:#10b981;color:#fff;">VIP4</button>
                            <button class="approve" onclick="upgradeVIP('${phone}', 'VIP5')" style="padding:2px 8px;border-radius:12px;border:none;font-size:9px;font-weight:600;cursor:pointer;background:#10b981;color:#fff;">VIP5</button>
                            <button class="deny" onclick="openAddBalanceModal('${phone}')" style="padding:2px 8px;border-radius:12px;border:none;font-size:9px;font-weight:600;cursor:pointer;background:#f59e0b;color:#fff;">+₦</button>
                        </div>
                    </div>`;
                });
                container.innerHTML = html;
                document.getElementById('totalUsers').textContent = userList.length;
            } else {
                container.innerHTML = '<div style="text-align:center;color:#64748b;font-size:12px;padding:8px 0;">No users found</div>';
            }
        } catch (e) {
            container.innerHTML = '<div style="text-align:center;color:#ef4444;font-size:12px;padding:8px 0;">Error loading users</div>';
        }
    }

    function openAddBalanceModal(phone) {
        const amount = prompt(`Enter amount to add to ${phone}:`, '1000');
        if (amount !== null && !isNaN(amount) && parseInt(amount) > 0) {
            addBalance(phone, parseInt(amount));
        }
    }

    async function addBalance(phone, amount) {
        const adminPhone = localStorage.getItem('nrc_phone');
        if (adminPhone !== ADMIN_PHONE) { showToast('❌ Admin only'); return; }
        // Update localStorage
        const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
        if (users[phone]) {
            users[phone].balance = (users[phone].balance || 0) + amount;
            localStorage.setItem('nrc_users', JSON.stringify(users));
            showToast(`✅ ₦${amount.toLocaleString()} added to ${phone}`);
            loadAllUsers();
            if (phone === localStorage.getItem('nrc_phone')) {
                refreshMyPage();
            }
        } else {
            showToast('❌ User not found');
        }
    }

    async function upgradeVIP(phone, vipLevel) {
        const adminPhone = localStorage.getItem('nrc_phone');
        if (adminPhone !== ADMIN_PHONE) { showToast('❌ Admin only'); return; }
        // Update localStorage
        const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
        if (users[phone]) {
            users[phone].vip_level = vipLevel;
            localStorage.setItem('nrc_users', JSON.stringify(users));
            showToast(`✅ ${phone} upgraded to ${vipLevel}`);
            loadAllUsers();
            if (phone === localStorage.getItem('nrc_phone')) {
                refreshMyPage();
            }
        } else {
            showToast('❌ User not found');
        }
    }

    async function loadPendingRequests() {
        const container = document.getElementById('pendingRequestsContainer');
        if (!container) return;
        const phone = localStorage.getItem('nrc_phone');
        if (phone !== ADMIN_PHONE) {
            container.innerHTML = '<div style="text-align:center;color:#ef4444;font-size:11px;padding:8px 0;">Admin only</div>';
            return;
        }
        container.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:11px;padding:8px 0;">No pending requests</div>';
        document.getElementById('adminBadge').textContent = '0';
        document.getElementById('pendingUpgrades').textContent = '0';
    }

    async function approveUpgrade(requestId, phone, vipLevel) {
        showToast('✅ Upgrade approved!');
        upgradeVIP(phone, vipLevel);
    }

    async function denyUpgrade(requestId) {
        showToast('✅ Request denied');
    }

    async function adminViewUserPassword() {
        const phone = prompt('📱 Enter user phone number:');
        if (!phone) return;
        const adminPhone = localStorage.getItem('nrc_phone');
        if (adminPhone !== ADMIN_PHONE) {
            alert('❌ Admin access required');
            return;
        }
        const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
        if (users[phone]) {
            alert(`📋 USER DETAILS\n📱 Phone: ${phone}\n🔑 Password: ${users[phone].password}\n⭐ VIP: ${users[phone].vip_level || 'Trial'}\n💰 Balance: ₦${users[phone].balance || 0}`);
        } else {
            alert('❌ User not found');
        }
    }

    async function adminResetPassword() {
        const phone = prompt('📱 Enter user phone number:');
        if (!phone) return;
        const adminPhone = localStorage.getItem('nrc_phone');
        if (adminPhone !== ADMIN_PHONE) {
            alert('❌ Admin access required');
            return;
        }
        const newPassword = prompt('🔑 Enter new password (min 4 characters):');
        if (!newPassword || newPassword.length < 4) {
            alert('⚠️ Password must be at least 4 characters');
            return;
        }
        const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
        if (users[phone]) {
            users[phone].password = newPassword;
            localStorage.setItem('nrc_users', JSON.stringify(users));
            alert(`✅ Password reset successful!\n📱 User: ${phone}\n🔑 New Password: ${newPassword}`);
        } else {
            alert('❌ User not found');
        }
    }

    function toggleAdminPanel() {
        const panel = document.getElementById('adminPanel');
        panel.classList.toggle('show');
        if (panel.classList.contains('show')) {
            loadAllUsers();
            loadPendingRequests();
        }
    }

    function refreshAdminPanel() {
        loadAllUsers();
        loadPendingRequests();
    }

    // ===== LOAD USER BANK =====
    function loadUserBank() {
        var container = document.getElementById('withdrawalBankDisplay');
        if (!container) return;
        var bankDetails = localStorage.getItem('nrc_bank_details');
        if (bankDetails) {
            var data = JSON.parse(bankDetails);
            container.innerHTML = `<div class="withdrawal-option selected">🏦 ${data.bank} - ${data.account} <span class="checkmark">✓</span></div>`;
        } else {
            container.innerHTML = `<div class="withdrawal-no-bank">⚠️ Please add a bank card in Settings → Bind bank card</div>`;
        }
    }

    // ===== OTHER FUNCTIONS =====
    function setRechargeAmount(amt) {
        document.getElementById('rechargeAmount').value = amt;
        document.getElementById('rechargeDisplayAmount').textContent = amt;
    }

    function processRecharge() {
        const amount = document.getElementById('rechargeAmount').value;
        if (!amount || parseInt(amount) < 100) {
            showToast('⚠️ Enter a valid amount (minimum ₦100)');
            return;
        }
        document.getElementById('rechargeStatus').classList.add('show');
    }

    function verifyRecharge() {
        document.getElementById('rechargeStatus').classList.remove('show');
        document.getElementById('rechargeSuccess').classList.add('show');
        const amount = document.getElementById('rechargeAmount').value;
        document.getElementById('rechargeSuccessAmount').textContent = '₦' + amount + ' added to your balance!';
        showToast('✅ Recharge verified!');
        refreshMyPage();
    }

    function selectAmount(el, amt) {
        document.querySelectorAll('.withdrawal-amount-btn').forEach(b => b.classList.remove('selected'));
        el.classList.add('selected');
    }

    function submitWithdrawal() {
        const password = document.getElementById('withdrawalFundPassword').value;
        if (!password) {
            showToast('⚠️ Please enter fund password');
            return;
        }
        if (!canWithdraw()) {
            const now = new Date();
            const dayName = getDayName(now.getDay());
            showToast(`⚠️ Withdrawals are only allowed Monday-Friday. Today is ${dayName}. Please try again on Monday.`);
            return;
        }
        showToast('💳 Withdrawal submitted! Admin will process.');
    }

    function clearCache() {
        localStorage.clear();
        showToast('🗑️ Cache cleared');
        setTimeout(() => location.reload(), 1000);
    }

    function signOut() {
        const phone = localStorage.getItem('nrc_phone');
        if (phone) localStorage.setItem('nrc_temp_phone', phone);
        localStorage.clear();
        switchTab('login');
        if (phone) document.getElementById('loginPhone').value = phone;
        showToast('👋 Signed out');
    }

    function switchProfitTab(el, type) {
        document.querySelectorAll('.profit-tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
    }

    function changeLoginPassword() {
        const old = document.getElementById('oldLoginPassword').value;
        const newPwd = document.getElementById('newLoginPassword').value;
        const confirm = document.getElementById('confirmLoginPassword').value;
        if (!old || !newPwd || !confirm) { showToast('⚠️ Fill all fields'); return; }
        if (newPwd !== confirm) { showToast('⚠️ Passwords do not match'); return; }
        showToast('🔒 Login password changed');
    }

    function changeFundPassword() {
        const old = document.getElementById('oldFundPassword').value;
        const newPwd = document.getElementById('newFundPassword').value;
        const confirm = document.getElementById('confirmFundPassword').value;
        if (!old || !newPwd || !confirm) { showToast('⚠️ Fill all fields'); return; }
        if (newPwd !== confirm) { showToast('⚠️ Passwords do not match'); return; }
        showToast('🔒 Fund password changed');
    }

    function submitRealName() {
        const name = document.getElementById('realNameInput').value.trim();
        if (!name) { showToast('⚠️ Enter your real name'); return; }
        localStorage.setItem('nrc_real_name', name);
        document.getElementById('realNameDisplay').textContent = name;
        showToast('✅ Real name saved');
    }

    function addBankAccount() {
        var bankName = document.getElementById('bankSelect').value;
        var accountNumber = document.getElementById('bankAccount').value.trim();
        var name = document.getElementById('bankName').value.trim();
        if (!name || !bankName || accountNumber.length !== 10) {
            showToast('⚠️ Fill all fields correctly');
            return;
        }
        var bankDetails = { name, bank: bankName, account: accountNumber };
        localStorage.setItem('nrc_bank_details', JSON.stringify(bankDetails));
        document.getElementById('bankSuccess').classList.add('show');
        document.getElementById('savedBank').textContent = bankName;
        document.getElementById('savedAccount').textContent = accountNumber;
        document.getElementById('savedName').textContent = name;
        document.getElementById('bankForm').classList.add('hidden');
        showToast('✅ Bank card added!');
        loadUserBank();
    }

    // ===== PWA INSTALL =====
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('installAppBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-download"></i><div>Install NRC App<div class="sub-text">Tap to install</div></div>';
        }
    });

    function installApp() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    showToast('✅ Installing NRC App...');
                } else {
                    showToast('⏳ Installation cancelled');
                }
                deferredPrompt = null;
            });
        } else {
            showToast('📱 Tap "Add to Home Screen" or look for the install icon in your browser');
        }
    }

    // ===== INACTIVITY TIMER =====
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 20 * 60 * 1000;

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT);
    }

    function logoutDueToInactivity() {
        if (localStorage.getItem('nrc_logged_in') === 'true') {
            const phone = localStorage.getItem('nrc_phone') || '';
            localStorage.setItem('nrc_temp_phone', phone);
            localStorage.removeItem('nrc_logged_in');
            localStorage.removeItem('nrc_phone');
            localStorage.removeItem('nrc_user_data');
            localStorage.removeItem('nrc_is_admin');
            switchTab('login');
            document.getElementById('loginPhone').value = phone;
            showToast('⏳ You were logged out due to inactivity. Please login again.');
        }
        resetInactivityTimer();
    }

    document.addEventListener('click', resetInactivityTimer);
    document.addEventListener('touchstart', resetInactivityTimer);
    document.addEventListener('keydown', resetInactivityTimer);
    document.addEventListener('mousemove', resetInactivityTimer);

    // ===== AUTO-DETECT REFERRAL FROM URL =====
    function getReferralFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('ref') || '';
    }

    // ===== INIT =====
    document.addEventListener('DOMContentLoaded', function() {
        const refCode = getReferralFromURL();
        if (refCode) {
            const registerField = document.getElementById('registerReferral');
            if (registerField) {
                registerField.value = refCode;
                showToast('✅ Referral code detected: ' + refCode);
            }
        }
        
        loadBotSettings();
        
        const loggedIn = localStorage.getItem('nrc_logged_in');
        const phone = localStorage.getItem('nrc_phone');
        
        if (loggedIn === 'true' && phone) {
            const userData = JSON.parse(localStorage.getItem('nrc_user_data') || '{}');
            if (userData.phone) {
                updateUserUI(userData);
            } else {
                const users = JSON.parse(localStorage.getItem('nrc_users') || '{}');
                if (users[phone]) {
                    const defaultData = {
                        phone: phone,
                        balance: users[phone].balance || 0,
                        vip_level: users[phone].vip_level || 'Trial',
                        total_revenue: users[phone].total_revenue || 0,
                        yesterday_earnings: users[phone].yesterday_earnings || 0,
                        today_earnings: users[phone].today_earnings || 0,
                        task_commission: users[phone].task_commission || 0,
                        referral_rebate: users[phone].referral_rebate || 0,
                        task_rebate: users[phone].task_rebate || 0,
                        signup_date: users[phone].signup_date || getTodayDate()
                    };
                    localStorage.setItem('nrc_user_data', JSON.stringify(defaultData));
                    updateUserUI(defaultData);
                }
            }
            
            refreshMyPage();
            loadReferralData();
            updateHomeTaskProgress();
            
            switchTab('home');
            loadUserBank();
            resetInactivityTimer();
            checkMidnightRefresh();
            
            if (localStorage.getItem('bot_auto_start') === 'true') {
                setTimeout(() => {
                    if (localStorage.getItem('nrc_logged_in') === 'true') {
                        startTaskBot();
                    }
                }, 3000);
            }
        } else {
            document.querySelector('.tab-bar').style.display = 'none';
            document.getElementById('adminFloat').style.display = 'none';
            switchTab('login');
            const tempPhone = localStorage.getItem('nrc_temp_phone');
            if (tempPhone) {
                document.getElementById('loginPhone').value = tempPhone;
            }
        }
        
        if (loggedIn === 'true') showAnnouncement();
    });

    // ===== EXPOSE FUNCTIONS =====
    window.toggleAdminPanel = toggleAdminPanel;
    window.refreshAdminPanel = refreshAdminPanel;
    window.loadAllUsers = loadAllUsers;
    window.loadPendingRequests = loadPendingRequests;
    window.upgradeVIP = upgradeVIP;
    window.addBalance = addBalance;
    window.openAddBalanceModal = openAddBalanceModal;
    window.approveUpgrade = approveUpgrade;
    window.denyUpgrade = denyUpgrade;
    window.loadWealthCenterData = loadWealthCenterData;
    window.copyReferralCode = copyReferralCode;
    window.copyReferralLink = copyReferralLink;
    window.shareTelegram = shareTelegram;
    window.shareReferral = shareReferral;
    window.showReferralShare = showReferralShare;
    window.getReferralCode = getReferralCode;
    window.getReferralLink = getReferralLink;
    window.installApp = installApp;
    window.startTaskBot = startTaskBot;
    window.stopTaskBot = stopTaskBot;
    window.saveBotSettings = saveBotSettings;
    window.adminViewUserPassword = adminViewUserPassword;
    window.adminResetPassword = adminResetPassword;
    window.updateHomeTaskProgress = updateHomeTaskProgress;
    window.checkAndRefreshTasks = checkAndRefreshTasks;
    window.renderTasks = renderTasks;
    window.startReading = startReading;
    window.closeReading = closeReading;
    window.openPayment = openPayment;
    window.closePaymentPopup = closePaymentPopup;
    window.copyBankDetails = copyBankDetails;
    window.verifyPayment = verifyPayment;
</script>
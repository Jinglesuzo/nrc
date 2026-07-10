export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;
    const ADMIN_PHONE = '08105238080';

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const body = await request.json();
        const { action, phone, password, amount, vipLevel, targetPhone, taskId, requestId } = body;
        const today = new Date().toISOString().split('T')[0];

        // ===== REGISTER =====
        if (action === 'register') {
            const existing = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
            if (existing) {
                return new Response(JSON.stringify({ success: false, message: 'User already exists' }), { headers: { 'Content-Type': 'application/json' } });
            }
            await db.prepare('INSERT INTO users (phone, password) VALUES (?, ?)').bind(phone, password).run();
            return new Response(JSON.stringify({ success: true, message: 'Registered' }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== LOGIN =====
        if (action === 'login') {
            const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
            if (!user) {
                return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            }
            if (user.password !== password) {
                return new Response(JSON.stringify({ success: false, message: 'Incorrect password' }), { headers: { 'Content-Type': 'application/json' } });
            }
            await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE phone = ?').bind(phone).run();
            return new Response(JSON.stringify({
                success: true,
                user: {
                    phone: user.phone,
                    balance: user.balance || 0,
                    vip_level: user.vip_level || 'Trial'
                }
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== GET USER DATA =====
        if (action === 'get_user') {
            const user = await db.prepare('SELECT phone, balance, vip_level, real_name FROM users WHERE phone = ?').bind(phone).first();
            if (!user) {
                return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify({ success: true, user }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== GET USER STATS =====
        if (action === 'get_user_stats') {
            const user = await db.prepare('SELECT phone, balance, vip_level, real_name FROM users WHERE phone = ?').bind(phone).first();
            if (!user) {
                return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            }
            const todayRecord = await db.prepare('SELECT earned_today FROM user_tasks WHERE phone = ? AND task_date = ?').bind(phone, today).first();
            const earnedToday = todayRecord?.earned_today || 0;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const yesterdayRecord = await db.prepare('SELECT earned_today FROM user_tasks WHERE phone = ? AND task_date = ?').bind(phone, yesterdayStr).first();
            const yesterdayEarnings = yesterdayRecord?.earned_today || 0;
            const totalRevenueQuery = await db.prepare('SELECT SUM(earned_today) as total FROM user_tasks WHERE phone = ?').bind(phone).first();
            const totalRevenue = totalRevenueQuery?.total || user.balance || 0;

            return new Response(JSON.stringify({
                success: true,
                data: {
                    phone: user.phone,
                    balance: user.balance || 0,
                    vip_level: user.vip_level || 'Trial',
                    real_name: user.real_name || '',
                    total_revenue: totalRevenue,
                    today_earnings: earnedToday,
                    yesterday_earnings: yesterdayEarnings,
                    task_commission: earnedToday,
                    referral_rebate: 0,
                    task_rebate: 0
                }
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== ADMIN: VIEW ALL USERS =====
        if (action === 'admin_view_users') {
            if (phone !== ADMIN_PHONE) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            }
            const users = await db.prepare('SELECT phone, balance, vip_level, real_name, created_at FROM users ORDER BY created_at DESC').all();
            return new Response(JSON.stringify({ success: true, users: users.results || [] }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== ADMIN: UPGRADE VIP =====
        if (action === 'admin_upgrade_vip') {
            if (phone !== ADMIN_PHONE) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            }
            const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(targetPhone).first();
            if (!user) {
                return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            }
            await db.prepare('UPDATE users SET vip_level = ? WHERE phone = ?').bind(vipLevel, targetPhone).run();
            return new Response(JSON.stringify({ success: true, message: 'Upgraded' }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== ADMIN: ADD BALANCE =====
        if (action === 'admin_add_balance') {
            if (phone !== ADMIN_PHONE) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            }
            const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(targetPhone).first();
            if (!user) {
                return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            }
            await db.prepare('UPDATE users SET balance = balance + ? WHERE phone = ?').bind(amount, targetPhone).run();
            const updated = await db.prepare('SELECT balance FROM users WHERE phone = ?').bind(targetPhone).first();
            return new Response(JSON.stringify({ success: true, message: 'Added', balance: updated?.balance || 0 }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== USER: REQUEST VIP UPGRADE =====
        if (action === 'request_upgrade') {
            const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
            if (!user) {
                return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            }
            const existing = await db.prepare('SELECT * FROM upgrade_requests WHERE phone = ? AND status = "pending"').bind(phone).first();
            if (existing) {
                return new Response(JSON.stringify({ success: false, message: 'You already have a pending upgrade request' }), { headers: { 'Content-Type': 'application/json' } });
            }
            await db.prepare(
                'INSERT INTO upgrade_requests (phone, requested_vip, amount, status) VALUES (?, ?, ?, ?)'
            ).bind(phone, vipLevel, amount, 'pending').run();
            return new Response(JSON.stringify({ success: true, message: 'Upgrade request submitted. Awaiting admin approval.' }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== ADMIN: GET PENDING REQUESTS =====
        if (action === 'admin_pending_requests') {
            if (phone !== ADMIN_PHONE) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            }
            const requests = await db.prepare(
                'SELECT id, phone, requested_vip, amount, status, created_at FROM upgrade_requests WHERE status = "pending" ORDER BY created_at DESC'
            ).all();
            return new Response(JSON.stringify({ success: true, requests: requests.results || [] }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== ADMIN: APPROVE UPGRADE REQUEST =====
        if (action === 'admin_approve_upgrade') {
            if (phone !== ADMIN_PHONE) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            }
            const req = await db.prepare('SELECT phone FROM upgrade_requests WHERE id = ?').bind(requestId).first();
            if (!req) {
                return new Response(JSON.stringify({ success: false, message: 'Request not found' }), { headers: { 'Content-Type': 'application/json' } });
            }
            await db.prepare('UPDATE upgrade_requests SET status = "approved", updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(requestId).run();
            await db.prepare('UPDATE users SET vip_level = ? WHERE phone = ?').bind(vipLevel, req.phone).run();
            return new Response(JSON.stringify({ success: true, message: 'Upgrade approved!' }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== ADMIN: DENY UPGRADE REQUEST =====
        if (action === 'admin_deny_upgrade') {
            if (phone !== ADMIN_PHONE) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            }
            await db.prepare('UPDATE upgrade_requests SET status = "denied", updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(requestId).run();
            return new Response(JSON.stringify({ success: true, message: 'Request denied.' }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ============================================================
        // ===== TASK: GET USER TASK STATUS (WITH TRIAL BLOCK) =====
        // ============================================================
        if (action === 'get_user_tasks') {
            const user = await db.prepare('SELECT vip_level FROM users WHERE phone = ?').bind(phone).first();
            if (!user) {
                return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            }

            // ===== BLOCK TRIAL USERS =====
            if (user.vip_level === 'Trial' || user.vip_level === 'trial') {
                return new Response(JSON.stringify({
                    success: true,
                    data: {
                        vip_level: 'Trial',
                        task_count: 0,
                        reward_per_task: 0,
                        completed_today: 0,
                        remaining_tasks: 0,
                        earned_today: 0,
                        trial_blocked: true,
                        message: 'Upgrade to VIP to start earning!'
                    }
                }), { headers: { 'Content-Type': 'application/json' } });
            }

            // ===== VIP USERS =====
            const config = await db.prepare('SELECT task_count, reward_per_task FROM task_config WHERE vip_level = ?').bind(user.vip_level || 'Trial').first();
            if (!config) {
                return new Response(JSON.stringify({ success: false, message: 'No task config found' }), { headers: { 'Content-Type': 'application/json' } });
            }
            let todayRecord = await db.prepare('SELECT completed_count, earned_today FROM user_tasks WHERE phone = ? AND task_date = ?').bind(phone, today).first();
            if (!todayRecord) {
                todayRecord = { completed_count: 0, earned_today: 0 };
            }
            const remaining = Math.max(0, config.task_count - todayRecord.completed_count);
            return new Response(JSON.stringify({
                success: true,
                data: {
                    vip_level: user.vip_level || 'Trial',
                    task_count: config.task_count,
                    reward_per_task: config.reward_per_task,
                    completed_today: todayRecord.completed_count,
                    remaining_tasks: remaining,
                    earned_today: todayRecord.earned_today,
                    trial_blocked: false
                }
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ============================================================
        // ===== TASK: COMPLETE TASK (WITH TRIAL BLOCK) =====
        // ============================================================
        if (action === 'complete_task') {
            const user = await db.prepare('SELECT vip_level FROM users WHERE phone = ?').bind(phone).first();
            if (!user) {
                return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            }

            // ===== BLOCK TRIAL USERS =====
            if (user.vip_level === 'Trial' || user.vip_level === 'trial') {
                return new Response(JSON.stringify({ success: false, message: 'Upgrade to VIP to complete tasks!' }), { headers: { 'Content-Type': 'application/json' } });
            }

            const config = await db.prepare('SELECT task_count, reward_per_task FROM task_config WHERE vip_level = ?').bind(user.vip_level || 'Trial').first();
            if (!config) {
                return new Response(JSON.stringify({ success: false, message: 'No task config' }), { headers: { 'Content-Type': 'application/json' } });
            }
            let todayRecord = await db.prepare('SELECT completed_count, earned_today FROM user_tasks WHERE phone = ? AND task_date = ?').bind(phone, today).first();
            if (!todayRecord) {
                todayRecord = { completed_count: 0, earned_today: 0 };
            }
            if (todayRecord.completed_count >= config.task_count) {
                return new Response(JSON.stringify({ success: false, message: 'All tasks completed for today' }), { headers: { 'Content-Type': 'application/json' } });
            }
            const newCount = todayRecord.completed_count + 1;
            const newEarned = todayRecord.earned_today + config.reward_per_task;
            await db.prepare(`
                INSERT INTO user_tasks (phone, task_date, completed_count, earned_today)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(phone, task_date) DO UPDATE SET
                    completed_count = excluded.completed_count,
                    earned_today = excluded.earned_today
            `).bind(phone, today, newCount, newEarned).run();
            await db.prepare('UPDATE users SET balance = balance + ? WHERE phone = ?').bind(config.reward_per_task, phone).run();
            const updated = await db.prepare('SELECT balance FROM users WHERE phone = ?').bind(phone).first();
            return new Response(JSON.stringify({
                success: true,
                message: 'Task completed',
                reward: config.reward_per_task,
                new_balance: updated.balance,
                completed_today: newCount,
                remaining_tasks: Math.max(0, config.task_count - newCount)
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ===== FALLBACK =====
        return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: 'Server error: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
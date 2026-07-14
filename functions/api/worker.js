// ===== CLOUDFLARE WORKER - COMPLETE WITH ADMIN NUMBER =====

const ADMIN_PHONE = '08105238080';  // <-- ADMIN NUMBER ADDED HERE

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
        
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers });
        }
        
        // Only handle /api/users
        if (path !== '/api/users') {
            return new Response(JSON.stringify({ 
                success: false, 
                message: 'Not found' 
            }), { status: 404, headers });
        }
        
        try {
            const body = await request.json();
            const action = body.action;
            
            // ===== GET TODAY DATE =====
            function getTodayDate() {
                const now = new Date();
                return now.getFullYear() + '-' + 
                       String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(now.getDate()).padStart(2, '0');
            }
            
            // ===== GET USER TASKS =====
            if (action === 'get_user_tasks') {
                const phone = body.phone;
                const today = getTodayDate();
                
                // Get user VIP level
                let vipLevel = 'Trial';
                if (env.DB) {
                    const user = await env.DB.prepare(
                        'SELECT vip_level FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    if (user) vipLevel = user.vip_level;
                }
                
                const taskCounts = {
                    'Trial': 6, 'VIP1': 12, 'VIP2': 24, 'VIP3': 48,
                    'VIP4': 80, 'VIP5': 120, 'VIP6': 160, 'VIP7': 220,
                    'VIP8': 300, 'VIP9': 400
                };
                const rewards = {
                    'Trial': 105, 'VIP1': 105, 'VIP2': 150, 'VIP3': 250,
                    'VIP4': 400, 'VIP5': 800, 'VIP6': 1600, 'VIP7': 1800,
                    'VIP8': 2200, 'VIP9': 3500
                };
                
                const totalTasks = taskCounts[vipLevel] || 6;
                const reward = rewards[vipLevel] || 105;
                
                let completed = 0;
                let earnedToday = 0;
                
                if (env.DB) {
                    // Check if tasks exist for today
                    const task = await env.DB.prepare(
                        'SELECT * FROM tasks WHERE phone = ? AND date = ?'
                    ).bind(phone, today).first();
                    
                    if (task) {
                        completed = task.completed_tasks || 0;
                        earnedToday = task.earned_today || 0;
                    } else {
                        // Create new tasks for today
                        await env.DB.prepare(
                            `INSERT INTO tasks (phone, date, total_tasks, completed_tasks, reward_per_task, earned_today, vip_level)
                             VALUES (?, ?, ?, 0, ?, 0, ?)`
                        ).bind(phone, today, totalTasks, reward, vipLevel).run();
                    }
                }
                
                const remaining = Math.max(0, totalTasks - completed);
                
                return new Response(JSON.stringify({
                    success: true,
                    data: {
                        vip_level: vipLevel,
                        total_tasks: totalTasks,
                        completed_tasks: completed,
                        remaining_tasks: remaining,
                        reward_per_task: reward,
                        earned_today: earnedToday
                    }
                }), { headers });
            }
            
            // ===== COMPLETE TASK =====
            if (action === 'complete_task') {
                const { phone, taskId, date } = body;
                const today = date || getTodayDate();
                
                // Get user's reward amount
                let vipLevel = 'Trial';
                if (env.DB) {
                    const user = await env.DB.prepare(
                        'SELECT vip_level FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    if (user) vipLevel = user.vip_level;
                }
                
                const rewards = {
                    'Trial': 105, 'VIP1': 105, 'VIP2': 150, 'VIP3': 250,
                    'VIP4': 400, 'VIP5': 800, 'VIP6': 1600, 'VIP7': 1800,
                    'VIP8': 2200, 'VIP9': 3500
                };
                const reward = rewards[vipLevel] || 105;
                
                if (env.DB) {
                    // Check if tasks exist for today
                    let task = await env.DB.prepare(
                        'SELECT * FROM tasks WHERE phone = ? AND date = ?'
                    ).bind(phone, today).first();
                    
                    if (!task) {
                        // Create new tasks
                        const taskCounts = {
                            'Trial': 6, 'VIP1': 12, 'VIP2': 24, 'VIP3': 48,
                            'VIP4': 80, 'VIP5': 120, 'VIP6': 160, 'VIP7': 220,
                            'VIP8': 300, 'VIP9': 400
                        };
                        const totalTasks = taskCounts[vipLevel] || 6;
                        
                        await env.DB.prepare(
                            `INSERT INTO tasks (phone, date, total_tasks, completed_tasks, reward_per_task, earned_today, vip_level)
                             VALUES (?, ?, ?, 0, ?, 0, ?)`
                        ).bind(phone, today, totalTasks, reward, vipLevel).run();
                        
                        task = await env.DB.prepare(
                            'SELECT * FROM tasks WHERE phone = ? AND date = ?'
                        ).bind(phone, today).first();
                    }
                    
                    // Check if all tasks completed
                    if (task.completed_tasks >= task.total_tasks) {
                        return new Response(JSON.stringify({
                            success: false,
                            message: 'All tasks completed for today'
                        }), { headers });
                    }
                    
                    // Update task completion
                    const newCompleted = (task.completed_tasks || 0) + 1;
                    const newEarned = (task.earned_today || 0) + reward;
                    
                    await env.DB.prepare(
                        `UPDATE tasks 
                         SET completed_tasks = ?, earned_today = ? 
                         WHERE phone = ? AND date = ?`
                    ).bind(newCompleted, newEarned, phone, today).run();
                    
                    // Update user balance
                    await env.DB.prepare(
                        'UPDATE users SET balance = balance + ? WHERE phone = ?'
                    ).bind(reward, phone).run();
                    
                    // Get updated user data
                    const user = await env.DB.prepare(
                        'SELECT balance, vip_level FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Task completed',
                        reward: reward,
                        new_balance: user?.balance || 0,
                        completed_today: newCompleted,
                        total_tasks: task.total_tasks
                    }), { headers });
                }
                
                // Fallback for KV
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Task completed (KV)',
                    reward: reward,
                    new_balance: 0,
                    completed_today: 1,
                    total_tasks: 6
                }), { headers });
            }
            
            // ===== REFRESH TASKS (Midnight Reset) =====
            if (action === 'refresh_tasks') {
                const { phone, date } = body;
                const today = date || getTodayDate();
                
                // Get user VIP level
                let vipLevel = 'Trial';
                if (env.DB) {
                    const user = await env.DB.prepare(
                        'SELECT vip_level FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    if (user) vipLevel = user.vip_level;
                }
                
                const taskCounts = {
                    'Trial': 6, 'VIP1': 12, 'VIP2': 24, 'VIP3': 48,
                    'VIP4': 80, 'VIP5': 120, 'VIP6': 160, 'VIP7': 220,
                    'VIP8': 300, 'VIP9': 400
                };
                const rewards = {
                    'Trial': 105, 'VIP1': 105, 'VIP2': 150, 'VIP3': 250,
                    'VIP4': 400, 'VIP5': 800, 'VIP6': 1600, 'VIP7': 1800,
                    'VIP8': 2200, 'VIP9': 3500
                };
                
                const totalTasks = taskCounts[vipLevel] || 6;
                const reward = rewards[vipLevel] || 105;
                
                if (env.DB) {
                    // Insert or replace tasks for today
                    await env.DB.prepare(
                        `INSERT INTO tasks (phone, date, total_tasks, completed_tasks, reward_per_task, earned_today, vip_level)
                         VALUES (?, ?, ?, 0, ?, 0, ?)
                         ON CONFLICT(phone, date) DO UPDATE SET
                         total_tasks = excluded.total_tasks,
                         completed_tasks = 0,
                         reward_per_task = excluded.reward_per_task,
                         earned_today = 0,
                         vip_level = excluded.vip_level`
                    ).bind(phone, today, totalTasks, reward, vipLevel).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Tasks refreshed for today',
                        data: {
                            total_tasks: totalTasks,
                            reward_per_task: reward,
                            vip_level: vipLevel
                        }
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Tasks refreshed (KV)'
                }), { headers });
            }
            
            // ===== GET USER =====
            if (action === 'get_user') {
                const phone = body.phone;
                if (env.DB) {
                    const user = await env.DB.prepare(
                        'SELECT phone, password, vip_level, balance, signup_date FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    
                    if (user) {
                        return new Response(JSON.stringify({
                            success: true,
                            user: user
                        }), { headers });
                    }
                }
                return new Response(JSON.stringify({
                    success: false,
                    message: 'User not found'
                }), { headers });
            }
            
            // ===== GET USER STATS =====
            if (action === 'get_user_stats') {
                const phone = body.phone;
                
                if (env.DB) {
                    const user = await env.DB.prepare(
                        'SELECT balance, vip_level FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    
                    if (user) {
                        return new Response(JSON.stringify({
                            success: true,
                            data: user
                        }), { headers });
                    }
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    data: {
                        balance: 0,
                        vip_level: 'Trial'
                    }
                }), { headers });
            }
            
            // ===== LOGIN =====
            if (action === 'login') {
                const { phone, password } = body;
                
                if (env.DB) {
                    const user = await env.DB.prepare(
                        'SELECT * FROM users WHERE phone = ? AND password = ?'
                    ).bind(phone, password).first();
                    
                    if (user) {
                        return new Response(JSON.stringify({
                            success: true,
                            user: user
                        }), { headers });
                    }
                }
                
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Invalid credentials'
                }), { headers });
            }
            
            // ===== REGISTER =====
            if (action === 'register') {
                const { phone, password, referral_code, own_referral_code } = body;
                
                if (env.DB) {
                    const existing = await env.DB.prepare(
                        'SELECT phone FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    
                    if (existing) {
                        return new Response(JSON.stringify({
                            success: false,
                            message: 'User already exists'
                        }), { headers });
                    }
                    
                    await env.DB.prepare(
                        'INSERT INTO users (phone, password, vip_level, balance, signup_date, referral_code) VALUES (?, ?, ?, ?, ?, ?)'
                    ).bind(phone, password, 'Trial', 0, getTodayDate(), own_referral_code).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'User registered successfully'
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'User registered successfully (KV)'
                }), { headers });
            }
            
            // ===== ADMIN VIEW USERS =====
            if (action === 'admin_view_users') {
                const { phone } = body;
                if (phone !== ADMIN_PHONE) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Unauthorized'
                    }), { status: 401, headers });
                }
                
                if (env.DB) {
                    const users = await env.DB.prepare(
                        'SELECT phone, password, vip_level, balance FROM users'
                    ).all();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        users: users.results || []
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    users: []
                }), { headers });
            }
            
            // ===== ADMIN UPGRADE VIP =====
            if (action === 'admin_upgrade_vip') {
                const { phone, targetPhone, vipLevel } = body;
                if (phone !== ADMIN_PHONE) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Unauthorized'
                    }), { status: 401, headers });
                }
                
                if (env.DB) {
                    await env.DB.prepare(
                        'UPDATE users SET vip_level = ? WHERE phone = ?'
                    ).bind(vipLevel, targetPhone).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'VIP upgraded'
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'VIP upgraded (KV)'
                }), { headers });
            }
            
            // ===== ADMIN ADD BALANCE =====
            if (action === 'admin_add_balance') {
                const { phone, targetPhone, amount } = body;
                if (phone !== ADMIN_PHONE) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Unauthorized'
                    }), { status: 401, headers });
                }
                
                if (env.DB) {
                    await env.DB.prepare(
                        'UPDATE users SET balance = balance + ? WHERE phone = ?'
                    ).bind(amount, targetPhone).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Balance added'
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Balance added (KV)'
                }), { headers });
            }
            
            // ===== ADMIN GET USER =====
            if (action === 'admin_get_user') {
                const { adminPhone, targetPhone } = body;
                if (adminPhone !== ADMIN_PHONE) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Unauthorized'
                    }), { status: 401, headers });
                }
                
                if (env.DB) {
                    const user = await env.DB.prepare(
                        'SELECT phone, password, vip_level, balance, signup_date FROM users WHERE phone = ?'
                    ).bind(targetPhone).first();
                    
                    if (user) {
                        return new Response(JSON.stringify({
                            success: true,
                            user: user
                        }), { headers });
                    }
                }
                
                return new Response(JSON.stringify({
                    success: false,
                    message: 'User not found'
                }), { headers });
            }
            
            // ===== ADMIN RESET PASSWORD =====
            if (action === 'admin_reset_password') {
                const { adminPhone, targetPhone, newPassword } = body;
                if (adminPhone !== ADMIN_PHONE) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Unauthorized'
                    }), { status: 401, headers });
                }
                
                if (env.DB) {
                    await env.DB.prepare(
                        'UPDATE users SET password = ? WHERE phone = ?'
                    ).bind(newPassword, targetPhone).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Password reset successful'
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Password reset (KV)'
                }), { headers });
            }
            
            // ===== ADMIN PENDING REQUESTS =====
            if (action === 'admin_pending_requests') {
                const { phone } = body;
                if (phone !== ADMIN_PHONE) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Unauthorized'
                    }), { status: 401, headers });
                }
                
                if (env.DB) {
                    const requests = await env.DB.prepare(
                        'SELECT * FROM upgrade_requests WHERE status = "pending" ORDER BY created_at DESC'
                    ).all();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        requests: requests.results || []
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    requests: []
                }), { headers });
            }
            
            // ===== ADMIN APPROVE UPGRADE =====
            if (action === 'admin_approve_upgrade') {
                const { phone, requestId, vipLevel } = body;
                if (phone !== ADMIN_PHONE) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Unauthorized'
                    }), { status: 401, headers });
                }
                
                if (env.DB) {
                    // Get request details
                    const request = await env.DB.prepare(
                        'SELECT * FROM upgrade_requests WHERE id = ? AND status = "pending"'
                    ).bind(requestId).first();
                    
                    if (!request) {
                        return new Response(JSON.stringify({
                            success: false,
                            message: 'Request not found'
                        }), { headers });
                    }
                    
                    // Update user VIP
                    await env.DB.prepare(
                        'UPDATE users SET vip_level = ? WHERE phone = ?'
                    ).bind(vipLevel, request.phone).run();
                    
                    // Mark request as approved
                    await env.DB.prepare(
                        'UPDATE upgrade_requests SET status = "approved" WHERE id = ?'
                    ).bind(requestId).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Upgrade approved'
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Upgrade approved (KV)'
                }), { headers });
            }
            
            // ===== ADMIN DENY UPGRADE =====
            if (action === 'admin_deny_upgrade') {
                const { phone, requestId } = body;
                if (phone !== ADMIN_PHONE) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: 'Unauthorized'
                    }), { status: 401, headers });
                }
                
                if (env.DB) {
                    await env.DB.prepare(
                        'UPDATE upgrade_requests SET status = "denied" WHERE id = ?'
                    ).bind(requestId).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Request denied'
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Request denied (KV)'
                }), { headers });
            }
            
            // ===== REQUEST UPGRADE =====
            if (action === 'request_upgrade') {
                const { phone, vipLevel, amount } = body;
                
                if (env.DB) {
                    await env.DB.prepare(
                        `INSERT INTO upgrade_requests (phone, requested_vip, amount, status, created_at)
                         VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)`
                    ).bind(phone, vipLevel, amount).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Upgrade request submitted'
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Upgrade request submitted (KV)'
                }), { headers });
            }
            
            // ===== DEFAULT =====
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid action'
            }), { headers });
            
        } catch (e) {
            console.error('Worker error:', e);
            return new Response(JSON.stringify({
                success: false,
                message: e.message
            }), { status: 500, headers });
        }
    }
};
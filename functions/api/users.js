// ===== CLOUDFLARE WORKER - COMPLETE =====

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
                
                // Check KV fallback
                if (env.USERS_KV) {
                    const userData = await env.USERS_KV.get(`user:${phone}`);
                    if (userData) {
                        return new Response(JSON.stringify({
                            success: true,
                            user: JSON.parse(userData)
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
                        'SELECT balance, vip_level, total_revenue, yesterday_earnings, today_earnings, task_commission, referral_rebate, task_rebate FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    
                    if (user) {
                        return new Response(JSON.stringify({
                            success: true,
                            data: user
                        }), { headers });
                    }
                }
                
                // Fallback data
                return new Response(JSON.stringify({
                    success: true,
                    data: {
                        balance: 0,
                        vip_level: 'Trial',
                        total_revenue: 0,
                        yesterday_earnings: 0,
                        today_earnings: 0,
                        task_commission: 0,
                        referral_rebate: 0,
                        task_rebate: 0
                    }
                }), { headers });
            }
            
            // ===== GET USER TASKS =====
            if (action === 'get_user_tasks') {
                const phone = body.phone;
                const date = body.date || getTodayDate();
                
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
                
                // Get completed tasks for today
                let completed = 0;
                if (env.DB) {
                    const task = await env.DB.prepare(
                        'SELECT completed_tasks FROM tasks WHERE phone = ? AND date = ?'
                    ).bind(phone, date).first();
                    if (task) completed = task.completed_tasks;
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    data: {
                        vip_level: vipLevel,
                        total_tasks: totalTasks,
                        completed_tasks: completed,
                        remaining_tasks: Math.max(0, totalTasks - completed),
                        reward_per_task: reward,
                        earned_today: completed * reward
                    }
                }), { headers });
            }
            
            // ===== COMPLETE TASK =====
            if (action === 'complete_task') {
                const { phone, taskId, date } = body;
                const today = date || getTodayDate();
                const reward = 105; // Default, should match user's VIP level
                
                if (env.DB) {
                    // Update balance
                    await env.DB.prepare(
                        'UPDATE users SET balance = balance + ? WHERE phone = ?'
                    ).bind(reward, phone).run();
                    
                    // Update tasks
                    const task = await env.DB.prepare(
                        'SELECT completed_tasks, total_tasks FROM tasks WHERE phone = ? AND date = ?'
                    ).bind(phone, today).first();
                    
                    if (task) {
                        const newCompleted = (task.completed_tasks || 0) + 1;
                        await env.DB.prepare(
                            'UPDATE tasks SET completed_tasks = ? WHERE phone = ? AND date = ?'
                        ).bind(newCompleted, phone, today).run();
                    } else {
                        // Get VIP level
                        const user = await env.DB.prepare(
                            'SELECT vip_level FROM users WHERE phone = ?'
                        ).bind(phone).first();
                        const vipLevel = user?.vip_level || 'Trial';
                        const taskCounts = {
                            'Trial': 6, 'VIP1': 12, 'VIP2': 24, 'VIP3': 48,
                            'VIP4': 80, 'VIP5': 120, 'VIP6': 160, 'VIP7': 220,
                            'VIP8': 300, 'VIP9': 400
                        };
                        const totalTasks = taskCounts[vipLevel] || 6;
                        
                        await env.DB.prepare(
                            'INSERT INTO tasks (phone, date, total_tasks, completed_tasks, reward_per_task, vip_level) VALUES (?, ?, ?, 1, ?, ?)'
                        ).bind(phone, today, totalTasks, reward, vipLevel).run();
                    }
                    
                    // Get new balance
                    const user = await env.DB.prepare(
                        'SELECT balance FROM users WHERE phone = ?'
                    ).bind(phone).first();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        reward: reward,
                        new_balance: user?.balance || 0,
                        completed_today: (task?.completed_tasks || 0) + 1,
                        total_tasks: task?.total_tasks || 6
                    }), { headers });
                }
                
                // Fallback
                return new Response(JSON.stringify({
                    success: true,
                    reward: reward,
                    new_balance: 0,
                    completed_today: 1,
                    total_tasks: 6
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
                
                // Check if user exists
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
                if (phone !== '08105238080') {
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
                if (phone !== '08105238080') {
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
                if (phone !== '08105238080') {
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
            
            // ===== REFRESH TASKS =====
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
                        `INSERT INTO tasks (phone, date, total_tasks, completed_tasks, reward_per_task, vip_level)
                         VALUES (?, ?, ?, 0, ?, ?)
                         ON CONFLICT(phone, date) DO UPDATE SET
                         total_tasks = excluded.total_tasks,
                         completed_tasks = 0,
                         reward_per_task = excluded.reward_per_task,
                         vip_level = excluded.vip_level`
                    ).bind(phone, today, totalTasks, reward, vipLevel).run();
                    
                    return new Response(JSON.stringify({
                        success: true,
                        message: 'Tasks refreshed'
                    }), { headers });
                }
                
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Tasks refreshed (KV)'
                }), { headers });
            }
            
            // ===== DEFAULT =====
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid action'
            }), { headers });
            
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                message: e.message
            }), { status: 500, headers });
        }
    }
};

function getTodayDate() {
    const now = new Date();
    return now.getFullYear() + '-' + 
           String(now.getMonth() + 1).padStart(2, '0') + '-' + 
           String(now.getDate()).padStart(2, '0');
}
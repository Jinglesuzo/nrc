export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const body = await request.json();
        const { action, phone, password, amount, vipLevel } = body;

        if (action === 'register') {
            const existing = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
            if (existing) return new Response(JSON.stringify({ success: false, message: 'User already exists' }), { headers: { 'Content-Type': 'application/json' } });
            await db.prepare('INSERT INTO users (phone, password) VALUES (?, ?)').bind(phone, password).run();
            return new Response(JSON.stringify({ success: true, message: 'Registered' }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'login') {
            const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
            if (!user) return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            if (user.password !== password) return new Response(JSON.stringify({ success: false, message: 'Incorrect password' }), { headers: { 'Content-Type': 'application/json' } });
            await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE phone = ?').bind(phone).run();
            return new Response(JSON.stringify({ success: true, user: { phone: user.phone, balance: user.balance || 0, vip_level: user.vip_level || 'Trial' } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'admin_view_users') {
            const users = await db.prepare('SELECT phone, balance, vip_level, real_name, created_at FROM users ORDER BY created_at DESC').all();
            return new Response(JSON.stringify({ success: true, users: users.results || [] }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'admin_upgrade_vip') {
            const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
            if (!user) return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            await db.prepare('UPDATE users SET vip_level = ? WHERE phone = ?').bind(vipLevel, phone).run();
            return new Response(JSON.stringify({ success: true, message: 'Upgraded' }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (action === 'admin_add_balance') {
            const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
            if (!user) return new Response(JSON.stringify({ success: false, message: 'User not found' }), { headers: { 'Content-Type': 'application/json' } });
            await db.prepare('UPDATE users SET balance = balance + ? WHERE phone = ?').bind(amount, phone).run();
            const updated = await db.prepare('SELECT balance FROM users WHERE phone = ?').bind(phone).first();
            return new Response(JSON.stringify({ success: true, message: 'Added', balance: updated?.balance || 0 }), { headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: 'Server error: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
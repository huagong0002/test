import os
from flask import Flask, request, jsonify
from flask_cors import CORS

# 初始化 Flask 实例
# 在 Vercel 环境下，变量名必须为 app
app = Flask(__name__)

# 🚩 核心修正：增强 CORS 配置，确保跨域请求顺畅
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS", "DELETE"],
    "allow_headers": ["Content-Type", "Authorization", "Accept"],
    "supports_credentials": True
}})

# --- 模拟数据库存储（内存模式） ---
# 注意：Vercel Serverless 环境会定期重置，生产环境建议对接 Supabase 或 Vercel KV
GLOBAL_STORE = {
    "materials": [],
    "users": {
        "jerry": {"password": os.environ.get('ADMIN_PASSWORD', 'sdeducation'), "role": "admin", "name": "超级管理员"},
        "admin": {"password": "admin123", "role": "admin", "name": "管理员老师"},
        "test01": {"password": "123", "role": "user", "name": "测试学生"}
    }
}

# 1. 健康检查接口
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok", 
        "materials_count": len(GLOBAL_STORE["materials"]),
        "environment": "vercel"
    })

# 2. 登录接口
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "Missing JSON body"}), 400
            
        username = data.get('username', '').strip()
        password = data.get('password', '')

        user_db = GLOBAL_STORE["users"]
        if username in user_db and user_db[username]["password"] == password:
            return jsonify({
                "status": "success",
                "user": {
                    "username": username,
                    "role": user_db[username]["role"],
                    "displayName": user_db[username]["name"]
                }
            })
        
        return jsonify({"status": "fail", "message": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 3. 材料同步接口 (适配 App.tsx 第106行)
@app.route('/api/materials/sync', methods=['POST'])
def sync_materials():
    global GLOBAL_STORE
    try:
        data = request.get_json()
        if data and "materials" in data:
            GLOBAL_STORE["materials"] = data["materials"]
            return jsonify({"status": "success", "count": len(GLOBAL_STORE["materials"])})
        return jsonify({"status": "error", "message": "Invalid format"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 4. 基础材料接口 (支持 GET/POST/DELETE)
@app.route('/api/materials', methods=['GET', 'POST'])
@app.route('/api/materials/<id>', methods=['DELETE'])
def handle_materials(id=None):
    global GLOBAL_STORE
    try:
        if request.method == 'POST':
            new_item = request.get_json()
            if not new_item or 'id' not in new_item:
                return jsonify({"status": "error", "message": "Incomplete data"}), 400
            # 更新或添加
            GLOBAL_STORE["materials"] = [m for m in GLOBAL_STORE["materials"] if m.get('id') != new_item['id']]
            GLOBAL_STORE["materials"].append(new_item)
            return jsonify({"status": "success"})
        
        if request.method == 'DELETE':
            target_id = id or request.args.get('id')
            if target_id:
                GLOBAL_STORE["materials"] = [m for m in GLOBAL_STORE["materials"] if m.get('id') != target_id]
                return jsonify({"status": "success"})
        
        return jsonify(GLOBAL_STORE["materials"])
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 5. 注册接口
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        u = data.get('username', '').strip()
        p = data.get('password', '')
        if u and p:
            GLOBAL_STORE["users"][u] = {"password": p, "role": "user", "name": u}
            return jsonify({"status": "success", "user": {"username": u, "role": "user", "displayName": u}})
        return jsonify({"status": "fail", "message": "Incomplete data"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 重要：在 Vercel 部署 Flask 时，不需要 app.run() 
# 也不需要手动定义 handler 函数，Vercel 会自动识别导入的 app 对象

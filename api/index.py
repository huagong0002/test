from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
# 允许你的前端域名跨域访问
CORS(app, supports_credentials=True)

# 模拟数据库 (注意：Vercel Serverless 会定期重置内存，生产环境建议连接 Supabase 或 MongoDB)
GLOBAL_STORE = {
    "materials": [],
    "users": {
        "jerry": {"password": "sdeducation", "role": "admin", "name": "Jerry Admin"},
        "admin": {"password": "admin123", "role": "admin", "name": "systerm Admin"}
    }
}

# 1. 健康检查 (确保 Vercel 路由已通)
@app.route('/api/health', methods=['GET'])
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Backend is running"})

# 2. 登录接口
@app.route('/api/login', methods=['POST'])
@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
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
        
        return jsonify({"status": "fail", "message": "账号或密码错误"}), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 3. 材料管理核心接口 (处理 GET, POST)
@app.route('/api/materials', methods=['GET', 'POST'])
@app.route('/materials', methods=['GET', 'POST'])
def handle_materials():
    global GLOBAL_STORE
    try:
        if request.method == 'POST':
            new_item = request.get_json()
            if not new_item or 'id' not in new_item:
                return jsonify({"status": "error", "message": "数据不完整"}), 400
            
            # 更新或添加：如果 ID 存在则替换，否则追加
            GLOBAL_STORE["materials"] = [m for m in GLOBAL_STORE["materials"] if m.get('id') != new_item['id']]
            GLOBAL_STORE["materials"].append(new_item)
            return jsonify({"status": "success"})
        
        # GET 请求返回所有材料
        return jsonify(GLOBAL_STORE["materials"])
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 4. 材料同步接口 (App.tsx 专用同步逻辑)
@app.route('/api/materials/sync', methods=['POST'])
@app.route('/materials/sync', methods=['POST'])
def sync_materials():
    global GLOBAL_STORE
    try:
        data = request.get_json()
        if data and "materials" in data:
            GLOBAL_STORE["materials"] = data["materials"]
            return jsonify({"status": "success", "count": len(GLOBAL_STORE["materials"])})
        return jsonify({"status": "error", "message": "无效的数据格式"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 5. 删除材料接口
@app.route('/api/materials/<id>', methods=['DELETE'])
@app.route('/materials/<id>', methods=['DELETE'])
def delete_material(id):
    global GLOBAL_STORE
    try:
        GLOBAL_STORE["materials"] = [m for m in GLOBAL_STORE["materials"] if str(m.get('id')) != str(id)]
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 6. 注册接口
@app.route('/api/register', methods=['POST'])
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        u = data.get('username', '').strip()
        p = data.get('password', '')
        if u and p:
            GLOBAL_STORE["users"][u] = {"password": p, "role": "user", "name": u}
            return jsonify({"status": "success", "user": {"username": u, "role": "user", "displayName": u}})
        return jsonify({"status": "fail", "message": "信息输入不全"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 注意：在 Vercel 中不需要 app.run()

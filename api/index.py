import os
from flask import Flask, request, jsonify
from flask_cors import CORS

# 变量名必须为 app，供 Vercel 自动识别
app = Flask(__name__)

# 允许跨域，适配子域名访问
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS", "DELETE"],
    "allow_headers": ["Content-Type", "Authorization", "Accept"],
    "supports_credentials": True
}})

# 模拟数据库
GLOBAL_STORE = {
    "materials": [],
    "users": {
        "jerry": {"password": os.environ.get('ADMIN_PASSWORD', 'sdeducation'), "role": "admin", "name": "超级管理员"},
        "admin": {"password": "admin123", "role": "admin", "name": "管理员老师"},
        "test01": {"password": "123", "role": "user", "name": "测试学生"}
    }
}

# 🚩 核心修正：双重路由路径，确保无论转发规则如何都能匹配
@app.route('/api/health', methods=['GET'])
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok", 
        "env": "test_env", 
        "materials_count": len(GLOBAL_STORE["materials"])
    })

@app.route('/api/login', methods=['POST'])
@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data: return jsonify({"status": "error", "message": "Missing data"}), 400
        username = data.get('username', '').strip()
        password = data.get('password', '')
        user_db = GLOBAL_STORE["users"]
        if username in user_db and user_db[username]["password"] == password:
            return jsonify({
                "status": "success", 
                "user": {"username": username, "role": user_db[username]["role"]}
            })
        return jsonify({"status": "fail", "message": "凭据错误"}), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/materials/sync', methods=['POST'])
@app.route('/materials/sync', methods=['POST'])
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

@app.route('/api/materials', methods=['GET', 'POST'])
@app.route('/api/materials/<id>', methods=['DELETE'])
@app.route('/materials', methods=['GET', 'POST'])
@app.route('/materials/<id>', methods=['DELETE'])
def handle_materials(id=None):
    global GLOBAL_STORE
    try:
        if request.method == 'POST':
            new_item = request.get_json()
            GLOBAL_STORE["materials"] = [m for m in GLOBAL_STORE["materials"] if m.get('id') != new_item['id']]
            GLOBAL_STORE["materials"].append(new_item)
            return jsonify({"status": "success"})
        if request.method == 'DELETE':
            target_id = id or request.args.get('id')
            GLOBAL_STORE["materials"] = [m for m in GLOBAL_STORE["materials"] if m.get('id') != target_id]
            return jsonify({"status": "success"})
        return jsonify(GLOBAL_STORE["materials"])
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

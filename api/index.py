import os
from flask import Flask, request, jsonify
from flask_cors import CORS

# 初始化 Flask 实例，变量名必须为 app
app = Flask(__name__)

# 以健康检查为例
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

# 以登录为例
@app.route('/login', methods=['POST'])
def login():
    # ... 逻辑 ...
    
# 配置跨域，允许所有来源及特定 Header，确保子域名调用不被拦截
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS", "DELETE"],
    "allow_headers": ["Content-Type", "Authorization", "Accept"],
    "supports_credentials": True
}})

# --- 模拟数据库存储（内存模式） ---
# 提醒：Serverless 环境会定期重置数据，生产环境建议对接外部数据库
GLOBAL_STORE = {
    "materials": [],
    "users": {
        "jerry": {"password": os.environ.get('ADMIN_PASSWORD', 'sdeducation'), "role": "admin", "name": "超级管理员"},
        "admin": {"password": "admin123", "role": "admin", "name": "管理员老师"},
        "test01": {"password": "123", "role": "user", "name": "测试学生"}
    }
}

# 1. 健康检查接口 - 适配前端可能发出的多种路径
@app.route('/health', methods=['GET'])
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok", 
        "env": "test_env", 
        "materials_count": len(GLOBAL_STORE["materials"])
    })

# 2. 登录接口
@app.route('/login', methods=['POST'])
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No input data provided"}), 400
            
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

# 3. 材料同步接口 (适配 App.tsx 逻辑)
@app.route('/materials/sync', methods=['POST'])
@app.route('/api/materials/sync', methods=['POST'])
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

# 4. 材料管理接口 (GET获取全部, POST更新/添加, DELETE删除)
@app.route('/materials', methods=['GET', 'POST'])
@app.route('/api/materials', methods=['GET', 'POST'])
@app.route('/materials/<id>', methods=['DELETE'])
@app.route('/api/materials/<id>', methods=['DELETE'])
def handle_materials(id=None):
    global GLOBAL_STORE
    try:
        if request.method == 'POST':
            new_item = request.get_json()
            if not new_item or 'id' not in new_item:
                return jsonify({"status": "error", "message": "数据不完整"}), 400
            # 更新逻辑：如果ID存在则替换，否则追加
            GLOBAL_STORE["materials"] = [m for m in GLOBAL_STORE["materials"] if m.get('id') != new_item['id']]
            GLOBAL_STORE["materials"].append(new_item)
            return jsonify({"status": "success"})
        
        if request.method == 'DELETE':
            target_id = id or request.args.get('id')
            if target_id:
                GLOBAL_STORE["materials"] = [m for m in GLOBAL_STORE["materials"] if m.get('id') != target_id]
                return jsonify({"status": "success"})
            return jsonify({"status": "error", "message": "缺少ID"}), 400
        
        # GET 请求返回所有材料
        return jsonify(GLOBAL_STORE["materials"])
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 5. 注册接口
@app.route('/register', methods=['POST'])
@app.route('/api/register', methods=['POST'])
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

# Vercel 部署不需要 app.run()，会自动调用导出的 app 对象

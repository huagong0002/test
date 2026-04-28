import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client

app = Flask(__name__)
# 允许跨域及携带凭证
CORS(app, supports_credentials=True)

# --- 1. Supabase 初始化 ---
# 从环境变量读取配置，确保安全性
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 只有当变量存在时才创建客户端，防止本地测试崩溃
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- 2. 静态用户数据库 (用于登录权限控制) ---
USER_DB = {
    "jerry": {"password": "sdeducation", "role": "admin", "name": "Jerry Admin"},
    "admin": {"password": "admin", "role": "admin", "name": "System Admin"},
    "test01": {"password": "password123", "role": "user", "name": "测试学生"}
}

# --- 3. 路由定义 ---

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "db_connected": supabase is not None})

# 登录接口：确保返回正确的 role 字段给前端判断
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        u = data.get('username', '').strip()
        p = data.get('password', '')
        
        if u in USER_DB and USER_DB[u]["password"] == p:
            return jsonify({
                "status": "success",
                "user": {
                    "username": u,
                    "role": USER_DB[u]["role"],
                    "displayName": USER_DB[u]["name"]
                }
            })
        return jsonify({"status": "fail", "message": "账号或密码错误"}), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 获取资料库：从 Supabase 读取，实现全员共享
@app.route('/api/materials', methods=['GET'])
def get_materials():
    if not supabase:
        return jsonify({"error": "数据库未连接"}), 500
    try:
        # 从 materials_db 表读取所有数据
        response = supabase.table("materials_db").select("*").execute()
        # 提取 content 字段中的原始 JSON 数据
        materials = [item['content'] for item in response.data]
        return jsonify(materials)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 同步资料库：由管理员触发，将数据永久存入 Supabase
@app.route('/api/materials/sync', methods=['POST'])
def sync_materials():
    if not supabase:
        return jsonify({"error": "数据库未连接"}), 500
    try:
        data = request.get_json()
        materials = data.get("materials", [])
        
        if not materials:
            return jsonify({"status": "success", "message": "无数据同步"})

        # 使用 Upsert (更新或插入)：ID 存在则更新内容，不存在则创建
        for m in materials:
            supabase.table("materials_db").upsert({
                "id": str(m['id']),
                "content": m
            }).execute()
            
        return jsonify({"status": "success", "count": len(materials)})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 删除资料：从 Supabase 中物理删除
@app.route('/api/materials/<id>', methods=['DELETE'])
def delete_material(id):
    if not supabase:
        return jsonify({"error": "数据库未连接"}), 500
    try:
        supabase.table("materials_db").delete().eq("id", str(id)).execute()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 注册接口 (临时简单实现)
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    u = data.get('username', '').strip()
    p = data.get('password', '')
    if u and p:
        USER_DB[u] = {"password": p, "role": "user", "name": u}
        return jsonify({"status": "success", "user": {"username": u, "role": "user", "displayName": u}})
    return jsonify({"status": "fail", "message": "信息不全"}), 400

# Vercel 环境下不需要 app.run()

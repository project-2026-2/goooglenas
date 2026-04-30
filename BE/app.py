from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

DB_FILE = "db.json"

# DB 초기화
if not os.path.exists(DB_FILE):
    with open(DB_FILE, "w") as f:
        json.dump({"users": [], "files": {}}, f)


def load_db():
    with open(DB_FILE, "r") as f:
        return json.load(f)


def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)


# 회원가입
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    db = load_db()

    for user in db["users"]:
        if user["id"] == data["id"]:
            return jsonify({"msg": "이미 존재"}), 400

    db["users"].append({
        "id": data["id"],
        "pw": data["pw"]
    })

    db["files"][data["id"]] = []

    save_db(db)
    return jsonify({"msg": "가입 성공"})


# 로그인
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    db = load_db()

    for user in db["users"]:
        if user["id"] == data["id"] and user["pw"] == data["pw"]:
            return jsonify({"msg": "로그인 성공"})

    return jsonify({"msg": "실패"}), 401


# 파일 가져오기
@app.route("/files/<user_id>", methods=["GET"])
def get_files(user_id):
    db = load_db()
    return jsonify(db["files"].get(user_id, []))


# 파일 추가
@app.route("/files/<user_id>", methods=["POST"])
def add_file(user_id):
    data = request.json
    db = load_db()

    file = {
        "id": len(db["files"][user_id]) + 1,
        "name": data["name"]
    }

    db["files"][user_id].append(file)
    save_db(db)

    return jsonify(file)


# 파일 삭제
@app.route("/files/<user_id>/<int:file_id>", methods=["DELETE"])
def delete_file(user_id, file_id):
    db = load_db()

    db["files"][user_id] = [
        f for f in db["files"][user_id] if f["id"] != file_id
    ]

    save_db(db)
    return jsonify({"msg": "삭제됨"})


if __name__ == "__main__":
    app.run(debug=True)

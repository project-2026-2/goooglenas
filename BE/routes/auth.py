# BE/routes/auth.py
from flask import Blueprint, request, jsonify
from models import db, User

auth_bp = Blueprint('auth', __name__)

# 결과 주소: /auth/signup[cite: 3]
@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    user = User(username=data.get('username'))
    user.set_password(data.get('password'))
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'success'}), 201

# 결과 주소: /auth/login[cite: 3]
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user and user.check_password(data.get('password')):
        return jsonify({'message': 'success'}), 200
    return jsonify({'message': 'fail'}), 401
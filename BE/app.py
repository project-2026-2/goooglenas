# BE/app.py
from flask import Flask
from flask_cors import CORS
from config import Config
from models import db
from routes.auth import auth_bp

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)
CORS(app)

# [경로 핵심] 모든 인증 주소는 http://localhost:5000/auth 로 시작하게 고정합니다.[cite: 1]
app.register_blueprint(auth_bp, url_prefix='/auth')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
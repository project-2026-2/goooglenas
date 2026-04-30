from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    userid = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    pw = db.Column(db.String(255), nullable=False)  # 해시된 비밀번호[cite: 3]

    def set_password(self, password):
        self.pw = generate_password_hash(password)  # 해싱[cite: 3]

    def check_password(self, password):
        return check_password_hash(self.pw, password)  # 검증[cite: 3]
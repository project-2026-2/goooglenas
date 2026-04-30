import os
from dotenv import load_dotenv

# .env 파일 로드[cite: 2]
load_dotenv()


class Config:
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PW = os.getenv('DB_PASSWORD', '')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_NAME = os.getenv('DB_NAME', 'postgres')

    # .env 정보를 바탕으로 URI 구성[cite: 2]
    if DB_PW:
        SQLALCHEMY_DATABASE_URI = f"postgresql://{DB_USER}:{DB_PW}@{DB_HOST}:5432/{DB_NAME}"
    else:
        SQLALCHEMY_DATABASE_URI = f"postgresql://{DB_USER}@{DB_HOST}:5432/{DB_NAME}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-key-for-dev')
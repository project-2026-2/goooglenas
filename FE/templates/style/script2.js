// FE/templates/style/script2.js
document.getElementById('joinBtn').addEventListener('click', async () => {
    const username = document.getElementById('id').value;
    const password = document.getElementById('pw1').value;

    // 백엔드 app.py(/auth) + auth.py(/signup) 주소를 정확히 합침[cite: 3]
    const response = await fetch('http://localhost:5000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        alert("가입 성공");
        location.href = '../login.html'; // style 폴더 밖의 html로 이동[cite: 5, 9]
    } else {
        alert("가입 실패: 주소를 확인하세요.");
    }
});
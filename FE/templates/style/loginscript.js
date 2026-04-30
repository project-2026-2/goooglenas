// FE/templates/style/loginscript.js
document.querySelector('.first').addEventListener('click', async () => {
    const username = document.querySelector('input[type="text"]').value;
    const password = document.querySelector('input[type="password"]').value;

    // 백엔드와 주소 완벽 일치[cite: 3, 8]
    const response = await fetch('http://localhost:5000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        alert("로그인 성공");
        location.href = '../main.html'; // 상위 폴더로 이동[cite: 8]
    } else {
        alert("로그인 실패 (404가 뜬다면 fetch 주소 오타)");
    }
});
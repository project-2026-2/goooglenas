document.querySelector('.first').addEventListener('click', function() {
    const id = document.querySelector('input[type="text"]').value.trim();
    const pw = document.querySelector('input[type="password"]').value.trim();

    if (id === '' || pw === '') {
        alert('아이디와 비밀번호를 입력해주세요.');
        return;
    }

    const savedId = localStorage.getItem('userId');
    const savedPw = localStorage.getItem('userPw');

    if (id === savedId && pw === savedPw) {
        localStorage.setItem('loggedIn', 'true');  // 이거 추가
        window.location.href = 'main.html';
    } else {
        alert('아이디 또는 비밀번호가 틀렸습니다.');
    }
});

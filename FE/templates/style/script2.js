const joinBtn = document.getElementById('joinBtn');
const msg = document.getElementById('msg');

joinBtn.addEventListener('click', function () {
    const id = document.getElementById('id').value.trim();
    const pw1 = document.getElementById('pw1').value;
    const pw2 = document.getElementById('pw2').value;

    msg.className = 'msg';
    msg.textContent = '';

    if (id === '') {
        showError('아이디를 입력해주세요.');
        return;
    }

    if (pw1 === '') {
        showError('비밀번호를 입력해주세요.');
        return;
    }

    if (pw1 !== pw2) {
        showError('비밀번호가 맞지 않습니다.');
        return;
    }
    // 기존 showSuccess 위에 추가
    localStorage.setItem('userId', id);
    localStorage.setItem('userPw', pw1);
    showSuccess('회원가입이 완료되었습니다!');
    setTimeout(function() {
        window.location.href = 'login.html';
        console.log(id,pw1)
    }, 1000);
});

function showError(text) {
    msg.textContent = text;
    msg.className = 'msg error';
}

function showSuccess(text) {
    msg.textContent = text;
    msg.className = 'msg success';
    console.log()
}
// console.log()
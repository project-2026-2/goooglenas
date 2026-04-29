document.getElementById("joinBtn").addEventListener("click", function() {
    const id = document.getElementById("id").value;
    const pw1 = document.getElementById("pw1").value;
    const pw2 = document.getElementById("pw2").value;
    const msg = document.getElementById("msg");

    msg.style.display = "block";
    msg.style.color = "red";

    if (id === "") {
        msg.innerText = "아이디를 입력하세요.";
        return;
    }

    if (pw1.length < 6) {
        msg.innerText = "비밀번호는 6글자 이상이어야 합니다.";
        return;
    }

    if (pw1 !== pw2) {
        msg.innerText = "비밀번호가 맞지 않습니다.";
        return;
    }

    msg.style.color = "green";
    msg.innerText = "회원가입 성공!";

    // 실제 서비스면 서버로 전송해야 함
    // 지금은 페이지 이동만
    setTimeout(() => {
        location.href = "login.html";
    }, 1000);
});
/* =========================
   데이터
========================= */
let myDrive = JSON.parse(localStorage.getItem("myDrive")) || [];
let sharedDrive = JSON.parse(localStorage.getItem("sharedDrive")) || [];
let trash = JSON.parse(localStorage.getItem("trash")) || [];

let currentMode = "home";
let pathStack = [];

goHome();

/* =========================
   현재 위치
========================= */
function current() {
    return pathStack[pathStack.length - 1].data;
}

/* =========================
   이동
========================= */
function goHome() {
    currentMode = "home";
    pathStack = [{
        name: "홈",
        data: [...myDrive, ...sharedDrive]
    }];
    render();
}

function goMyDrive() {
    currentMode = "my";
    pathStack = [{
        name: "내 드라이브",
        data: myDrive
    }];
    render();
}

function goShared() {
    currentMode = "shared";
    pathStack = [{
        name: "공유 문서함",
        data: sharedDrive
    }];
    render();
}

function goTrash() {
    currentMode = "trash";
    pathStack = [{
        name: "휴지통",
        data: trash
    }];
    render();
}

/* =========================
   파일/폴더 생성
========================= */
function addFolder() {
    const name = prompt("폴더 이름");
    if (!name) return;

    current().push({
        id: Date.now(),
        type: "folder",
        name,
        children: []
    });

    save();
}

/* =========================
   파일 업로드
========================= */
function uploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = ev => {
        current().push({
            id: Date.now(),
            type: "file",
            name: file.name,
            content: ev.target.result,
            fileType: file.type
        });

        save();
    };

    reader.readAsDataURL(file);
}

/* =========================
   🔥 삭제 (핵심 수정)
========================= */
function deleteItem(item) {

    function remove(arr) {
        const idx = arr.findIndex(i => i.id === item.id);

        if (idx !== -1) {
            const removed = arr.splice(idx, 1)[0];

            // 🔥 중요: "복사해서" 휴지통 저장
            trash.push({
                id: removed.id,
                type: removed.type,
                name: removed.name,
                content: removed.content,
                fileType: removed.fileType,
                children: removed.children || []
            });

            return true;
        }

        for (let i of arr) {
            if (i.type === "folder") {
                if (remove(i.children)) return true;
            }
        }

        return false;
    }

    remove(myDrive);
    save();
}

/* =========================
   🔥 복구 (완전 안정 버전)
========================= */
function restoreItem(item) {

    const idx = trash.findIndex(i => i.id === item.id);
    if (idx === -1) return;

    const restored = trash.splice(idx, 1)[0];

    // 🔥 반드시 새 객체로 복원 (중복/참조 버그 방지)
    const newItem = {
        id: Date.now(),
        type: restored.type,
        name: restored.name,
        content: restored.content,
        fileType: restored.fileType,
        children: restored.children ? JSON.parse(JSON.stringify(restored.children)) : []
    };

    myDrive.push(newItem);

    save();
}

/* =========================
   완전 삭제
========================= */
function permanentDelete(item) {
    const idx = trash.findIndex(i => i.id === item.id);
    if (idx !== -1) {
        trash.splice(idx, 1);
    }
    save();
}

/* =========================
   렌더
========================= */
function render() {
    const area = document.getElementById("fileArea");
    area.innerHTML = "";

    let list = current();

    list.forEach(item => {
        const div = document.createElement("div");
        div.className = "file";

        if (currentMode === "trash") {
            div.innerHTML = `
                <div>📁</div>
                <div>${item.name}</div>
                <div>나</div>
                <div>휴지통</div>
                <div>
                    <span class="btn">복구</span> |
                    <span class="btn">삭제</span>
                </div>
            `;

            div.children[4].children[0].onclick = () => restoreItem(item);
            div.children[4].children[1].onclick = () => permanentDelete(item);

        } else {
            div.innerHTML = `
                <div>${item.type === "folder" ? "📁" : "📄"}</div>
                <div>${item.name}</div>
                <div>나</div>
                <div>${currentMode === "shared" ? "공유" : "내 드라이브"}</div>
                <div><span class="btn">삭제</span></div>
            `;

            div.children[4].children[0].onclick = () => deleteItem(item);

            div.onclick = (e) => {
                if (e.target.classList.contains("btn")) return;

                if (item.type === "folder") {
                    pathStack.push({
                        name: item.name,
                        data: item.children
                    });
                    render();
                } else {
                    openFile(item);
                }
            };
        }

        area.appendChild(div);
    });
}

/* =========================
   파일 열기
========================= */
function openFile(file) {
    const preview = document.getElementById("preview");

    if (file.fileType && file.fileType.startsWith("image")) {
        preview.innerHTML = `<img src="${file.content}" style="width:100%">`;
    } else {
        preview.innerHTML = `<a href="${file.content}" download>다운로드</a>`;
    }

    preview.style.display = "block";
}

document.getElementById("preview").onclick = function () {
    this.style.display = "none";
};

/* =========================
   저장
========================= */
function save() {
    localStorage.setItem("myDrive", JSON.stringify(myDrive));
    localStorage.setItem("sharedDrive", JSON.stringify(sharedDrive));
    localStorage.setItem("trash", JSON.stringify(trash));
    render();
}

const API = "http://127.0.0.1:5000";

const user = localStorage.getItem("currentUser");
const fileArea = document.getElementById("fileArea");

if (!user) {
    location.href = "login.html";
}

loadFiles();

/* 파일 불러오기 */
async function loadFiles() {
    const res = await fetch(`${API}/files/${user}`);
    const data = await res.json();
    render(data);
}

/* 파일 추가 */
async function addFile() {
    const name = prompt("파일 이름");
    if (!name) return;

    await fetch(`${API}/files/${user}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name })
    });

    loadFiles();
}

/* 삭제 */
async function deleteFile(id) {
    await fetch(`${API}/files/${user}/${id}`, {
        method: "DELETE"
    });

    loadFiles();
}

/* 렌더 */
function render(files) {
    fileArea.innerHTML = "";

    files.forEach(file => {
        const div = document.createElement("div");
        div.className = "file";

        div.innerHTML = `
            <span>${file.name}</span>
            <button onclick="deleteFile(${file.id})">삭제</button>
        `;

        fileArea.appendChild(div);
    });
}

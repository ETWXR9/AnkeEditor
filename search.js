let searchInput
//加载时取得元素，注册各类事件
window.onload = () => {
    searchInput = document.getElementById('search')
    searchInput.addEventListener("keydown", (e) => {
        if (e.keyCode === 13) {
            e.preventDefault();
            let text = e.srcElement.value;
            window.fs.SearchInPageSend("searchinpagesend", text);
        }
        if (e.keyCode === 27) {
            e.preventDefault();
            window.close();
        }
    })
}



const { ipcRenderer,remote } = require("electron");

let searchInput
window.onload = () => {
    searchInput = document.getElementById('search')
    searchInput.addEventListener("keydown", (e) => {
        if (e.keyCode === 13) {
            e.preventDefault();
            let text = e.srcElement.value;
            ipcRenderer.send("search", text);
        }
        if (e.keyCode === 27) {
            e.preventDefault();
            window.close();
        }
    })
}



const electron = require('electron')
const { ipcMain, app, BrowserWindow, clipboard, Menu, MenuItem, ipcRenderer, webContents, dialog, shell } = require('electron')
const path = require("path");
const fs = require("fs");
const RandomOrg = require('random-org');
const { request } = require("@octokit/request");
const iconv = require('iconv-lite');
const remote = require('@electron/remote/main');

const menutemp = [
    {
        label: '新建',
        accelerator: 'CmdOrCtrl+N',
        click() {
            if (contentUnsave) {
                const options = {
                    type: "none",
                    buttons: ["确定"],
                    title: "提示",
                    message: "请先保存"
                }
                dialog.showMessageBox(win, options)
                return
            }
            filePath = ""
            win.webContents.send("newcontent")
        }
    },
    {
        label: '读取',
        click() {
            win.webContents.send("loadcontent");
        },
    },
    {
        label: '保存',
        accelerator: 'CmdOrCtrl+S',
        click() { win.webContents.send("getcontentandsave"); }
    },
    {
        label: '导出HTML',
        click() { win.webContents.send("gethtmlandexport") }
    },
    {
        label: '搜索',
        accelerator: 'CmdOrCtrl+F',
        click() {
            searchwin.show();
        }
    },
    {
        label: '生成长截图',
        click() {
            win.webContents.send("toPng");
        }

    },
    {
        label: '开发者工具',
        click() { win.webContents.openDevTools(); }
    },
    {
        label: '统计字数',
        click() { win.webContents.send("countWord"); }
    },
]

let win;
let searchwin;

let filePath = "";

let contentUnsave = false;
let random = null;



app.whenReady().then(() => {

    win = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
            worldSafeExecuteJavaScript: true,
            contextIsolation: false,
            nodeIntegration: true,
            enableRemoteModule: true,
            // preload: path.join(__dirname, './perload.js') // use a preload script
        }
    });
    remote.initialize();
    remote.enable(win.webContents);
    win.loadFile('index.html');

    Menu.setApplicationMenu(null)
    win.setMenu(Menu.buildFromTemplate(menutemp));
    win.maximize();
    // win.webContents.openDevTools();
    win.on('close', (e) => {
        e.preventDefault();
        win.webContents.send("onquit")
    })
    searchwin = new BrowserWindow({
        parent: win,
        width: 300, height: 50,
        maximizable: false, minimizable: false,
        frame: false,
        transparent: true,
        useContentSize: true,
        webPreferences: {
            worldSafeExecuteJavaScript: true,
            contextIsolation: false,
            nodeIntegration: true,
            enableRemoteModule: false, // turn off remote
            preload: path.join(__dirname, './perload.js') // use a preload script
        }
    })
    searchwin.loadFile('searchPage.html');
    // searchwin.webContents.openDevTools();
    searchwin.hide();
    searchwin.on("close", (evt) => {
        evt.preventDefault();    // This will cancel the close
        searchwin.hide();
        win.webContents.stopFindInPage("activateSelection");
        win.focus();
    });
    // searchwin.webContents.openDevTools();
    searchwin.on('blur', function () {
        searchwin.hide();
        win.webContents.stopFindInPage("activateSelection");
        win.focus();
    })
})

app.on('window-all-closed', () => {
    app.quit();
})

app.on("ready", () => {
    app.setAppUserModelId("et.electron.editor");
})

//搜索
ipcMain.on("search", function (event, arg) {
    // console.log("Search " +arg);
    if (arg != "") {
        win.webContents.findInPage(arg);
    }
});



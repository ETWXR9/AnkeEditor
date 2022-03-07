const electron = require('electron')
const { ipcMain, app, BrowserWindow, clipboard, Menu, MenuItem, remote, ipcRenderer, webContents, dialog, shell } = require('electron')
const path = require("path");
const fs = require("fs");
const RandomOrg = require('random-org');
const { request } = require("@octokit/request");
const iconv = require('iconv-lite');

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
            contextIsolation: true,
            nodeIntegration: true,
            enableRemoteModule: false, // turn off remote
            preload: path.join(__dirname, './perload.js') // use a preload script
        }
    });
    win.loadFile('index.html');
    Menu.setApplicationMenu(null)
    win.setMenu(Menu.buildFromTemplate(menutemp));
    win.maximize();
    // win.webContents.openDevTools();
    win.on('close', (e) => {
        if (contentUnsave) {
            e.preventDefault();
            win.webContents.send("onquit")
        }

    })
    searchwin = new BrowserWindow({
        parent: win,
        width: 300, height: 50,
        maximizable: false, minimizable: false,
        frame :false,
        transparent: true,
        useContentSize :true,
        webPreferences: {
            worldSafeExecuteJavaScript: true,
            contextIsolation: true,
            nodeIntegration: true,
            enableRemoteModule: false, // turn off remote
            preload: path.join(__dirname, './perload.js') // use a preload script
        }
    })
    searchwin.loadFile('searchPage.html');
    searchwin.hide();
    searchwin.on("close", (evt) => {
        evt.preventDefault();    // This will cancel the close
        searchwin.hide();
        win.webContents.stopFindInPage("activateSelection");
        win.focus();
        
    });
    // searchwin.webContents.openDevTools();
    searchwin.on('blur', function() {
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



//保存
function SaveFile(content) {
    if (filePath != "") {
        fs.writeFileSync(filePath, content, "utf-8");
    } else {
        const options = {
            title: "保存",
            defaultPath: process.env.PORTABLE_EXECUTABLE_DIR,
        }
        let result = dialog.showSaveDialogSync(null, options);
        if (result) {
            fs.writeFileSync(result, content, "utf-8");
            filePath = result;
        }
    }
}
//导出为html
function ExportHtml(content) {
    const options = {
        title: "导出为HTML文件",
        defaultPath: process.env.PORTABLE_EXECUTABLE_DIR,
        filters: [{ name: 'HTML文件', extensions: ['html'] }],
    }
    let result = dialog.showSaveDialogSync(null, options);
    if (result) {
        content = iconv.encode(content, "GBK")
        fs.writeFileSync(result, content);
    }
}

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
            if (contentUnsave) {
                const optionsSave = {
                    type: "none",
                    buttons: ["确定"],
                    title: "提示",
                    message: "注意，存在未保存的内容"
                }
                dialog.showMessageBoxSync(win, optionsSave)
            }
            const options = {
                title: "读取",
                defaultPath: process.env.PORTABLE_EXECUTABLE_DIR,
                multiSelections: false,
            }
            let result = dialog.showOpenDialogSync(null, options);
            if (result) {
                let data = fs.readFileSync(result[0], "utf-8");
                filePath = result[0];
                //向渲染进程传递信息，更新内容
                win.webContents.send("winlog", "读取存档文件结果" + data);
                win.webContents.send("loadcontent", data);
            }
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
        label: '功能',
        submenu: [{
            label: '搜索',
            accelerator: 'CmdOrCtrl+F',
            click() {
                searchwin.show();
        }}]
        },
    {
        label: '开发者工具',
        click() { win.webContents.openDevTools(); }
    },
]

ipcMain.on('loadconfig', (event, args) => {
    //读取config
    let configJson;
    if (app.isPackaged) {
        configJson = fs.readFileSync(process.env.PORTABLE_EXECUTABLE_DIR + "/config.json", "utf-8");
    } else {
        configJson = fs.readFileSync("config.json", "utf-8");
    }
    configJsonParse = JSON.parse(configJson);
    win.webContents.send("winlog", "读取config文件结果" + configJson);
    win.webContents.send("getconfig", configJsonParse);

    CheckVersion();
})

ipcMain.on('contentunsavechange', (event, args) => {
    contentUnsave = args;
})

// ipcMain.on('showmessagebox',(event,args)=>{
//     let index = dialog.showMessageBoxSync({
//         type: 'info',
//         title: 'Information',
//         defaultId: 0,
//         message: '是否保存',
//         buttons: ['是', '否']
//     });
// })

ipcMain.on("sendcontentandsave", (event, args) => {
    SaveFile(args);
})
ipcMain.on("sendhtmlandexport", (event, args) => {
    ExportHtml(args);
})

ipcMain.on("saveandquit", (event, args) => {
    if (args[1]) {
        let index = dialog.showMessageBoxSync({
            type: 'info',
            title: 'Information',
            defaultId: 0,
            message: '是否保存',
            buttons: ['是', '否']
        });
        if (index == 0) {
            //保存然后退出
            SaveFile(args[0]);
            contentUnsave = false;
            app.exit();
        } else {
            contentUnsave = false;
            app.exit();
        }

    }
})

ipcMain.on("readjson", (event, filename) => {
    let data;
    if (app.isPackaged) {
        data = fs.readFileSync(process.env.PORTABLE_EXECUTABLE_DIR + "/" + filename, "utf-8");
    } else {
        data = fs.readFileSync(filename, "utf-8");
    }


    win.webContents.send("winlog", "读取json文件结果" + data);
    let jsonobj = JSON.parse(data);
    // Send result back to renderer process
    win.webContents.send("getjson", jsonobj);
});

ipcMain.on("savejson", (event, args) => {
    if (app.isPackaged) {
        fs.writeFileSync(process.env.PORTABLE_EXECUTABLE_DIR + "/" + args[0], args[1], "utf-8");
    } else {
        fs.writeFileSync(args[0], args[1], "utf-8");
    }


});

ipcMain.on("saveconfig", (event, args) => {
    if (app.isPackaged) {
        fs.writeFileSync(process.env.PORTABLE_EXECUTABLE_DIR + "/" + args[0], args[1], "utf-8");
    } else {
        fs.writeFileSync(args[0], args[1], "utf-8");
    }


});

ipcMain.on("readclip", (event, charaname) => {
    let clipcontentPlain = clipboard.readText();
    let clipcontentHTML = clipboard.readHTML();
    let clipcontent = [clipcontentHTML, clipcontentPlain];
    // Send result back to renderer process
    win.webContents.send("getclip", charaname, clipcontent);
});

ipcMain.on("creatpicmenu", (event, args) => {
    win.webContents.send("winlog", "creatpicmenu里的args是" + args);
    const menu = new Menu();
    menu.append(new MenuItem({
        label: '删除图片', click() {
            win.webContents.send("deletepic", args);
        }
    }));
    menu.popup();
});

ipcMain.on("creatcharamenu", (event, charaname) => {
    win.webContents.send("winlog", "creatpicmenu里的args是" + charaname);
    const menu = new Menu();
    menu.append(new MenuItem({
        label: '删除人物', click() {
            win.webContents.send("deletechara", charaname);
        }
    }));
    menu.popup();
});

ipcMain.on("reqrandom", (event, dicevalue) => {
    random.generateIntegers({ min: 1, max: dicevalue, n: 1 })
        .then(function (result) {
            win.webContents.send("getrandom", result);
        });
})


//检查更新
function CheckVersion() {
    win.webContents.send("winlog", "读取github中");
    request('GET /repos/{owner}/{repo}/releases/latest', {
        owner: 'ETWXR9',
        repo: 'AnkeEditor'
    }).then(function (result) {
        win.webContents.send("checkversion", result);
    });



    //   win.webContents.send("checkversion",result);

}
ipcMain.on("openpage", (event, url) => {
    shell.openExternal(url);
});

ipcMain.on("showalert", (event, msg) => {
    const options = {
        type: "none",
        buttons: [msg[1]],
        title: "提示",
        message: msg[0]
    }
    dialog.showMessageBox(win, options)
});
//搜索
ipcMain.on("searchinpagesend", (event, text) => {
    // console.log("搜索 " +text);
    if (text!="") {
        win.webContents.findInPage(text);
    }
});




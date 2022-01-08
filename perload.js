const {
    contextBridge,
    ipcRenderer
} = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "fs", {
    ReadJson: (channel, data) => {
        // whitelist channels
        let validChannels = ["readjson"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    GetJson: (channel, func) => {
        let validChannels = ["getjson"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    SaveJson: (channel, data) => {
        let validChannels = ["savejson"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    
    GetContentAndSave: (channel, func) => {
        let validChannels = ["getcontentandsave"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    SendContentandSave: (channel, data) => {
        let validChannels = ["sendcontentandsave"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    GetHtmlandExport: (channel, func) => {
        let validChannels = ["gethtmlandexport"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    SendHtmlandExport: (channel, data) => {
        let validChannels = ["sendhtmlandexport"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    OnQuit:
        (channel, func) => {
            let validChannels = ["onquit"];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
    SaveAndQuit: (channel, data) => {
        let validChannels = ["saveandquit"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    LoadContent: (channel, func) => {
        let validChannels = ["loadcontent"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    ContentUnsaveChange: (channel, data) => {
        let validChannels = ["contentunsavechange"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    NewContent: (channel, func) => {
        let validChannels = ["newcontent"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    GetConfig: (channel, func) => {
        let validChannels = ["getconfig"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    LoadConfig:(channel, data) => {
        let validChannels = ["loadconfig"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    SearchInPageSend:(channel, data) => {
        let validChannels = ["searchinpagesend"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    SearchInPageOn: (channel, func) => {
        let validChannels = ["searchinpageon"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
}
);
contextBridge.exposeInMainWorld(
    "clipboard", {
    ReadClip: (channel, data) => {
        // whitelist channels
        let validChannels = ["readclip"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    GetClip: (channel, func) => {
        let validChannels = ["getclip"];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
}
);
contextBridge.exposeInMainWorld(
    "log", {
    WinLog: (channel, func) => {
        let validChannels = ["winlog"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    CheckVersion: (channel, func) => {
        let validChannels = ["checkversion"];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    OpenPage: (channel, data) => {
        // whitelist channels
        let validChannels = ["openpage"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    ShowAlert: (channel, data) => {
        // whitelist channels
        let validChannels = ["showalert"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
}
)

contextBridge.exposeInMainWorld(
    "menu", {
    CreatPicMenu: (channel, index) => {
        let validChannels = ["creatpicmenu"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, index);
        }
    },
    DeletePic: (channel, func) => {
        let validChannels = ["deletepic"];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    CreatCharaMenu: (channel, index) => {
        let validChannels = ["creatcharamenu"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, index);
        }
    },
    DeleteChara: (channel, func) => {
        let validChannels = ["deletechara"];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
}

)


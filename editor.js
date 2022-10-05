//此版本为离线版本，将图库完全重写为读取本地目录下的图片文件

const { ipcRenderer, clipboard } = require('electron');
const remote = require('@electron/remote');
const { Menu, MenuItem } = require('@electron/remote');
const electron = require('electron');
const fs = require("fs");
const { request } = require("@octokit/request");
const Sortable = require('sortablejs');
const domtoimage = require('dom-to-image');
const iconv = require('iconv-lite');

Array.prototype.remove = function (item) {
    var index = this.indexOf(item);
    if (index > -1) {
        this.splice(index, 1);
    }
};




/**
 *记忆插入点位置
 */
function HandleSelectionChange() {
    if (document.activeElement != inputDiv) {
        return;
    }
    var sel = window.getSelection && window.getSelection();
    // console.log("handle sel " + sel);
    if (sel && sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0);
        // console.log("saveRange " + savedRange);
    }
}
var savedRange = null;

//window
let win = null;

//maindiv
let maindiv = null
//输入栏
let inputDiv = null;

//图片栏
let picDiv = null;
//历史栏
let historyDiv = null;

//picData的json
let picData = null;

//group-div
let checkedGroup = "";
let groupDiv = null
//piccheckform
let checkedChara = [];
let checkform = null;


//'groupName:[charaName]'
let unsavedChara = {}
//font-color-input
let fontColorInput = null;
//background-color-input
let backgroundColorInput = null;
//font-size-slider
let fontSizeSlider = null;

//picsizeslider
let picSizeSlider = null;

//inputdiv离开时保存selection
let selectionOnBlur = null;

//设置
let config = {};
let useApi = false;


//文本是否有未保存的改动
let contentUnsaved = false;

//默认保存读取路径
let filePath = "";

//默认根目录路径
let rootDir;

//输入框字体限制
let maxFontSize = 50;
let minFontSize = 10;



//初始化逻辑，取得元素，注册各类事件
window.onload = () => {

    rootDir = remote.app.isPackaged ? remote.process.env.PORTABLE_EXECUTABLE_DIR + "/" : "";

    maindiv = document.getElementById('main-div')
    inputDiv = document.getElementById('input-div');
    historyDiv = document.getElementById('history-div');
    picDiv = document.getElementById('picture-div');
    groupDiv = document.querySelector('#group-div');
    //刷新分类
    groupDiv.addEventListener('mouseup', e => {
        if (e.button == 2) {
            reloadGroupName();
        }
    })
    checkform = document.querySelector('#pic-check-form');
    //换行逻辑
    inputDiv.addEventListener('keydown', breakLineEvent);
    //未保存改动状态逻辑
    inputDiv.addEventListener('input', e => {
        contentUnsaved = true;
    })
    //字体颜色
    fontColorInput = document.getElementById('font-color-input');
    fontColorInput.addEventListener("change", onFontColorInputChange)
    //背景颜色
    backgroundColorInput = document.getElementById('background-color-input');
    backgroundColorInput.addEventListener("change", onBackgroundColorInputChange)
    //字体大小
    fontSizeSlider = document.getElementById('font-size-slider');
    fontSizeSlider.addEventListener('change', onFontSizeSliderChange);

    //图片大小
    picSizeSlider = document.getElementById('pic-size-slider');
    picSizeSlider.addEventListener('change', onPicSizeSliderChange);
    //隐藏骰子历史侧边栏
    document.getElementById('hide-history-button').addEventListener('click', onHideHistoryButtonClick);
    //人物名称自动补全开关
    document.getElementById('add-name-button').addEventListener('click', onAddNameButtonClick);
    //粘贴逻辑
    document.querySelector('#input-div').addEventListener("paste", (e) => {
        e.stopPropagation();
        e.preventDefault();
        var text = '', event = (e.originalEvent || e);
        text = event.clipboardData.getData('text/html') ? event.clipboardData.getData('text/html') : event.clipboardData.getData('Text');
        console.log("复制数据：" + text);

        text = CleanWordHTML(text);

        //简化br标签
        text = text.replace(/<br[^>]*>/g, "<br>");
        //清理空格，防止复制时多余空格
        text = text.replace(/&nbsp;/g, "");
        //去掉所有\n，防止复制时多出行
        text = text.replace(/(\r\n|\n|\r)/gm, "");
        //清理所有style
        text = text.replace(/style="[^"]*"/gi, "");
        //清理掉格式清理后残留的空div
        text = text.replace(/<div ><\/div>/g, "");

        //提取img的src，替换为纯净的img
        let parser = new DOMParser();
        let doc = parser.parseFromString(text, 'text/html');
        // console.log(doc.body);
        if (doc) {
            var images = doc.getElementsByTagName('img');
            let regexp = /http((?!(http|png|jpg|jpeg)).)*(png|jpg|jpeg)/gi;
            // console.log(images);
            if (images) {
                [...images].forEach(img => {
                    var mathcSrc = img.src.match(regexp);
                    while (img.attributes.length > 0)
                        img.removeAttribute(img.attributes[0].name);
                    img.src = mathcSrc;
                })
            }
            text = doc.body.innerHTML;
        }
        console.log("粘贴数据：" + text);
        if (document.queryCommandSupported('insertHTML')) {
            document.execCommand('insertHTML', false, text);
        } else {
            document.execCommand('paste', false, text);
        }
    });
    //保存sel
    inputDiv.addEventListener("selectstart", () => {
        // console.log("Selection started in targetDiv");
        document.addEventListener("selectionchange", HandleSelectionChange, false);
    });
    // inputDiv.addEventListener("focusout", () => {
    //     console.log("focusout targetDiv");
    //     document.removeEventListener("selectionchange", HandleSelectionChange);
    // })
    inputDiv.addEventListener("input", () => {
        // console.log("input in targetDiv");
        document.addEventListener("selectionchange", HandleSelectionChange);
    })

    //各类鼠标事件
    document.onmousedown = e => {
    }
    convertOldPicData();
    loadGroupNames();
    loadConfigs();
}

//退出逻辑，保存人物JSON，保存内容
ipcRenderer.on("onquit", (event) => {
    console.log("保存退出 filepath = " + filePath);

    try {
        //更新到本地文件
        // for (var groupName in unsavedChara) {
        //     var charaNameArray = unsavedChara[groupName]
        //     charaNameArray.forEach(charaName => {
        //         // alert(charaName);
        //         updateCharaJSON(groupName, charaName);
        //     })
        // }
        if (contentUnsaved) {
            let index = remote.dialog.showMessageBoxSync({
                title: '提示',
                type: 'info',
                defaultId: 0,
                message: '存在未保存内容，是否保存',
                buttons: ['是', '否'],
                cancelId: 2
            });
            if (index == 0) {
                //保存然后退出
                SaveContent();
                // contentUnsaved = false;
                remote.app.exit();
            }
            else if (index == 1) {
                // contentUnsaved = false;
                remote.app.exit();
            }
        } else { remote.app.exit(); }
    } catch (error) {
        remote.app.exit();
    }

})


//#region 图库
function loadGroupNames() {
    groupDiv.innerHTML = "";
    //读取目录
    let dirArray;//分类目录的名称（字符串组）

    dirArray = getDirectories(rootDir + "图库");

    console.log("读取图库" + dirArray);

    dirArray.forEach((groupName) => {
        //装填分类栏
        let groupButton = document.createElement('div');
        groupButton.className = 'group-btn';
        groupButton.innerText = groupName;
        groupDiv.appendChild(groupButton);
        //设置颜色
        if (checkedGroup == groupName) {
            groupButton.style.setProperty('background', 'coral')
            loadGroup(groupName);
        } else {
            groupButton.style.setProperty('background', 'white')
        }
        //组按钮点击
        groupButton.addEventListener('click', e => {
            //重置颜色
            [...groupDiv.children].forEach(
                child => {
                    child.style.setProperty('background', 'white')
                })
            e.target.style.setProperty('background', 'coral')
            checkedGroup = groupName;
            //加载人物目录
            loadGroup(e.target.innerText);
        })
    })
}
function reloadGroupName() {
    // win.webContents.send("winlog", "creatpicmenu里的args是" + charaname);
    const menu = new Menu();
    menu.append(new MenuItem({
        label: '刷新图库', click() {
            loadGroupNames();

        }
    }));
    menu.popup();
}

/**
 *  加载指定组目录下的人物目录
 *  
 * @param {string} 组名称
 */
function loadGroup(groupName) {
    checkform.innerHTML = "";
    let charaNameArray;
    try {
        charaNameArray = getDirectories(rootDir + "图库/" + groupName);
    } catch (error) {
        loadGroupNames();
    }
    console.log("读取分类，内容为" + charaNameArray);
    checkedGroup = groupName;
    //生成人物按钮
    charaNameArray.forEach(charaName => {
        //创建checkbox
        let charaBtn = document.createElement('div');
        // charaBtn.type = 'div';
        charaBtn.innerText = charaName;
        charaBtn.className = 'chara-btn';
        checkform.appendChild(charaBtn);
        //勾选状态
        if (checkedChara.find((a => a == groupName + "&&" + charaName))) {
            charaBtn.style.background = "coral";
        } else {
            charaBtn.style.background = "white";
        }
        // charaBtn.id = charaName + 'btn';
        //勾选人物逻辑
        charaBtn.addEventListener('click', e => {
            if (e.button == 0) {
                let foundChecked = checkedChara.find((a => a == groupName + "&&" + charaName));
                if (!foundChecked) {
                    loadChara(groupName, charaName);
                }
                else {
                    unloadChara(groupName, charaName);
                }
            }
            //右击弹出删除人物按钮
            if (e.button == 2) {
                CreateCharaMenu(groupName, charaName);
            }
        });

    });

}
//读取人物图片
/**
 * 从人物目录中读取所有图片
 *
 * @param {*} groupName
 * @param {*} charaName
 * @return {*} 
 */
function loadChara(groupName, charaName) {
    //读取目录
    let picFileNames = getPictureFiles(groupName, charaName);
    //读取排序文件
    let picSortJson = {};
    picSortJson.sort = picFileNames;
    try {
        picSortJson = fs.readFileSync(rootDir + "图库/" + groupName + "/" + charaName + "/" + "sort.json", "utf-8");
        picSortJson = JSON.parse(picSortJson);
    } catch (error) {

    }
    console.log("读取排序文件结果" + picSortJson.sort);
    //给排序文件添加缺少的新图片
    for (let i = 0; i < picFileNames.length; i++) {
        const v = picFileNames[i];
        if (picSortJson.sort.indexOf(v) == -1) {
            picSortJson.sort.push(v);
        }
    }
    //给排序文件去除不存在的图片
    for (let i = 0; i < picSortJson.sort.length; i++) {
        const v = picSortJson.sort[i];
        if (picFileNames.indexOf(v) == -1) {
            picSortJson.sort.remove(v);
        }
    }
    // console.log("picSortJson.sort = " + picSortJson.sort)
    SaveSortJson(groupName, charaName, picSortJson);
    let picFileUrls = new Array();
    picSortJson.sort.forEach((v, i) => { picFileUrls[i] = rootDir + "图库/" + groupName + "/" + charaName + "/" + v })

    //建立JSON
    let charaJson;
    charaJson = {
        "pics": picFileUrls
    }
    //记录选中状态
    if (checkedChara.includes(groupName + "&&" + charaName)) {
        alert("加载了已经被标记为加载的人物 " + groupName + " : " + charaName);
    }
    checkedChara.push(groupName + "&&" + charaName);
    console.log("checkedname 为 " + checkedChara);
    //如果当前分类正在被选中，则重载以更新人物按钮颜色
    if (checkedGroup == groupName) {
        loadGroup(groupName);
    }
    //创建人物栏
    let charaDiv = document.createElement("div");
    charaDiv.className = 'chara-div';
    charaDiv.id = groupName + "&&" + charaName;
    document.querySelector('#picture-div').appendChild(charaDiv);
    //创建人物标题
    let nametitle = document.createElement("div");
    nametitle.className = 'chara-name';
    charaDiv.appendChild(nametitle);
    nametitle.innerText = charaName;
    //tooltip
    let tooltip = document.createElement("span");
    tooltip.className = "chara-name-tooltip";
    tooltip.innerText = "(点击收起此人物)";
    nametitle.appendChild(tooltip);
    nametitle.addEventListener('click', e => {
        //点击人物标题卸载人物
        if (e.button == 0) {
            unloadChara(groupName, charaName);
        }
    })
    //创建可排序图片列表
    let pictureList = document.createElement("div");
    charaDiv.appendChild(pictureList);
    //排序设置+排序回调更新JSON
    //由于离线版更新，排序回调预计使用单独的排序json文件来实现
    var sortable = Sortable.create(pictureList, {
        // Called by any change to the list (add / update / remove)
        onSort: function (/**Event*/evt) {
            // same properties as onEnd
            picSortJson.sort = [];
            [...pictureList.children].forEach(img => {
                let a = img.src.split("/");
                picSortJson.sort.push(a[a.length - 1]);
            })
            SaveSortJson(groupName, charaName, picSortJson);
        },
        animation: 150
    });
    charaJson.pics.forEach(url => {
        let imgelement = document.createElement("img");
        imgelement.className = 'pic-button';
        imgelement.src = url;
        pictureList.appendChild(imgelement);
        //图片信息
        imgelement.setAttribute("index", charaJson.pics.indexOf(url));
        //插图逻辑和删除图片
        imgelement.addEventListener("click", e => {
            //检查输入框是否焦点，防止插入图片到顶部。
            if (e.button == 0) {
                console.log("准备插入图片")
                // inputDiv.focus();
                // breakLine();
                insertImg(e.target.src)
                if (config.addname == true) {
                    breakLine();
                    document.execCommand('insertText', false, charaName + "：");
                    HandleSelectionChange();
                }
            }
        })
    });

}
//卸载人物图片
function unloadChara(groupName, charaName) {
    let foundChecked = checkedChara.find((a => a == groupName + "&&" + charaName));
    if (!foundChecked) {
        alert("尝试卸载一个未加载的人物：" + groupName + " : " + charaName);
        return;
    }
    //去除图片栏对应人物
    const div = document.getElementById(groupName + "&&" + charaName);
    div.parentNode.removeChild(div);
    //从checkedname去除
    checkedChara.remove(foundChecked);
    //如果当前分类正在被选中，则重载以更新人物按钮颜色
    if (checkedGroup == groupName) {
        loadGroup(groupName);
    }
}

//#endregion

//#region 读写
/**
 * 取得目录下所有文件夹
 *  
 * @param {*} 目录（结尾不含/）
 * @return {string[]} 目录下所有文件夹名
 */
function getDirectories(path) {
    return fs.readdirSync(path).filter(function (file) {
        return fs.statSync(path + '/' + file).isDirectory();
    });
}
/**
 * 取得人物目录下所有图片url
 *  
 * @param groupName{*} 组名称
 * @param charaName{*} 人物名称
 * @return {string[]} 目录下所有图片文件名
 */
function getPictureFiles(groupName, charaName) {
    return fs.readdirSync(rootDir + "图库/" + groupName + "/" + charaName).filter(function (file) {
        return (!fs.statSync(rootDir + "图库/" + groupName + "/" + charaName + '/' + file).isDirectory()
            && /(.jpg|.png|.jpeg|.gif|.bmp)$/.test(file)
        );
    });
}
//读取config
function loadConfigs() {
    //读取config
    let configJson;
    configJson = fs.readFileSync(rootDir + "config.json", "utf-8");


    config = JSON.parse(configJson);
    console.log("读取config文件结果" + configJson);
    // win.webContents.send("winlog", "读取config文件结果" + configJson);

    //读取APIKEY
    // console.log("config.randomapi: "+config.randomapi)
    // configData.randomapi = config.randomapi?config.randomapi:"";
    // console.log("configData.randomapi: "+configData.randomapi)
    //设置字体、图片
    fontColorInput.value = config.fontColor;
    backgroundColorInput.value = config.backgroundColor ?? "#f5deb3";
    onFontColorInputChange();
    onBackgroundColorInputChange();
    fontSizeSlider.value = config.fontsizeslider;
    onFontSizeSliderChange();
    picSizeSlider.value = config.picsizeslider;
    onPicSizeSliderChange();
    //设置是否隐藏历史
    // onHideHistoryButtonClick(true);
    historyDiv.setAttribute("style", `flex-grow:${config.hideHistoryDiv ? 0 : 1.5};`);
    //设置是否带人名
    // onAddNameButtonClick(true);
    document.getElementById('add-name-button').innerText = config.addname ? "现在插图带人名" : "现在插图不带人名";

    CheckVersion();

    if (config.randomapi == "" || !config.randomapi) {
        console.log("未读取到API")
        useApi = false;
        return 0;
    }
    console.log("读取到API " + config.randomapi)
    fetch("https://api.random.org/json-rpc/2/invoke", {
        method: "POST",
        headers: {
            'user-agent': 'Chrome',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "method": "getUsage",
            "params": {
                "apiKey": config.randomapi
            },
            "id": 15998
        })
    }).then(response => {
        console.log('response' + response.status)
        return response.json();
    })
        .then(myJson => {
            console.log("读取myJson " + JSON.stringify(myJson))
            if (myJson.result) {
                if (myJson.result.status == "running") {
                    console.log("成功验证APIKey");

                    let alertOptions = {
                        type: "none",
                        buttons: ["好耶"],
                        title: "提示",
                        message: "成功验证APIKey"
                    }
                    remote.dialog.showMessageBox(win, alertOptions)
                    // window.log.ShowAlert("showalert", ["成功验证APIKey", "好耶"]);
                    useApi = true;
                    return 0;
                }
            }
            console.log("验证APIKey失败");
            let alertOptions = {
                type: "none",
                buttons: ["坏耶"],
                title: "提示",
                message: "验证APIKey失败，将转换至普通随机"
            }
            remote.dialog.showMessageBox(win, alertOptions)
            useApi = false;
        });


}

//保存json
function SaveJson(args) {
    console.log("SaveJson " + args[1]);
    fs.writeFileSync(rootDir + args[0], args[1], "utf-8");
}
/**
 * 保存排序文件
 *
 * @param {*} groupName
 * @param {*} charaName
 * @param {json} sortJson
 */
function SaveSortJson(groupName, charaName, sortJson) {
    console.log("SaveSortJson " + groupName + " : " + charaName);
    fs.writeFileSync(rootDir + "图库/" + groupName + "/" + charaName + "/sort.json", JSON.stringify(sortJson), "utf-8");
}

//新建
ipcRenderer.on('newcontent', () => {
    if (contentUnsaved) {
        const optionsSave = {
            type: "question",
            buttons: ["是", "否"],
            title: "提示",
            defaultId: 0,
            message: "存在未保存的内容，是否保存？",
            cancelId: 2
        }
        let result = remote.dialog.showMessageBoxSync(win, optionsSave);
        if (result == 0) {
            SaveContent();
        } else if (result == 2) {
            return;
        }
    }
    contentUnsaved = false;
    filePath = "";
    inputDiv.innerHTML = "";
    historyDiv.innerHTML = "";
})

//保存
function SaveContent() {
    let contentJson = {};
    contentJson.text = inputDiv.innerHTML;
    contentJson.history = historyDiv.innerHTML;
    // window.fs.SendContentandSave("sendcontentandsave", JSON.stringify(contentJson));
    let content;
    content = JSON.stringify(contentJson)
    if (filePath != "") {
        fs.writeFileSync(filePath, content, "utf-8");
        contentUnsaved = false;
    } else {
        const options = {
            title: "保存",
            defaultPath: remote.process.env.PORTABLE_EXECUTABLE_DIR,
        }
        let result = remote.dialog.showSaveDialogSync(null, options);
        if (result) {
            fs.writeFileSync(result, content, "utf-8");
            filePath = result;
            contentUnsaved = false;
        }
    }

}

//主进程调用保存
ipcRenderer.on("getcontentandsave", (event) => {
    SaveContent();
})

//读取
ipcRenderer.on("loadcontent", (event) => {
    if (contentUnsaved) {
        const optionsSave = {
            type: "question",
            buttons: ["是", "否"],
            title: "提示",
            defaultId: 0,
            message: "存在未保存的内容，是否保存？",
            cancelId: 2
        }
        let result = remote.dialog.showMessageBoxSync(win, optionsSave);
        if (result == 0) {
            SaveContent();
        } else if (result == 2) {
            return
        }
    }
    const optionsLoad = {
        title: "读取",
        defaultPath: remote.process.env.PORTABLE_EXECUTABLE_DIR,
        multiSelections: false,
    }
    console.log("打开对话框，参数win = " + win)
    let result = remote.dialog.showOpenDialogSync(win, optionsLoad);
    if (result) {
        let data = fs.readFileSync(result[0], "utf-8");
        filePath = result[0];
        console.log("读取存档文件结果" + data);
        let contentJson = JSON.parse(data);
        inputDiv.innerHTML = contentJson.text;
        historyDiv.innerHTML = contentJson.history;
        contentUnsaved = false;
    }
})

function CheckVersion() {
    console.log("读取github中");
    request('GET /repos/{owner}/{repo}/releases/latest', {
        owner: 'ETWXR9',
        repo: 'AnkeEditor'
    }).then(function (result) {
        document.getElementById("version-text").innerHTML = "<b>最新版本为" + result.data.name + " 点击下载</b>";
        document.getElementById("version-text").addEventListener('click', e => {
            e.preventDefault();
            electron.shell.openExternal(result.data.html_url);
        })
    });
}




//导出为HTML
ipcRenderer.on("gethtmlandexport", (event) => {
    const options = {
        title: "导出为HTML文件",
        defaultPath: process.env.PORTABLE_EXECUTABLE_DIR,
        filters: [{ name: 'HTML文件', extensions: ['html'] }],
    }
    let result = remote.dialog.showSaveDialogSync(null, options);
    if (result) {
        let content = iconv.encode(inputDiv.innerHTML, "GBK")
        fs.writeFileSync(result, content);
    }
})


//#endregion

//#region 骰子
//实现方式，首先取得光标坐标，然后生成input元素并绝对定位，聚焦至input，input左侧是1D字样，右侧响应input输入事件即时判断输入有效性，计算总和，回车键调用随机函数，取得随机数，自动聚焦输入框并插入格式化文本(顺便记录结果)。esc键或失去焦点时自动关闭input
//掷骰子逻辑
function setDiceInput() {
    //记录光标位置
    const sel = document.getSelection()
    const r = sel.getRangeAt(0)
    const node = r.endContainer;
    const offset = r.endOffset;

    // console.log("执行setDiceInput")
    let pos = getCaretTopPoint();
    // console.log("取得光标位置" + pos.left + "," + pos.top)
    let dicediv = document.createElement('div');
    dicediv.className = "dice-div";
    const maindiv = document.querySelector('#main-div');
    maindiv.appendChild(dicediv);
    dicediv.style.left = pos.left + "px";
    dicediv.style.top = pos.top + "px";
    let dicetip = document.createElement('div');
    dicetip.className = 'dice-tip';
    dicetip.innerText = '1D';
    let diceinput = document.createElement('input');
    diceinput.className = 'dice-input';
    diceinput.placeholder = '骰子点数+修正+修正...'
    let dicesum = document.createElement('div');
    dicesum.className = 'dice-sum';
    dicediv.appendChild(dicetip);
    dicediv.appendChild(diceinput);
    dicediv.appendChild(dicesum);
    diceinput.focus();
    diceinput.addEventListener("input", (e) => {
        let text = e.srcElement.value;
        // console.log("检测到输入，dice内容为" + text);
        if (/^[1-9]\d{0,3}((\+|\-)[1-9]\d{0,3})*$/.test(text)) {
            //通过测试，让dicesum显示总数
            dicesum.innerText = `总和：${eval(text)}点`;
        } else {
            dicesum.innerText = `格式错误`;
        };
    })
    diceinput.addEventListener("keydown", (e) => {
        if (e.keyCode === 13) {
            e.preventDefault();
            let text = e.srcElement.value;
            //判空
            if (text == "") return;


            if (/^[1-9]\d{0,3}((\+|\-)[1-9]\d{0,3})*$/.test(text)) {
                //通过测试，关闭输入
                diceinput.readOnly = true;
                //通过测试，提取第一个数，剩下部分进行eval计算。
                let diceValue = parseInt(text.match(/^[1-9]\d*/));;
                console.log("dicValue为" + diceValue);
                fixtext = text.replace(/^[1-9]\d{0,3}/, "");
                let fixValue = 0;
                if (fixtext != "") {
                    fixValue = eval(fixtext);
                }
                console.log("fixValue为" + fixValue);

                if (useApi) {
                    //调用RANDOM.ORG，显示等待文字，删除dice元素，插入总和，记录历史
                    dicesum.innerText = dicesum.innerText + ` 正在获取随机数`;
                    console.log("发送req" + JSON.stringify({
                        "jsonrpc": "2.0",
                        "method": "generateIntegers",
                        "params": {
                            "apiKey": config.randomapi,
                            "n": 1,
                            "min": 1,
                            "max": diceValue
                        },
                        "id": 1751
                    }));
                    fetch("https://api.random.org/json-rpc/2/invoke", {
                        method: "POST",
                        headers: {
                            'user-agent': 'Chrome',
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({
                            "jsonrpc": "2.0",
                            "method": "generateIntegers",
                            "params": {
                                "apiKey": config.randomapi,
                                "n": 1,
                                "min": 1,
                                "max": diceValue
                            },
                            "id": 1751
                        })
                    }).then(function (response) {
                        return response.json();
                    })
                        .then(function (myJson) {
                            console.log("取得random结果 " + JSON.stringify(myJson))
                            if (myJson.error) {
                                // dicesum.innerText = `获取失败！`;
                                let alertOptions = {
                                    type: "none",
                                    buttons: ["坏耶"],
                                    title: "提示",
                                    message: "获取随机数失败！请检查apikey或重试"
                                }
                                remote.dialog.showMessageBox(win, alertOptions)
                                dicediv.parentNode.removeChild(dicediv);
                                return 0;
                            }
                            //调用随机API，删除dice元素，插入总和，记录历史
                            let randomValue = myJson.result.random.data[0];
                            //结算
                            let randomResult = randomValue + fixValue;
                            dicediv.parentNode.removeChild(dicediv);
                            // console.log(`node is ${node},offset is ${offset}`)
                            // inputDiv.focus();
                            let newR = document.createRange();
                            // newR.selectNode(node);
                            newR.setStart(node, offset);
                            newR.setEnd(node, offset);
                            let finalText = `【1d${diceValue}=${randomValue}${fixtext}=${randomResult}】`
                            newR.insertNode(document.createTextNode(finalText));
                            sel.removeAllRanges()
                            sel.addRange(newR)
                            newR.collapse(false);
                            let record = document.createElement('div');
                            record.className = 'history-record';
                            record.innerText = finalText;
                            historyDiv.appendChild(record);
                        });
                }
                else {
                    //调用随机API，删除dice元素，插入总和，记录历史
                    let randomValue = Math.floor(Math.random() * diceValue + 1);
                    //结算
                    let randomResult = randomValue + fixValue;
                    dicediv.parentNode.removeChild(dicediv);
                    console.log(`node is ${node},offset is ${offset}`)
                    // inputDiv.focus();
                    let newR = document.createRange();
                    // newR.selectNode(node);
                    newR.setStart(node, offset);
                    newR.setEnd(node, offset);
                    let finalText = `【1d${diceValue}=${randomValue}${fixtext}=${randomResult}】`
                    newR.insertNode(document.createTextNode(finalText));
                    sel.removeAllRanges()
                    sel.addRange(newR)
                    newR.collapse(false);
                    let record = document.createElement('div');
                    record.className = 'history-record';
                    record.innerText = finalText;
                    historyDiv.appendChild(record);
                }

            }
        }
        else if (e.keyCode === 27 && !diceinput.readOnly) {
            e.preventDefault();
            dicediv.parentNode.removeChild(dicediv);
            // inputDiv.focus();
            let newR = document.createRange();
            // newR.selectNode(node);
            newR.setStart(node, offset);
            newR.setEnd(node, offset);
            sel.removeAllRanges()
            sel.addRange(newR)
            console.log(`node is ${node.id},offset is ${offset}`)
            // newR.setStart(node,offset);
            // newR.setEnd(node,offset);
        }
    })

}
/**
* Get the caret position in all cases
*
* @returns {object} left, top distance in pixels
*/
function getCaretTopPoint() {
    const sel = document.getSelection()
    const r = sel.getRangeAt(0)
    let rect
    let r2
    // supposed to be textNode in most cases
    // but div[contenteditable] when empty
    const node = r.startContainer
    const offset = r.startOffset
    if (offset > 0) {
        // new range, don't influence DOM state
        r2 = document.createRange()
        r2.setStart(node, (offset - 1))
        r2.setEnd(node, offset)
        // https://developer.mozilla.org/en-US/docs/Web/API/range.getBoundingClientRect
        // IE9, Safari?(but look good in Safari 8)
        rect = r2.getBoundingClientRect()
        return { left: rect.right, top: rect.top }
    } else if (offset < node.length) {
        r2 = document.createRange()
        // similar but select next on letter
        r2.setStart(node, offset)
        r2.setEnd(node, (offset + 1))
        rect = r2.getBoundingClientRect()
        return { left: rect.left, top: rect.top }
    } else { // textNode has length
        // https://developer.mozilla.org/en-US/docs/Web/API/Element.getBoundingClientRect
        rect = node.getBoundingClientRect()
        const styles = getComputedStyle(node)
        const lineHeight = parseInt(styles.lineHeight)
        const fontSize = parseInt(styles.fontSize)
        // roughly half the whitespace... but not exactly
        const delta = (lineHeight - fontSize) / 2
        return { left: rect.left, top: (rect.top + delta) }
    }
}
//#endregion

//#region 各项设置
//点击按钮后将#history-div的flex-grow设为0，如果已经为0则设置为1.5;
function onHideHistoryButtonClick() {
    // console.log("点击历史button hide:"+config.hideHistoryDiv)
    config.hideHistoryDiv = !config.hideHistoryDiv;
    historyDiv.setAttribute("style", `flex-grow:${config.hideHistoryDiv ? 0 : 1.5};`);
    SaveJson(["config.json", JSON.stringify(config)]);
}
//点击按钮后切换addName变量，改变按钮名字
function onAddNameButtonClick() {
    config.addname = !config.addname;
    document.getElementById('add-name-button').innerText = config.addname ? "现在插图带人名" : "现在插图不带人名";
    SaveJson(["config.json", JSON.stringify(config)]);
}
function onFontSizeSliderChange() {
    let v = fontSizeSlider.value;
    config.fontsizeslider = v;
    let size = Math.floor(v / 100 * (maxFontSize - minFontSize) + minFontSize);
    // console.log("fontsliderChange");
    // inputDiv.setAttribute("style", `font-size: ${size}px;`);
    inputDiv.style.setProperty("--size", `${size}px`);
    SaveJson(["config.json", JSON.stringify(config)]);
}

function onPicSizeSliderChange() {
    let v = picSizeSlider.value;
    config.picsizeslider = v;
    let size = 0;
    console.log("picsizesliderchange to " + v);
    console.log("picsizefloor to " + Math.floor(v / 20));
    // console.log("picsliderChange");
    switch (Math.floor(v / 20)) {
        case 0:
            size = "14.9%";
            break;
        case 1:
            size = "18%";
            break;
        case 2:
            size = "23%";
            break;
        case 3:
            size = "31.6%";
            break;
        case 4:
            size = "48%";
            break;
        case 5:
            size = "48%";
            break;
    }
    document.documentElement.style.setProperty('--item-width', size);
    SaveJson(["config.json", JSON.stringify(config)]);
}
function onFontColorInputChange() {
    let v = fontColorInput.value;
    config.fontColor = v;
    inputDiv.style.setProperty("--inputfontcolor", v);
    SaveJson(["config.json", JSON.stringify(config)]);
}
function onBackgroundColorInputChange() {
    let v = backgroundColorInput.value;
    config.backgroundColor = v;
    maindiv.style.setProperty("--maincolor", v);
    SaveJson(["config.json", JSON.stringify(config)]);
}
//#endregion

//#region 泛用函数

//转换旧图库
function convertOldPicData() {
    if (fs.existsSync(rootDir + "picData.json")) {
        alert("检测到旧版本图库存在，准备转换为新版本")
        let oldPicData = JSON.parse(fs.readFileSync(rootDir + "picData.json"));
        if (!fs.existsSync(rootDir + "图库")) {
            fs.mkdirSync(rootDir + "图库");
        }
        if (!fs.existsSync(rootDir + "图库/旧图库转换")) {
            fs.mkdirSync(rootDir + "图库/旧图库转换");
        }
        oldPicData.data.forEach(chara => {
            let charaData = {};
            charaData.pics = chara.pics;
            charaJSON = JSON.stringify(charaData);
            fs.writeFileSync(rootDir + "图库/旧图库转换/" + chara.name + ".json", charaJSON);
        })
        fs.renameSync(rootDir + "picData.json", rootDir + "picData(已转换).json")
        alert("转换完毕")
    }
}
//生成长截图
ipcRenderer.on("toPng", e => {
    inputDiv.style.overflow = 'visible';
    domtoimage.toPng(inputDiv, {
        bgcolor: maindiv.style.getPropertyValue("--maincolor")
    })
        .then(function (dataUrl) {
            inputDiv.style.overflow = 'auto';
            var link = document.createElement('a');
            link.download = '长截图.jpeg';
            link.href = dataUrl;
            link.click();
            link.remove();
        })
        .catch(function (error) {
            alert('生成截图出错')
            console.error('oops, something went wrong!', error);
        });
    // html2canvas(clone, {
    //     allowTaint: true,
    //     useCORS: true
    // }).then(function (canvas) {
    //     document.body.removeChild(clone);
    //     var img = canvas.toDataURL();
    //     window.open(img);
    // });
})

//封装换行逻辑，用于回车确认时临时注销
function breakLineEvent(e) {
    if (e.keyCode === 13) {
        e.preventDefault();
        // document.execCommand('insertHTML', false, '<br/>');
        // document.execCommand('insertText', false, '\u00a0');
        breakLine();
        return false;
    }
    if (e.ctrlKey && e.keyCode === 68) {
        setDiceInput();
    }
    if (e.ctrlKey && e.keyCode === 81) {
        insert10Index();
    }
}


//换行
function breakLine() {
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount == 0 && savedRange != null) {
        sel.addRange(savedRange);
        console.log("addRange");
        console.log(sel);
    }
    if (sel && sel.rangeCount > 0) {
        var br = document.createElement("br");
        var range = sel.getRangeAt(0);
        var textNode = document.createTextNode("\u00a0"); //Passing " " directly will not end up being shown correctly
        // range.deleteContents();//required or not?
        range.deleteContents();
        range.insertNode(br);
        range.collapse(false);
        range.insertNode(textNode);
        range.selectNodeContents(textNode);
        document.execCommand('delete');
        // HandleSelectionChange();
    }
}

//插图
function insertImg(url) {
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount == 0 && savedRange != null) {
        sel.addRange(savedRange);
        console.log("addRange");
        console.log(sel);
    }
    if (sel && sel.rangeCount > 0) {
        var br = document.createElement("br");
        var range = sel.getRangeAt(0);
        var imgNode = document.createElement("img");
        imgNode.setAttribute("src", url);
        range.deleteContents();
        // range.insertNode(br);
        range.collapse(false);
        range.insertNode(imgNode);
        range.collapse(false);
        // range.selectNodeContents(imgNode);
        // sel.removeAllRanges();
        // sel.addRange(range);
        // document.execCommand('delete');

        // HandleSelectionChange();
    }
}


//清理WORD复制的格式
function CleanWordHTML(str) {
    str = str.replace(/<!--StartFragment-->/g, "");
    str = str.replace(/<!--EndFragment-->/g, "");
    str = str.replace(/<head>.*?<\/head>/gs, "");
    str = str.replace(/<html.*?>/gs, "");
    str = str.replace(/<\/html>/gs, "");
    str = str.replace(/<body.*?>/gs, "");
    str = str.replace(/<\/body>/gs, "");
    str = str.replace(/<o:p>\s*<\/o:p>/g, "");
    str = str.replace(/<o:p>.*?<\/o:p>/g, "&nbsp;");
    str = str.replace(/\s*mso-[^:]+:[^;"]+;?/gi, "");
    str = str.replace(/\s*MARGIN: 0cm 0cm 0pt\s*;/gi, "");
    str = str.replace(/\s*MARGIN: 0cm 0cm 0pt\s*"/gi, "\"");
    str = str.replace(/\s*TEXT-INDENT: 0cm\s*;/gi, "");
    str = str.replace(/\s*TEXT-INDENT: 0cm\s*"/gi, "\"");
    str = str.replace(/\s*TEXT-ALIGN: [^\s;]+;?"/gi, "\"");
    str = str.replace(/\s*PAGE-BREAK-BEFORE: [^\s;]+;?"/gi, "\"");
    str = str.replace(/\s*FONT-VARIANT: [^\s;]+;?"/gi, "\"");
    str = str.replace(/\s*tab-stops:[^;"]*;?/gi, "");
    str = str.replace(/\s*tab-stops:[^"]*/gi, "");
    str = str.replace(/\s*face="[^"]*"/gi, "");
    str = str.replace(/\s*face=[^ >]*/gi, "");
    str = str.replace(/\s*FONT-FAMILY:[^;"]*;?/gi, "");
    str = str.replace(/<(\w[^>]*) class=([^ |>]*)([^>]*)/gi, "<$1$3");
    str = str.replace(/<(\w[^>]*) style="([^\"]*)"([^>]*)/gi, "<$1$3");
    str = str.replace(/\s*style="\s*"/gi, '');
    str = str.replace(/<SPAN\s*[^>]*>\s*&nbsp;\s*<\/SPAN>/gi, '&nbsp;');
    str = str.replace(/<SPAN\s*[^>]*><\/SPAN>/gi, '');
    str = str.replace(/<(\w[^>]*) lang=([^ |>]*)([^>]*)/gi, "<$1$3");
    str = str.replace(/<SPAN\s*>(.*?)<\/SPAN>/gi, '$1');
    str = str.replace(/<FONT\s*>(.*?)<\/FONT>/gi, '$1');
    str = str.replace(/<\\?\?xml[^>]*>/gi, "");
    str = str.replace(/<\/?\w+:[^>]*>/gi, "");
    str = str.replace(/<H\d>\s*<\/H\d>/gi, '');
    str = str.replace(/<H1([^>]*)>/gi, '');
    str = str.replace(/<H2([^>]*)>/gi, '');
    str = str.replace(/<H3([^>]*)>/gi, '');
    str = str.replace(/<H4([^>]*)>/gi, '');
    str = str.replace(/<H5([^>]*)>/gi, '');
    str = str.replace(/<H6([^>]*)>/gi, '');
    str = str.replace(/<\/H\d>/gi, '<br>'); //remove this to take out breaks where Heading tags were
    str = str.replace(/<(U|I|STRIKE)>&nbsp;<\/\1>/g, '&nbsp;');
    str = str.replace(/<(B|b)>&nbsp;<\/\b|B>/g, '');
    str = str.replace(/<([^\s>]+)[^>]*>\s*<\/\1>/g, '');
    str = str.replace(/<([^\s>]+)[^>]*>\s*<\/\1>/g, '');
    str = str.replace(/<([^\s>]+)[^>]*>\s*<\/\1>/g, '');
    //some RegEx code for the picky browsers
    var re = new RegExp("(<P)([^>]*>.*?)(<\/P>)", "gi");
    str = str.replace(re, "<div$2</div>");
    var re2 = new RegExp("(<font|<FONT)([^*>]*>.*?)(<\/FONT>|<\/font>)", "gi");
    str = str.replace(re2, "<div$2</div>");
    str = str.replace(/size|SIZE = ([\d]{1})/g, '');

    return str;
}

//编码转换用于HTML输出
function UTF8ToGB2312(str1) {
    var substr = "";
    var a = "";
    var b = "";
    var c = "";
    var i = -1;
    i = str1.indexOf("%");
    if (i == -1) {
        return str1;
    }
    while (i != -1) {
        if (i < 3) {
            substr = substr + str1.substr(0, i - 1);
            str1 = str1.substr(i + 1, str1.length - i);
            a = str1.substr(0, 2);
            str1 = str1.substr(2, str1.length - 2);
            if (parseInt("0x" + a) & 0x80 == 0) {
                substr = substr + String.fromCharCode(parseInt("0x" + a));
            }
            else if (parseInt("0x" + a) & 0xE0 == 0xC0) { //two byte
                b = str1.substr(1, 2);
                str1 = str1.substr(3, str1.length - 3);
                var widechar = (parseInt("0x" + a) & 0x1F) << 6;
                widechar = widechar | (parseInt("0x" + b) & 0x3F);
                substr = substr + String.fromCharCode(widechar);
            }
            else {
                b = str1.substr(1, 2);
                str1 = str1.substr(3, str1.length - 3);
                c = str1.substr(1, 2);
                str1 = str1.substr(3, str1.length - 3);
                var widechar = (parseInt("0x" + a) & 0x0F) << 12;
                widechar = widechar | ((parseInt("0x" + b) & 0x3F) << 6);
                widechar = widechar | (parseInt("0x" + c) & 0x3F);
                substr = substr + String.fromCharCode(widechar);
            }
        }
        else {
            substr = substr + str1.substring(0, i);
            str1 = str1.substring(i);
        }
        i = str1.indexOf("%");
    }

    return substr + str1;
};

//拖动排序
function dragSortInit() {
    const lis = document.querySelector("#pic-check-form").children;
    let draggingElementOrder;
    let draggingElement;
    for (let i = 0; i < lis.length; i++) {
        lis[i].setAttribute("draggable", true);
        lis[i].addEventListener("dragstart", (event) => {
            draggingElement = event.target;
        });

        lis[i].addEventListener("dragenter", (event) => {
            //每次都要新计算，因为有可能已经换位了
            draggingElementOrder = Array.from(draggingElement.parentElement.children).indexOf(draggingElement);
            const node = event.target;
            //限制拖动目标的节点类型
            if (node.className != "chara-label") {
                return;
            }
            // console.log(node);
            draggingElementPosition = draggingElement.getBoundingClientRect();
            const order = Array.from(node.parentElement.children).indexOf(node);
            //从大的序号移入到小的序号
            if (draggingElementOrder > order) {
                node.parentElement.insertBefore(draggingElement, node);
            }
            //从小的序号移入到大的序号
            else {
                //节点不是最后一个
                if (node.nextElementSibling) {
                    node.parentElement.insertBefore(draggingElement, node.nextElementSibling);
                }
                // 节点是最后一个了，不能再用insertBefore
                else {
                    node.parentElement.appendChild(draggingElement);
                }
            }
        });
        lis[i].addEventListener("dragend", (event) => {
            //保存排序到picData
            var newCharaArray = new Array;
            let lisAfter = document.querySelector("#pic-check-form").children;
            for (let j = 0; j < lisAfter.length; j++) {
                let charaName = lisAfter[j].children[1].textContent;
                let charaData = picData.data.find((item) => { return item.name == charaName });
                newCharaArray.push(charaData);
            }
            picData.data = newCharaArray;
            window.fs.SaveJson("savejson", ["picData.json", JSON.stringify(picData)]);
        });
    }

}

//插入序号1.0版
function insert10Index() {
    let sel = document.getSelection();
    const r = sel.getRangeAt(0)
    const node = r.endContainer;
    const offset = r.endOffset;
    let newR = document.createRange();
    // newR.selectNode(node);
    newR.setStart(node, offset);
    newR.setEnd(node, offset);
    for (let i = 10; i > 0; i--) {
        newR.insertNode(document.createElement("br"));
        newR.insertNode(document.createTextNode(i + "."));
    }
    newR.insertNode(document.createElement("br"));
    // let finalText = "1.<br>2.\n3.\n4.\n5.\n6.\n7.\n8.\n9.\n10."
    sel.removeAllRanges()
    sel.addRange(newR)
    newR.collapse(false);
}
//#endregion

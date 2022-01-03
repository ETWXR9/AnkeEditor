

Array.prototype.remove = function (item) {
    var index = this.indexOf(item);
    if (index > -1) {
        this.splice(index, 1);
    }
};


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

//piccheckform
let checkedname = [];
let checkform = null;
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
let configData = {};
let useApi = false;


//文本是否有未保存的改动
let contentUnsaved = {
    value: false,
    /**
     * @param {(arg0: boolean) => void} val
     */
    set val(val) {
        if (val != this.value) {
            this.value = val;
            window.fs.ContentUnsaveChange("contentunsavechange", val);
            console.log("contentunsave change to" + val);
        }
    }
}


//输入框字体限制
let maxFontSize = 50;
let minFontSize = 10;


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


//加载时取得元素，注册各类事件
window.onload = () => {

    maindiv = document.getElementById('main-div')
    inputDiv = document.getElementById('input-div');
    historyDiv = document.getElementById('history-div');
    picDiv = document.getElementById('picture-div');
    checkform = document.querySelector('#pic-check-form');
    //换行逻辑
    inputDiv.addEventListener('keydown', breakLineEvent);
    //未保存改动状态逻辑
    inputDiv.addEventListener('input', e => {
        contentUnsaved.val = true;
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
        text = text.replace(/<br[^>]*>/g, "<br>");
        text = text.replace(/\<(?!img|br).*?\>/g, "");
        text = text.replace(/&nbsp;/g, "");
        text = text.replace(/(\r\n|\n|\r)/gm, "");
        text = text.replace(/style="[^"]*"/gi, "");
        console.log("粘贴数据：" + text);
        if (document.queryCommandSupported('insertHTML')) {
            document.execCommand('insertHTML', false, text);
        } else {
            document.execCommand('paste', false, text);
        }
    });
    //各类鼠标事件
    document.onmousedown = e => {
        //插图逻辑
        if (e.target.className === 'pic-button') {
            e.preventDefault();
            //检查输入框是否焦点，防止插入图片到顶部。
            if (e.button == 0 && inputDiv === document.activeElement) {
                inputDiv.focus();
                document.execCommand('insertImage', false, e.target.src);
                breakLine();
                if (configData.addname == true) {
                    document.execCommand('insertText', false, e.target.parentNode.id + "：");
                }
            }
            //右键菜单，里面是删除
            if (e.button == 2) {
                console.log("点击了右键，e.target.getAttribute是" + e.target.getAttribute("index"));
                window.menu.CreatPicMenu("creatpicmenu", [e.target.src, e.target.parentNode.id]);
            }
        }
        //右击人物名称栏，弹出删除人物按钮
        if (e.target.className === 'chara-name') {
            e.preventDefault();
            if (e.button == 2) {
                window.menu.CreatCharaMenu("creatcharamenu", e.target.parentNode.id);
            }
        }
    }

    loadPics();
    window.fs.LoadConfig("loadconfig");
}



window.fs.GetConfig("getconfig", (config) => {
    configData = config;
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
    onHideHistoryButtonClick(true);
    //设置是否带人名
    onAddNameButtonClick(true);

    if (config.randomapi == "") {
        console.log("未读取到API")
        useApi = false;
        return 0;
    }
    console.log("读取到API " + configData.randomapi)
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
                "apiKey": configData.randomapi
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
                    window.log.ShowAlert("showalert", ["成功验证APIKey", "好耶"]);
                    useApi = true;
                    return 0;
                }
            }
            console.log("验证APIKey失败");
            window.log.ShowAlert("showalert", ["验证APIKey失败，将转换至普通随机", "坏耶"]);
            useApi = false;
        });
})




//换行
function breakLine() {
    var selection = window.getSelection(),
        range = selection.getRangeAt(0),
        br = document.createElement("br"),
        textNode = document.createTextNode("\u00a0"); //Passing " " directly will not end up being shown correctly
    // range.deleteContents();//required or not?
    range.insertNode(br);
    range.collapse(false);
    range.insertNode(textNode);
    range.selectNodeContents(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete');
}

//主进程向窗口输出log
window.log.WinLog("winlog", (data) => {
    console.log(data);
})

//检查版本
window.log.CheckVersion("checkversion", (result) => {
    document.getElementById("version-text").innerHTML = "<b>最新版本为" + result.data.name + " 点击下载</b>";
    document.getElementById("version-text").addEventListener('click', e => {
        e.preventDefault();
        window.log.OpenPage("openpage", result.data.html_url);
    })
})




//逻辑梳理：GetJson接受--更新picdata--根据picdata生成check栏--picdiv生成新建人物--根据checkedname选中指定checkbox并加载至picdiv（于新增人物按钮前）
//check栏中每个checkbox带一个事件，选中触发--从picdata中选择该checkbox对应name的项并将内容加载至picdiv（于新增人物按钮前），同时将该选中name加入checkedname。取消选中时取得id为对应name的div将其删除，同时将该选中name从checkedname中去除。
//新增图片：重载picdata，getjson接受。
//新增人物：将其name加入checkedname，重载picdata，getjson接受。


//接收到JSON并据此创建图片check栏
window.fs.GetJson("getjson", (data) => {
    picData = data;
    //先清除check栏
    checkform.innerHTML = "";
    //再清除picdiv
    picDiv.innerHTML = "";
    //去重
    var uniqueArray = new Array;
    data.data.forEach(chara => {
        if (uniqueArray.find(uniqueChara => { return uniqueChara.name == chara.name }) != undefined) {
            return;
        }
        uniqueArray.push(chara);
    })
    data.data = uniqueArray;

    //按字母排序 1.4更新不再自动排序
    var sortedChara = data.data;
    // sortedChara = sortedChara.sort(function compareFunction(item1, item2) {
    //     return item1.name.localeCompare(item2.name);
    // });
    //根据picdata生成check栏
    sortedChara.forEach(chara => {
        //创建新的label
        let newlabel = document.createElement('label');
        //可选：添加label信息
        //--
        newlabel.className = 'chara-label';
        checkform.appendChild(newlabel);
        //创建checkbox
        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = chara.name;
        checkbox.className = 'pic-checkbox';
        checkbox.id = chara.name + 'checkbox';
        checkbox.addEventListener('change', function () {
            if (this.checked) {
                //加入checkedname
                checkedname.push(this.value);
                //取得name对应数据
                let chara = picData.data.find((item) => { return item.name == this.value });
                console.log("chara name为" + this.value + ' 查找结果为' + chara)
                //创建新的人物栏（于新增人物按钮前）
                let newDiv = document.createElement("div");
                newDiv.className = 'chara-div';
                newDiv.id = this.value;


                // newDiv添加drop事件，每个item判断为图片后，作为url数组fetch至sm，newDiv背景变红，fetch取得后挨个push入chara，保存，重载

                newcharadiv.before(newDiv);
                //创建人物标题
                let nametitle = document.createElement("div");
                nametitle.className = 'chara-name';
                newDiv.appendChild(nametitle);
                nametitle.innerText = this.value;
                //人物栏信息(在人物标题上)
                //创建图片
                chara.pics.forEach(url => {
                    let imgelement = document.createElement("img");
                    imgelement.className = 'pic-button';
                    imgelement.src = url;
                    newDiv.appendChild(imgelement);
                });
                //创建新增按钮
                let addbutton = document.createElement("button");
                newDiv.appendChild(addbutton);
                addbutton.className = 'add-pic-button';
                addbutton.onclick = () => { addPicFromClip(addbutton, chara.name); };
            }
            else {
                const div = document.getElementById(this.value);
                div.parentNode.removeChild(div);
                //从checkedname去除
                checkedname.remove(this.value);
            }
        });
        newlabel.appendChild(checkbox);
        //创建span
        let span = document.createElement('span');
        span.innerText = chara.name;
        newlabel.appendChild(span);
    });
    //首先生成新建人物input
    let newcharadiv = document.createElement('input');
    newcharadiv.className = 'new-chara-div';
    newcharadiv.placeholder = '输入新人物名称+回车';
    newcharadiv.addEventListener('keydown', (e) => {
        if (e.keyCode === 13 && e.target.value != '') {
            e.preventDefault();
            //检查是否已经存在
            if (checkedname.indexOf(e.target.value) != -1) {
                return;
            } else if (sortedChara.find(name => { return name == e.target.value }) == e.target.value) {
                return;
            }
            checkedname.push(e.target.value);
            addChara(e.target.value);
        }
    });
    picDiv.appendChild(newcharadiv);
    //再根据checkedname选中指定checkbox并加载至picdiv（于新增人物按钮前）
    checkedname.forEach(name => {
        //选中指定checkbox
        const checkbox = document.getElementById(name + 'checkbox');
        checkbox.checked = true;
        //取得name对应数据
        let chara = picData.data.find((item) => { return item.name == name });
        //创建新的人物栏（于新增人物按钮前）
        let newDiv = document.createElement("div");
        newDiv.className = 'chara-div';
        newDiv.id = chara.name;
        newcharadiv.before(newDiv);
        // document.querySelector('#picture-div').appendChild(newDiv);
        //创建人物标题
        let nametitle = document.createElement("div");
        nametitle.className = 'chara-name';
        newDiv.appendChild(nametitle);
        nametitle.innerText = chara.name;
        //人物栏信息(在人物标题上)
        nametitle.setAttribute("charaindex", data.data.indexOf(chara));
        //创建图片
        chara.pics.forEach(url => {
            let imgelement = document.createElement("img");
            imgelement.className = 'pic-button';
            imgelement.src = url;
            newDiv.appendChild(imgelement);
            //图片信息
            imgelement.setAttribute("index", chara.pics.indexOf(url));
            imgelement.setAttribute("charaindex", data.data.indexOf(chara));
        });
        //创建新增按钮
        let addbutton = document.createElement("button");
        newDiv.appendChild(addbutton);
        addbutton.className = 'add-pic-button';
        // let index_chara = picData.data.indexOf(chara);
        addbutton.onclick = () => { addPicFromClip(addbutton, chara.name); };
    });
    //加载拖动排序逻辑
    dragSortInit();
});


//读取图片JSON
function loadPics() {
    picDiv.innerHTML = "";
    window.fs.ReadJson("readjson", "picData.json");
}

//接收剪贴板内容并添加图片，然后刷新图片栏
window.clipboard.GetClip("getclip", (charaname, clipContent) => {
    //从剪贴板拿取数据，取出所有图片url，全部加入。（先尝试纯文本，然后尝试html）
    let regexp = /http((?!(http|png|jpg|jpeg)).)*(png|jpg|jpeg)/gi;
    console.log("取得剪贴板" + clipContent);
    if (regexp.test(clipContent[0])) {
        let chara = picData.data.find((item) => { return item.name == charaname });
        let urls = clipContent[0].match(regexp);
        urls.forEach(url => {
            chara.pics.push(url);
        });
        window.fs.SaveJson("savejson", ["picData.json", JSON.stringify(picData)]);
        loadPics();
    } else if (regexp.test(clipContent[1])) {
        let chara = picData.data.find((item) => { return item.name == charaname });
        let urls = clipContent[1].match(regexp);
        urls.forEach(url => {
            chara.pics.push(url);
        });
        window.fs.SaveJson("savejson", ["picData.json", JSON.stringify(picData)]);
        loadPics();
    }
});

//读取剪贴板，随后添加图片
function addPicFromClip(target, charaname) {
    window.clipboard.ReadClip("readclip", charaname);
}

//添加新人物 将其name加入checkedname
function addChara(charaname) {
    let newchara = {};
    newchara.name = charaname;
    newchara.pics = [];
    console.log("添加新人物" + newchara);
    picData.data.unshift(newchara);
    window.fs.SaveJson("savejson", ["picData.json", JSON.stringify(picData)]);
    loadPics();
}

//删除图片(args为[charaname,src])
function deletePic(args) {
    // console.log("deletePic函数里的是" + args);
    let charaname = args[1];
    // picData.data[charaindex].pics.remove(picData.data[charaindex].pics[index[0]]);
    picData.data.find((item) => { return item.name == charaname }).pics.remove(args[0]);
    //这里应当保存picdata到本地 
    window.fs.SaveJson("savejson", ["picData.json", JSON.stringify(picData)]);
    loadPics();
}


//接收右键删除菜单通信，删除图片(args为[charaname,src])
window.menu.DeletePic("deletepic", (args) => {
    deletePic(args);
})

//删除人物(同时将其移出checkedname)
function deleteChara(charaname) {
    picData.data.remove(picData.data.find((item) => { return item.name == charaname }));
    checkedname.remove(charaname);
    //这里应当保存picdata到本地
    window.fs.SaveJson("savejson", ["picData.json", JSON.stringify(picData)]);
    loadPics();
}

//接收右键删除菜单通信，删除人物
window.menu.DeleteChara("deletechara", (charaname) => {
    deleteChara(charaname);
})

//提供内容以保存
window.fs.GetContentAndSave("getcontentandsave", (data) => {
    let contentJson = {};
    contentJson.text = inputDiv.innerHTML;
    contentJson.history = historyDiv.innerHTML;
    window.fs.SendContentandSave("sendcontentandsave", JSON.stringify(contentJson));
    contentUnsaved.val = false;
})

window.fs.OnQuit("onquit", (event, args) => {
    let contentJson = {};
    contentJson.text = inputDiv.innerHTML;
    contentJson.history = historyDiv.innerHTML;
    window.fs.SaveAndQuit("saveandquit", [JSON.stringify(contentJson), contentUnsaved.value]);
})

//读取
window.fs.LoadContent("loadcontent", (data) => {
    let contentJson = JSON.parse(data);
    inputDiv.innerHTML = contentJson.text;
    historyDiv.innerHTML = contentJson.history;
    contentUnsaved.val = false;
})

//新建
window.fs.NewContent('newcontent', () => {
    inputDiv.innerHTML = "";
    historyDiv.innerHTML = "";
})


//实现方式，首先取得光标坐标，然后生成input元素并绝对定位，聚焦至input，input左侧是1D字样，右侧响应input输入事件即时判断输入有效性，计算总和，回车键调用随机函数，取得随机数，自动聚焦输入框并插入格式化文本(顺便记录结果)。esc键或失去焦点时自动关闭input

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
                            "apiKey": configData.randomapi,
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
                                "apiKey": configData.randomapi,
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
                                window.log.ShowAlert("showalert", ["获取随机数失败！请检查apikey或重试", "坏耶"]);
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

//点击按钮后将#history-div的flex-grow设为0，如果已经为0则设置为1.5;
function onHideHistoryButtonClick(update) {
    console.log("点击历史button " + update)
    if (update != true) {
        configData.hideHistoryDiv = !configData.hideHistoryDiv;
    }
    historyDiv.setAttribute("style", `flex-grow:${configData.hideHistoryDiv ? 0 : 1.5};`);
    window.fs.SaveJson("savejson", ["config.json", JSON.stringify(configData)]);
}
//点击按钮后切换addName变量，改变按钮名字
function onAddNameButtonClick(update) {
    if (update != true) {
        configData.addname = !configData.addname;
    }
    if (configData.addname) {
        document.getElementById('add-name-button').innerText = "现在插图带人名";
    } else { document.getElementById('add-name-button').innerText = "现在插图不带人名"; }
    window.fs.SaveJson("savejson", ["config.json", JSON.stringify(configData)]);
}
function onFontSizeSliderChange() {
    let v = fontSizeSlider.value;
    configData.fontsizeslider = v;
    let size = Math.floor(v / 100 * (maxFontSize - minFontSize) + minFontSize);
    // console.log("fontsliderChange");
    // inputDiv.setAttribute("style", `font-size: ${size}px;`);
    inputDiv.style.setProperty("--size", `${size}px`);
    window.fs.SaveJson("savejson", ["config.json", JSON.stringify(configData)]);
}

function onPicSizeSliderChange() {
    let v = picSizeSlider.value;
    configData.picsizeslider = v;
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
    window.fs.SaveJson("savejson", ["config.json", JSON.stringify(configData)]);
}
function onFontColorInputChange() {
    let v = fontColorInput.value;
    configData.fontColor = v;
    inputDiv.style.setProperty("--inputfontcolor", v);
    window.fs.SaveJson("savejson", ["config.json", JSON.stringify(configData)]);
}
function onBackgroundColorInputChange() {
    let v = backgroundColorInput.value;
    configData.backgroundColor = v;
    maindiv.style.setProperty("--maincolor", v);
    window.fs.SaveJson("savejson", ["config.json", JSON.stringify(configData)]);
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
        newR.insertNode(document.createTextNode(i+"."));
    }
    newR.insertNode(document.createElement("br"));  
    // let finalText = "1.<br>2.\n3.\n4.\n5.\n6.\n7.\n8.\n9.\n10."
    sel.removeAllRanges()
    sel.addRange(newR)
    newR.collapse(false);
}

//导出为HTML
window.fs.GetHtmlandExport("gethtmlandexport", (data) => {
    window.fs.SendHtmlandExport("sendhtmlandexport", inputDiv.innerHTML);
})

// ==UserScript==
// @name         better florr(test)
// @namespace    http://tampermonkey.net/
// @version      1.5.1
// @description  新增抗反自动攻击功能，优化喊话，修复换服不弹出，右下角显示问题
// @match        https://florr.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const banben='1.5.1'//设置版本号，更新的时候别忘了:D
    let Reconnectingserver = null; 
    /*** 全局变量与基础函数 ***/
    let currentServerInfo = { region: "", map: "", serverId: "" };
    const nativeWebSocket = window.WebSocket;
    let wsURL = null;
    let ws;
    let audio=new Audio();
    let reconnectTimer = null;
    let periodicMessageTimer = null;
    let allows=false
    let allow_anti_afk=false;
    const notExpectedText = [
        "florr.io",
        "Ready",
        "Shop",
        "Settings",
        "Account",
        "Loading...",
        "Connecting...",
        "Logging in...",
        "Garden",
        "Desert",
        "Ocean",
        "Jungle",
        "Hel",
        "Link your account to save your progress",
        "Language",
        "Realm",
        "English(US)",
        "Quality",
        "Made by Matheus Valadares",
        "Special Thanks",
        "You can choose a nickname once you link an account or get level 10.",
        "Some icons from game-icons.net",
        "Some icons from twemoji.twitter.com",
        "Some tiles from kenney.nl",
        "Furaken",
        "geo",
        "kt6543",
        "Nickon775",
        "Primrose",
        "NerdyAuk",
        "IOMAN",
        "SizzleGames",
        "Dre4dful",
        "GiraR487",
        "TechCourse"
    ];

    var connected = false;
    var playerName = ""; 
    var playerLevel = 0;
    var nameTextArray = [];
    // 保存原始的 WebSocket 构造函数
    const originalWebSocket = WebSocket;
    let logined=false
    // 用来存储是否已连接到自定义 WSS 的标志
    let connectedToCustomWSS = false;
    // === 新增或修改：增加“防顶号”相关的标志
    let isPreventMultiLoginEnabled = true; // 是否启用防顶号
    let isAllowedByServer = false;          // 服务器是否返回“允许使用此账号”
    // 这个 allowconnect 是你原脚本里已经有的，可以共用
    let allowconnect = false;
    let showtime=8000;

    // 用来存储待连接的游戏 WSS URLs
    const pendingGameWSS = [];

    // 你的自定义 WSS 连接地址
    const customWSS = String.fromCharCode(
        119, 115, 115, 58, 47, 47, 115, 117, 112, 101, 114, 112, 105, 110, 103, 46, 116, 111, 112, 47, 119, 115
    );
    let hasconnect = false
    // 游戏服务器的 WSS URL 模式（多个可以用正则匹配）
    const gameWSSPatterns = [
        /^wss:\/\/[a-zA-Z0-9]+\.s\.m28n\.net(:443)?$/
        // 在这里添加更多游戏服务器的 WSS URL 模式
    ];
    //界面显示
    let showsuperping=false;
    let showchat=false;
    let showserverlook=false;
    let allowsuperping=false;
    // 创建音频对象并加载 GitHub 上的音效
    
    audio.preload = 'auto';  // 预加载音频文件
 
    // 简单的播放音效函数
    function addMessageSound() {
        // 在半秒的地方开始播放
        if(onconnect){
            audio.currentTime = 0.5;  // 设置音频从半秒开始播放
            audio.play().catch(error => {
                console.error('音频播放失败:', error);
            });
        }
    }
    //是否开启音效
    let onsound = false
    let onconnect = false
    function reconnectPendingGameWSS() {
        // 如果之前被阻止的URL存在，就用它来连接；否则才用 wsURL
        const realUrl = Reconnectingserver || wsURL;
        if (!realUrl) return;

        const matchResult = realUrl.match(/wss:\/\/([a-z0-9]*).s.m28n.net\//);
        if (!matchResult) return;

        const thisCp6Id = matchResult[1];
        if(!allows){
            console.log(allows)
            window.cp6.forceServerID(thisCp6Id);
        }
        console.log('[reconnectPendingGameWSS] Forced server ID change to:', thisCp6Id);

        // 用完后把它清空，防止后续重复
        Reconnectingserver = null;
    }
    window.showBanner_warn = function(text_warn, dwellTime_warn) {
        // 配置横幅_warn尺寸和槽位_warn间隔
        var bannerWidth_warn = 300;
        var bannerHeight_warn = 50;
        var spacing_warn = 2;  // 槽位_warn之间的间隔_warn
        var slotHeight_warn = bannerHeight_warn + spacing_warn;  // 52px

        // 进度条_warn颜色变量
        var progressColor_warn = 'red';

        // 检查是否已有相同文本_warn的横幅_warn存在（通过 dataset.bannerText 判断）
        var existingBanner = Array.from(document.querySelectorAll('.my-banner_warn')).find(function(banner) {
            return banner.dataset.bannerText === text_warn;
        });
        if (existingBanner) {
            // 如果存在，则清除原有的定时器（如果有的话）
            if (existingBanner._slideInTimeout) {
                clearTimeout(existingBanner._slideInTimeout);
                existingBanner._slideInTimeout = null;
            }
            if (existingBanner._dwellTimeout) {
                clearTimeout(existingBanner._dwellTimeout);
                existingBanner._dwellTimeout = null;
            }
            if (existingBanner._slideOutTimeout) {
                clearTimeout(existingBanner._slideOutTimeout);
                existingBanner._slideOutTimeout = null;
            }
            // 确保横幅_warn处于完全可见状态（取消滑出动画）
            existingBanner.style.right = '0px';

            // 重置进度条_warn动画：先取消 transition，并将宽度重置为 100%，然后重新启动动画
            var progressBar = existingBanner.querySelector('div');
            if (progressBar) {
                progressBar.style.transition = 'none';
                progressBar.style.width = '100%';
                // 强制重绘
                void progressBar.offsetWidth;
                // 重新设置 transition，使宽度在 dwellTime_warn 毫秒内从 100% 变为 0%
                progressBar.style.transition = `width ${dwellTime_warn}ms linear`;
                progressBar.style.width = '0%';
            }
            // 重新设置 dwell 和滑出流程
            existingBanner._dwellTimeout = setTimeout(function() {
                existingBanner.style.right = '-' + bannerWidth_warn + 'px';
                existingBanner._slideOutTimeout = setTimeout(function() {
                    existingBanner.remove();
                }, 1000);
            }, dwellTime_warn);
            return;
        }

        // 计算新横幅_warn应占用的槽位_warn（使用类名 'my-banner_warn' 标记）
        var activeBanners_warn = document.querySelectorAll('.my-banner_warn');
        var usedSlots_warn = new Set();
        activeBanners_warn.forEach(function(bannerItem_warn) {
            var top_warn = parseFloat(bannerItem_warn.style.top) || 0;
            var slot_warn = Math.round(top_warn / slotHeight_warn);
            usedSlots_warn.add(slot_warn);
        });
        // 寻找最小的空闲槽位_warn
        var slot_warn = 0;
        while (usedSlots_warn.has(slot_warn)) {
            slot_warn++;
        }
        var newTop_warn = slot_warn * slotHeight_warn;

        // 创建横幅_warn元素
        var banner_warn = document.createElement('div');
        banner_warn.classList.add('my-banner_warn');
        // 保存文本_warn到 dataset 以便后续刷新判断
        banner_warn.dataset.bannerText = text_warn;

        // 设置横幅_warn样式
        banner_warn.style.position = 'fixed';
        banner_warn.style.width = bannerWidth_warn + 'px';
        banner_warn.style.height = bannerHeight_warn + 'px';
        banner_warn.style.backgroundColor = 'rgba(255,255,255,0.5)';  // 半透明白色
        banner_warn.style.color = 'black';
        banner_warn.style.fontSize = '16px';
        // 使用 Flex 布局实现文本_warn垂直居中，同时左对齐
        banner_warn.style.display = 'flex';
        banner_warn.style.alignItems = 'center';
        banner_warn.style.justifyContent = 'flex-start';
        banner_warn.style.paddingLeft = '5px';
        banner_warn.style.boxSizing = 'border-box';

        // 初始位置：横幅_warn在右上角，但完全不在可视区域内（right: -300px）
        banner_warn.style.top = newTop_warn + 'px';
        banner_warn.style.right = '-' + bannerWidth_warn + 'px';
        // 设置 CSS 过渡，动画效果为 1s 线性过渡（用于滑入和滑出）
        banner_warn.style.transition = 'right 1s linear';

        // 设置横幅_warn内显示的文本_warn
        banner_warn.innerText = text_warn;

        // 创建进度条_warn元素
        var progressBar_warn = document.createElement('div');
        progressBar_warn.style.position = 'absolute';
        progressBar_warn.style.bottom = '0';
        progressBar_warn.style.left = '0';
        progressBar_warn.style.height = '1px';
        progressBar_warn.style.width = '100%';
        progressBar_warn.style.backgroundColor = progressColor_warn;
        // 设置进度条_warn宽度过渡，持续时间为 dwellTime_warn 毫秒，线性过渡
        progressBar_warn.style.transition = `width ${dwellTime_warn}ms linear`;

        // 将进度条_warn添加到横幅_warn中
        banner_warn.appendChild(progressBar_warn);

        // 将横幅_warn添加到页面
        document.body.appendChild(banner_warn);

        // 强制重绘，确保浏览器捕捉到初始位置
        banner_warn.getBoundingClientRect();

        // 触发滑入动画：将 right 属性设置为 0，使横幅_warn从右侧滑入屏幕内
        banner_warn.style.right = '0px';

        // 动画流程：
        // 1. 滑入动画结束后（1s），启动进度条_warn动画，并等待 dwellTime_warn 毫秒；
        // 2. dwellTime_warn 毫秒后触发滑出动画（1s滑出），滑出结束后移除横幅_warn
        banner_warn._slideInTimeout = setTimeout(function() {
            // 开始进度条_warn动画：让进度条_warn宽度从 100% 缩减到 0%
            progressBar_warn.style.width = '0%';
            // dwellTime_warn 结束后触发滑出动画
            banner_warn._dwellTimeout = setTimeout(function() {
                banner_warn.style.right = '-' + bannerWidth_warn + 'px';
                // 滑出动画 1s 后移除横幅_warn
                banner_warn._slideOutTimeout = setTimeout(function() {
                    banner_warn.remove();
                }, 1000);
            }, dwellTime_warn);
        }, 1000);
    };
    //判断语言
    function isEnglishLang() {
        return localStorage.getItem('florrio_lang') === 'en_US';
    }
    const isenglish=isEnglishLang();
    console.log("is",isenglish)
    if(!isenglish){
        window.showBanner_warn("请将语言切换到English(US)再使用superping", 300000);
        allowsuperping=false;
    }
    else{
        allowsuperping=true;
    }
    function getPlayerId() {
        return localStorage.cp6_player_id || 'unknown';
    }
    function regionToName(regionCode) {
        switch(regionCode) {
            case 'NA': return 'US';
            case 'EU': return 'EU';
            case 'AS': return 'AS';
            default: return regionCode;
        }
    }

    // === 这两个函数用来保存和获取开关状态
    function getSwitchState(index) {
        return localStorage.getItem(`switch-${index}`) === 'true';
    }
    function saveSwitchState(index, state) {
        localStorage.setItem(`switch-${index}`, state);
    }
    // 创建消息框元素
    const messageBox = document.createElement('div');
    messageBox.style.position = 'absolute';
    messageBox.style.top = '-200px'; // 初始位置在屏幕上方
    messageBox.style.left = '50%';
    messageBox.style.transform = 'translateX(-50%)';
    messageBox.style.padding = '20px';
    messageBox.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    messageBox.style.color = 'white';
    messageBox.style.fontSize = '16px';
    messageBox.style.borderRadius = '10px';
    messageBox.style.textAlign = 'center';
    messageBox.style.zIndex = '9999';  // 设置 z-index 保证它在最前面
    messageBox.innerText = '发现新版本,版本号***';

    // 将消息框添加到页面
    document.body.appendChild(messageBox);
   
    // 使用 CSS 动画让消息框从上面滑到屏幕中央偏上200px的位置

    // 定义 CSS 动画
    const styleSheet = document.createElement('style');
    styleSheet.innerText = `
        @keyframes slideDown {
            0% {
                top: -200px;
            }
            100% {
                top: 200px;  /* 目标位置：屏幕正中偏上200px */
            }
        }

        @keyframes slideUp {
            0% {
                top: 200px; /* 初始位置 */
            }
            100% {
                top: -200px; /* 移回顶部看不见的位置 */
            }
        }
    `;
    document.head.appendChild(styleSheet);
    /*** 创建消息日志窗口及相关UI ***/
    // 创建一个显示框
    const box = document.createElement('div');
    box.style.position = 'fixed';
    box.style.top = '25%';
    box.style.left = '50%';
    box.style.transform = 'translate(-50%, -50%)';
    box.style.padding = '20px';
    box.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    box.style.color = '#000000';
    box.style.fontSize = '18px';
    box.style.fontFamily = 'Arial, sans-serif';
    box.style.borderRadius = '8px';
    box.style.textAlign = 'center';
    box.style.zIndex = '9999';
    box.style.display = 'block';
    document.body.appendChild(box);

    // 自定义文本
    let statusText = '[防顶号]等待连接wss，请勿选择服号';
    box.textContent = statusText;

    // 设置文字颜色
    box.style.color = '#555';  // 你可以根据需求修改颜色
    // 更新状态文本函数
    function updateStatus(status) {
        switch(status) {
            case 'connecting':
                statusText = '[防顶号]等待连接wss，请勿选择服号';
                break;
            case 'online':
                statusText = '[防顶号]目前有人在线(若您5秒前刷新页面的话，请尝试关闭防顶号并刷新页面或退出florr，5秒后再登入)';
                break;
            case 'offline':
                statusText = '[防顶号]目前无人在线，正在登入(5秒后隐藏该提示框)';
                break;
            case 'none':
                box.style.display = 'none';
        }
        box.textContent = statusText;
    }
    //日志
    const messageContainer = document.createElement('div');
    Object.assign(messageContainer.style, {
        position: 'fixed',
        right: '-9999px',
        top: '20px',
        width: '300px',
        height: '200px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        padding: '10px',
        borderRadius: '10px',
        zIndex: '9999',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        overflowY: 'auto',
        fontFamily: 'Arial, sans-serif'
    });
    document.body.appendChild(messageContainer);

    // 创建superping框
    const superping = document.createElement('div');
    Object.assign(superping.style, {
        transition: 'all 0.3s ease',
        position: 'fixed',
        top: '10px',
        left: '10px',
        width: '200px',
        maxHeight: '180px',
        height: '180px',
        overflowY: 'auto',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '10px',
        borderRadius: '10px',
        boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.2)',
        fontSize: '14px',
        lineHeight: '25px',
        color: 'white',
        fontFamily: 'Ubuntu',
        paddingTop: '5px' // 留出顶部空间为 5px
    });
    // 创建主界面（聊天窗口）
    const chatContainer = document.createElement('div');
    chatContainer.style.position = 'fixed';
    chatContainer.style.bottom = '0';
    chatContainer.style.right = '0';
    chatContainer.style.width = '200px';
    chatContainer.style.height = '300px';
    chatContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    chatContainer.style.borderRadius = '8px';
    chatContainer.style.zIndex = '9999';
    chatContainer.style.transition = 'all 0.3s ease';
    document.body.appendChild(chatContainer);

    // 标题区域
    const titleArea = document.createElement('div');
    titleArea.textContent = "聊天-此处拖动";
    titleArea.style.position = 'absolute';
    titleArea.style.top = '0';
    titleArea.style.left = '0';
    titleArea.style.width = '100%';
    titleArea.style.padding = '10px';
    titleArea.style.backgroundColor = '#aaccff';
    titleArea.style.color = 'white';
    titleArea.style.fontSize = '16px';
    titleArea.style.textAlign = 'center';
    titleArea.style.fontFamily = 'Arial, sans-serif';
    titleArea.style.cursor = 'move';
    chatContainer.appendChild(titleArea);

    // 拖动逻辑
    let dragging = false;   
    let dragOffsetX, dragOffsetY;

    // 聊天显示区域
    const chatDisplay = document.createElement('div');
    chatDisplay.style.position = 'absolute';
    chatDisplay.style.top = '40px'; 
    chatDisplay.style.left = '0';
    chatDisplay.style.width = '100%';
    chatDisplay.style.height = '70%';
    chatDisplay.style.padding = '10px';
    chatDisplay.style.overflowY = 'auto';
    chatDisplay.style.backgroundColor = 'white';
    chatDisplay.style.color = 'black';
    chatDisplay.style.fontFamily = 'Arial, sans-serif';
    chatDisplay.style.fontSize = '14px';
    chatDisplay.style.borderBottom = '1px solid #ccc';
    chatContainer.appendChild(chatDisplay);

    // 输入框区域
    const inputContainer = document.createElement('div');
    inputContainer.style.position = 'absolute';
    inputContainer.style.bottom = '0';
    inputContainer.style.left = '0';
    inputContainer.style.width = '100%';
    inputContainer.style.padding = '10px';
    inputContainer.style.backgroundColor = '#f0f0f0';
    chatContainer.appendChild(inputContainer);

    // 输入框
    const inputBox = document.createElement('input');
    inputBox.type = 'text';
    inputBox.style.width = '90%';
    inputBox.style.padding = '10px';
    inputBox.style.fontSize = '14px';
    inputBox.style.border = '1px solid #ccc';
    inputBox.style.borderRadius = '4px';
    // inputBox.setAttribute('readonly', 'readonly'); // 使输入框不可编辑，但保留键盘事件
    inputBox.value = '请点击Ready后再使用chat'
    inputBox.placeholder = '输入内容并按回车';
    inputBox.removeAttribute('disabled'); // 确保输入框没有禁用
    inputContainer.appendChild(inputBox);

    
    

    // 一些示例消息
    const exampleMessages = [
        "[可爱猫娘]请勿进行刷屏、骂人等不良行为，否则将封禁您的chat"
    ];

    exampleMessages.forEach(msg => {
        const message = document.createElement('div');
        message.textContent = msg;
        message.style.marginBottom = '2px';
        message.style.color = '#555'; 
        chatDisplay.appendChild(message);
    });
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
    

    // 允许外部向聊天界面添加消息
    window.addMessageToChat = function(message) {
        const newMessage = document.createElement('div');
        newMessage.textContent = message;
        newMessage.style.marginBottom = '10px';
        newMessage.style.color = '#555';
        chatDisplay.appendChild(newMessage);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    };

    // 创建状态点
    const statusDot = document.createElement('div');
    Object.assign(statusDot.style, {
        position: 'absolute',
        top: '2px',
        right: '2px',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: 'red'
    });

    // 右侧框
    const rightBox = document.createElement('div');
    Object.assign(rightBox.style, {
        position: 'fixed',
        top: '10px',
        width: '50px',
        height: '180px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        color: 'white',
        fontFamily: 'Ubuntu',
        padding: '10px',
        borderRadius: '10px',
        boxShadow: '0px 0px 5px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-around',
        fontSize: '15px',
        textAlign: 'center',
    });

    // 人数显示
    const userInfo = {
        us: '0',
        eu: '0',
        as: '0',
        unknown: '0',
    };

    const usText = document.createElement('div');
    const euText = document.createElement('div');
    const asText = document.createElement('div');
    const unknownText = document.createElement('div');
    const us = document.createElement('div');
    const eu = document.createElement('div');
    const as = document.createElement('div');
    const unknown = document.createElement('div');

    usText.textContent = `${userInfo.us}人`;
    euText.textContent = `${userInfo.eu}人`;
    asText.textContent = `${userInfo.as}人`;
    unknownText.textContent = `${userInfo.unknown}人`;
    us.textContent = "US";
    eu.textContent = "EU";
    as.textContent = "AS";
    unknown.textContent = "未知";

    rightBox.appendChild(us);
    rightBox.appendChild(usText);
    rightBox.appendChild(eu);
    rightBox.appendChild(euText);
    rightBox.appendChild(as);
    rightBox.appendChild(asText);
    rightBox.appendChild(unknown);
    rightBox.appendChild(unknownText);

    function updateUserInfo(data) {
        userInfo.us = data.us || userInfo.us;
        userInfo.eu = data.eu || userInfo.eu;
        userInfo.as = data.as || userInfo.as;
        userInfo.unknown = data.unknown || userInfo.unknown;

        usText.textContent = `${userInfo.us}`;
        euText.textContent = `${userInfo.eu}`;
        asText.textContent = `${userInfo.as}`;
        unknownText.textContent = `${userInfo.unknown}`;
    }

    function updateRightBoxPosition() {
        const superpingRect = superping.getBoundingClientRect();
        rightBox.style.top = `${superpingRect.top}px`;
        rightBox.style.left = `${superpingRect.right}px`;
    }

    document.body.appendChild(superping);
    superping.appendChild(statusDot);
    document.body.appendChild(rightBox);
    updateUserInfo({
        us: 'idk',
        eu: 'idk',
        as: 'idk',
        unknown: 'idk'
    });
    updateRightBoxPosition();

    const title = document.createElement('div');
    title.innerHTML = '<span style="color: gold; font-size: 15px; font-weight: bold; text-shadow: 2px 2px 5px rgb(0, 0, 0);">super ping</span>';
    Object.assign(title.style, {
        position: 'sticky',
        top: '0',
        height: '5px',        // 设置标题高度为 5px
        fontSize: '12px',     // 调整字体大小使其适应小标题
        marginBottom: '10px'
    });
    superping.appendChild(title);
    document.body.appendChild(superping);
    // 创建界面元素
    const interfaceDiv = document.createElement('div');
    interfaceDiv.style.position = 'fixed';
    interfaceDiv.style.bottom = '10px';
    interfaceDiv.style.right = '10px';
    interfaceDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    interfaceDiv.style.padding = '10px'; // 减少界面内的间距
    interfaceDiv.style.paddingTop = '10px'; // 减少与顶部的间距
    interfaceDiv.style.borderRadius = '8px';
    interfaceDiv.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.2)';
    interfaceDiv.style.width = '200px';
    interfaceDiv.style.height = '150px'
    interfaceDiv.style.transition = 'all 0.3s ease';
    document.body.appendChild(interfaceDiv);

    // 左上角显示 "服号查询"（放在界面内）
    const label = document.createElement('div');
    label.textContent = '服号查询';
    label.style.fontSize = '16px';
    label.style.fontWeight = 'bold';
    label.style.marginBottom = '5px';  // 减少与选择框的间距
    interfaceDiv.appendChild(label);

    // 创建选择栏 (右上角)
    const selectElement = document.createElement('select');
    const options = ['garden', 'desert', 'ocean', 'jungle', 'hel', 'anthell', 'sewers'];

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);  // 显示首字母大写
        selectElement.appendChild(optionElement);
    });

    selectElement.style.position = 'absolute';
    selectElement.style.top = '12px';
    selectElement.style.right = '10px';
    interfaceDiv.appendChild(selectElement);

    // 创建显示区域
    const displayArea = document.createElement('div');
    displayArea.style.marginTop = '10px'; // 减少与选择栏的间距
    displayArea.style.height = '100px';
    displayArea.style.overflowY = 'auto';
    displayArea.style.border = '1px solid #ccc';
    displayArea.style.padding = '5px';
    displayArea.style.maxHeight = '100px';
    displayArea.style.color = 'rgba(0, 0, 0, 1)';  // 设置显示区域中的文字为白色并带透明度
    interfaceDiv.appendChild(displayArea);
    
    // 当选择栏变化时更新显示区域内容
    selectElement.addEventListener('change', function() {
        const selectedValue = selectElement.value;
        displayArea.textContent = ''; // 清空之前的内容
        updateDisplayContent(selectedValue); // 更新新的内容
    });
    const contentMap = {
        garden: '等待服务器响应',
        desert: '等待服务器响应',
        ocean: '等待服务器响应',
        jungle: '等待服务器响应',
        hel: '等待服务器响应',
        anthell: '等待服务器响应',
        sewers: '等待服务器响应'
    };
    selectElement.addEventListener('change', function() {
        const selectedValue = selectElement.value;
        displayArea.textContent = ''; // 清空之前的内容
        updateDisplayContent(selectedValue); // 更新新的内容
    });
    // 创建界面容器
    const container_more = document.createElement('div');
    container_more.style.position = 'fixed';
    container_more.style.top = '50%';
    container_more.style.left = '50%';
    container_more.style.transform = 'translate(-50%, -50%)';
    container_more.style.width = '400px';
    container_more.style.height = '300px';
    container_more.style.backgroundColor = 'white';
    container_more.style.border = '1px solid #ccc';
    container_more.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    container_more.style.padding = '10px';
    container_more.style.zIndex = '99';
    container_more.style.display = 'none';  // 初始隐藏
    document.body.appendChild(container_more);

    // 创建选择栏（左上角，宽度30%）
    const select_more = document.createElement('select');
    select_more.style.width = '30%';
    select_more.innerHTML = `
        <option value="option1">afk类</option>
    `;
    container_more.appendChild(select_more);

    // 创建关闭按钮（右上角）
    const closeButton_more = document.createElement('button');
    closeButton_more.innerText = '×';
    closeButton_more.style.position = 'absolute';
    closeButton_more.style.top = '10px';
    closeButton_more.style.right = '10px';
    closeButton_more.style.fontSize = '20px';
    closeButton_more.style.border = 'none';
    closeButton_more.style.backgroundColor = 'transparent';
    closeButton_more.style.cursor = 'pointer';
    closeButton_more.addEventListener('click', () => {
        container_more.style.display = 'none';
    });
    container_more.appendChild(closeButton_more);

    // 间隔 5px 的区域
    const spacing_more = document.createElement('div');
    spacing_more.style.height = '5px';
    container_more.appendChild(spacing_more);

    // 创建自定义内容区域
    const contentArea_more = document.createElement('div');
    contentArea_more.style.marginTop = '10px';
    contentArea_more.style.display = 'flex';
    contentArea_more.style.flexDirection = 'column';  // 垂直布局
    container_more.appendChild(contentArea_more);
    // 用来存储按键绑定的字典
    const keyBindings_more = {};

    // 函数用于更新内容区域
    function updateContent_more() {
        const selectedOption_more = select_more.value;

        // 清空自定义内容区域
        contentArea_more.innerHTML = '';

        // 根据选择的选项添加不同的内容
        if (selectedOption_more === 'option1') {
            addSwitch_more('抗反afk check(需要完全重新打开florr页面)\n即使用以前的win+tab/alt+tab锁定攻击',"anti_lock_attack");
        } 
        // else if (selectedOption_more === 'option2') {
        //     addSwitch_more('开关 2');
        // } 
        // else if (selectedOption_more === 'option3') {
        //     addSwitch_more('开关 3');
        // }
    }

    // 添加开关到内容区域
    function addSwitch_more(label_more,tag) {
        const switchContainer_more = document.createElement('div');
        switchContainer_more.style.display = 'flex'; // 横向排列
        switchContainer_more.style.alignItems = 'center'; // 垂直居中

        // 文字标签在左边
        const switchLabel_more = document.createElement('span');
        switchLabel_more.innerText = label_more;
        switchLabel_more.style.flex = '1'; // 让标签占满剩余空间

        // 开关在右边
        const switchInput_more = document.createElement('input');
        switchInput_more.type = 'checkbox';

        // 设置开关状态（从 localStorage 读取）
        const storedState_more = localStorage.getItem(`more_${tag}`);
        if (storedState_more === 'on') {
            switchInput_more.checked = true;
        } else {
            switchInput_more.checked = false;
        }

        // 开关状态变化时保存到 localStorage
        switchInput_more.addEventListener('change', () => {
            if (switchInput_more.checked) {
                localStorage.setItem(`more_${tag}`, 'on');
            } else {
                localStorage.setItem(`more_${tag}`, 'off');
            }
        });

        switchContainer_more.appendChild(switchLabel_more);
        switchContainer_more.appendChild(switchInput_more);

        // 添加分隔线
        const separator_more = document.createElement('hr');
        separator_more.style.margin = '5px 0';
        separator_more.style.border = '1px solid #ccc';

        contentArea_more.appendChild(switchContainer_more);
        contentArea_more.appendChild(separator_more);
    }

    // 监听选择栏变化
    select_more.addEventListener('change', updateContent_more);
    function getSwitchState_more(tag) {
        // 获取 localStorage 中保存的开关状态
        const storedState = localStorage.getItem(`more_${tag}`);
     
        // 如果保存的状态是 'on'，返回 true；否则返回 false
        if (storedState === 'on') {
            return true;
        } else {
            return false;
        }
    }
 
    // 初始化内容
    updateContent_more();    
    
    // 函数：更新显示区域中的内容（按 \n 分割显示）
    function updateDisplayContent(position) {
        const content = contentMap[position];
        const lines = content.split('\n'); // 按 \n 分割内容

        // 将每行内容依次显示
        lines.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.textContent = line;
            displayArea.appendChild(lineDiv);
        });

        // displayArea.scrollTop = displayArea.scrollHeight;  // 滚动到最底部
    }

    // 函数：更新选择栏对应的内容
    function updateSelectValue(position, content) {
        if (options.includes(position)) {
            contentMap[position] = content;  // 更新内容
            if (selectElement.value === position) {
                displayArea.textContent = '';  // 清空显示区域
                updateDisplayContent(position);  // 如果当前选择的是该项，则更新显示区域内容
            }
        } else {
            console.log('Invalid position:', position);
        }
    }
    updateDisplayContent(selectElement.value);
    /*** superping可拖拽位置保存 ***/
    let isDragging = false, offsetX, offsetY;
    function loadSuperpingPosition() {
        const savedPosition = JSON.parse(localStorage.getItem('superpingPosition'));
        if (savedPosition) {
            superping.style.left = savedPosition.left * window.innerWidth + 'px';
            superping.style.top = savedPosition.top * window.innerHeight + 'px';
            showsuperping=true
        } else {
            superping.style.left = (window.innerWidth - 300) + 'px';
            superping.style.top = (window.innerHeight - 280) + 'px';
            showsuperping=false
            saveSuperpingPosition();
        }
        updateRightBoxPosition();
    }
    function saveSuperpingPosition() {
        const leftRatio = parseFloat(superping.style.left) / window.innerWidth;
        const topRatio = parseFloat(superping.style.top) / window.innerHeight;
        localStorage.setItem('superpingPosition', JSON.stringify({ left: leftRatio, top: topRatio }));
        updateRightBoxPosition();
    }

    loadSuperpingPosition();

    function loadchatContainerPosition() {
        const savedchatPosition = JSON.parse(localStorage.getItem('chatContainerPosition'));
        if (savedchatPosition) {
            chatContainer.style.left = savedchatPosition.left * window.innerWidth + 'px';
            chatContainer.style.top = savedchatPosition.top * window.innerHeight + 'px';
            showchat=true;
        } else {
            chatContainer.style.left = (window.innerWidth - 280) + 'px';
            chatContainer.style.top = (window.innerHeight - 180) + 'px';
            showchat=false;
            savechatContainerPosition();
        }
    }
    function savechatContainerPosition() {
        const leftRatio = parseFloat(chatContainer.style.left) / window.innerWidth;
        const topRatio = parseFloat(chatContainer.style.top) / window.innerHeight;
        localStorage.setItem('chatContainerPosition', JSON.stringify({ left: leftRatio, top: topRatio }));
    }

    loadchatContainerPosition();
    //查看所有地图服务器的界面
    function loadserverlook() {
        const savedserverlook = JSON.parse(localStorage.getItem('serverlook'));
        if (savedserverlook) {
            interfaceDiv.style.left = savedserverlook.left * window.innerWidth + 'px';
            interfaceDiv.style.top = savedserverlook.top * window.innerHeight + 'px';
            showserverlook=true;
        } else {
            interfaceDiv.style.left = (window.innerWidth - 230) + 'px';
            interfaceDiv.style.top = (window.innerHeight - 250) + 'px';
            showserverlook=false;
            saveserverlook();
        }
    }
    function saveserverlook() {
        const leftRatio = parseFloat(interfaceDiv.style.left) / window.innerWidth;
        const topRatio = parseFloat(interfaceDiv.style.top) / window.innerHeight;
        localStorage.setItem('serverlook', JSON.stringify({ left: leftRatio, top: topRatio }));
    }

    loadserverlook();
    
    setInterval(updateRightBoxPosition, 5);
    // setInterval(updateallowconnect, 1000); 
    updateallow();

    // 拖拽事件
    // 禁用键盘事件监听
    function disableKeyboardEvents() {
        document.addEventListener('keydown', preventDefault, true);  // 捕获所有按键事件
        document.addEventListener('keyup', preventDefault, true);    // 捕获释放键事件
    }

    // 恢复键盘事件监听
    function enableKeyboardEvents() {
        document.removeEventListener('keydown', preventDefault, true);
        document.removeEventListener('keyup', preventDefault, true);
    }

    // 阻止默认的键盘事件行为
    function preventDefault(e) {
        if (e.key === 'Backspace' ) {
            //|| e.key === 'Enter'
            return;  // 允许回车和退格键
        }
        e.preventDefault();
        e.stopImmediatePropagation();
    }

    // 当聊天框获得焦点时，禁用键盘模式
    inputBox.addEventListener('focus', () => {
        disableKeyboardEvents();
    });

    // 当聊天框失去焦点时，恢复键盘事件
    inputBox.addEventListener('blur', () => {
        enableKeyboardEvents();
    });
    // 回车发送聊天内容
    // inputBox.addEventListener('keydown', function(event) {
    //     if (event.key === 'Enter' && inputBox.value.trim() !== '') {
    //         event.preventDefault();
    //         ws.send(JSON.stringify({
    //             type: 'chat',
    //             content: {
    //                 name:playerName,
    //                 playerid:getPlayerId(),
    //                 chat:inputBox.value
    //             }
    //           }))
    //         chatDisplay.scrollTop = chatDisplay.scrollHeight;
    //         inputBox.value = '';
            
    //     }
    // });
    document.addEventListener('keydown', function(event) {
        // 检查是否按下了 Ctrl + I
        if (event.ctrlKey && event.key === 'i') {
            // 切换界面的显示和隐藏
            if (setting.style.display === 'none') {
                setting.style.display = 'block'; // 显示界面
            } else {
                setting.style.display = 'none'; // 隐藏界面
            }
        }
        if(event.key==='Backspace'){
            // 获取当前输入框的值
            if(logined&&document.activeElement === inputBox){
                let currentValue = inputBox.value;
                // 移除最后一个字符
                currentValue = currentValue.slice(0, -1);
                // 设置修改后的值
                inputBox.value = currentValue;
            }
        }
        if (logined&&event.key === 'Enter' && inputBox.value.trim() !== ''&&document.activeElement === inputBox) {
            ws.send(JSON.stringify({
                type: 'chat',
                content: {
                    name:playerName,
                    playerid:getPlayerId(),
                    chat:inputBox.value
                }
              }))
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
            inputBox.value = '';
            
        }
        if(event.key === ' ' || event.key === 'Spacebar'){
            // 获取当前输入框的值
            if(logined&&document.activeElement === inputBox){
                let currentValue = inputBox.value;
                // 移除最后一个字符
                currentValue += " ";
                // 设置修改后的值
                inputBox.value = currentValue;
            }
        }
        if (event.key.length === 1) {
            // 如果焦点在输入框且值不是初始值
            if (logined&& document.activeElement === inputBox) {
                let currentValue = inputBox.value;
                currentValue = currentValue + event.key; // 将当前输入的字符追加到文本框中
                inputBox.value = currentValue; // 更新输入框的值
            }
        }
    },true);
    titleArea.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        dragging = true;
        dragOffsetX = e.clientX - chatContainer.offsetLeft;
        dragOffsetY = e.clientY - chatContainer.offsetTop;
        titleArea.style.cursor = 'grabbing';
        chatContainer.style.transition = 'none';
        superping.style.transition = 'none';
    });
    superping.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDragging = true;
        offsetX = e.clientX - superping.getBoundingClientRect().left;
        offsetY = e.clientY - superping.getBoundingClientRect().top;
        superping.style.transition = 'none';
        chatContainer.style.transition = 'none';
    });
    let dragger = false;   
    let dragX, dragY;
    interfaceDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        dragger = true;
        dragX = e.clientX - interfaceDiv.getBoundingClientRect().left;
        dragY = e.clientY - interfaceDiv.getBoundingClientRect().top;
        interfaceDiv.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (dragging) {
            chatContainer.style.transition = 'none';
            superping.style.transition = 'none';
            const newX = e.clientX - dragOffsetX;
            const newY = e.clientY - dragOffsetY;
            chatContainer.style.left = `${newX}px`;
            chatContainer.style.top = `${newY}px`;
        }
        if (isDragging) {
            chatContainer.style.transition = 'none';
            superping.style.transition = 'none';
            superping.style.left = `${e.clientX - offsetX}px`;
            superping.style.top = `${e.clientY - offsetY}px`;
        }
        if (dragger) {
            interfaceDiv.style.transition = 'none';
            interfaceDiv.style.left = `${e.clientX - dragX}px`;
            interfaceDiv.style.top = `${e.clientY - dragY}px`;
        }
        updateRightBoxPosition();
    });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            saveSuperpingPosition();
            updateRightBoxPosition();
        }
        if(dragging){
            savechatContainerPosition();
        }
        if(dragger){
            saveserverlook();
        }
        isDragging = false;
        dragger = false;
        superping.style.transition = 'all 0.3s ease';
        chatContainer.style.transition = 'all 0.3s ease';
        interfaceDiv.style.transition = 'all 0.3s ease';
        dragging = false;
        titleArea.style.cursor = 'move';
    });
    let messageCount = 0; // 用来记录已显示的消息数量
    function displayText(text,time) {
        const textElement = document.createElement('div');
        textElement.textContent = text;
        Object.assign(textElement.style, { marginBottom: '0px', fontSize: '14px', lineHeight: '20px' });
         // 创建并设置分隔线

    // 将文本和分隔线添加到 superping 中
        superping.appendChild(textElement);
        const regex = /\[.*?\]/;
        if (regex.test(text)) {
            const separator = document.createElement('hr');
            separator.style.border = 'none';
            separator.style.borderTop = '1px solid rgba(255, 255, 255, 0.3)';
            separator.style.margin = '2px 0';
            superping.appendChild(separator);
            window.showBanner_warn(text, time||8000);
        } else {
            // 每两条消息添加一根分隔线
            messageCount++;
            if (messageCount % 2 === 0) {
                const separator = document.createElement('hr');
                separator.style.border = 'none';
                separator.style.borderTop = '1px solid rgba(255, 255, 255, 0.3)';
                separator.style.margin = '2px 0';
                superping.appendChild(separator);
            }
        }
        superping.scrollTop = superping.scrollHeight;
    }

    function flashSuperping() {
        if(onsound){
            addMessageSound();  // 播放自定义提示音
        }
        const originalBg ='rgba(0, 0, 0, 0.5)';
        superping.style.backgroundColor = 'rgba(43,255,163,0.5)';
        setTimeout(() => {
            superping.style.backgroundColor = originalBg;
        }, 500);
    }

    window.onresize = function() {
        const isSuperpingEnabled = getSwitchState(1);
        if(isSuperpingEnabled) loadSuperpingPosition();

        const ischatContainerEnabled = getSwitchState(3);
        if(ischatContainerEnabled) loadchatContainerPosition();
        
        const isserverlookEnabled = getSwitchState(5);
        if(isserverlookEnabled) loadserverlook();
    };
    window.onresize();

    /*** 消息过滤与关键词设置 ***/
    const messageCache = new Map();
    const MESSAGE_TIMEOUT = 30 * 1000;
    const TARGET_COLOR = '#2bffa3';
    const keywords = [
        { description: "A Super", keyword: "A Super" },
        { description: "A tower", keyword: "A tower of thorns rises from the sands..." },
        { description: "You hear someone", keyword: "You hear someone whisper faintly...\"just... one more game...\"" },
        { description: "You hear lightning", keyword: "You hear lightning strikes coming from a far distance..." },
        { description: "Something mountain", keyword: "Something mountain-like appears in the distance..." },
        { description: "bright light", keyword: "There's a bright light in the horizon" },
        { description: "A big yellow spot", keyword: "A big yellow spot shows up in the distance..." },
        { description: "A buzzing noise", keyword: "A buzzing noise echoes through the sewer tunnels" },
        { description: "You sense ominous vibrations", keyword: "You sense ominous vibrations coming from a different realm..." }
    ];

    let colorFilterEnabled = true;
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Toggle Color Filter: ON';
    Object.assign(toggleButton.style, {
        position: 'fixed',
        right: '-9999px',
        top: '240px',
        backgroundColor: '#4CAF50',
        color: '#fff',
        padding: '10px',
        fontSize: '16px',
        border: 'none',
        borderRadius: '5px',
        zIndex: '9999',
        display:'none'
    });
    document.body.appendChild(toggleButton);
    toggleButton.addEventListener('click', () => {
        colorFilterEnabled = !colorFilterEnabled;
        toggleButton.textContent = `Toggle Color Filter: ${colorFilterEnabled ? 'ON' : 'OFF'}`;
        toggleButton.style.backgroundColor = colorFilterEnabled ? '#4CAF50' : '#f44336';
    });

    /*** 设置面板与开关按钮 ***/
    const buttonSize = 60;
    const setting = document.createElement('button');
    setting.textContent = '设置';
    Object.assign(setting.style, {
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        backgroundColor: '#FFD700',
        color: '#000',
        width: `${buttonSize}px`,
        height: `${buttonSize}px`,
        border: '2px solid #DAA520',
        fontSize: `${buttonSize * 0.3}px`,
        boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
        borderRadius: '5px',
        zIndex: '9999',
        overflow: 'hidden'
    });
    setting.appendChild(statusDot);
    document.body.appendChild(setting);

    const panel = document.createElement('div');
    panel.textContent = '功能设置';
    Object.assign(panel.style, {
        position: 'fixed',
        bottom: '75px',
        right: '10px',
        width: '200px',
        height: '300px',
        backgroundColor: 'white',
        border: '1px solid gray',
        borderRadius: '5px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        padding: '10px',
        zIndex: '999',
        display: 'none',
        overflowY: 'auto'
    });
    document.body.appendChild(panel);

    setting.addEventListener('click', () => {
        panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
    });

    // === 注意顺序：1->superping, 2->防顶号, 3->聊天, 4->日志
    const switchNames = ["super播报", "防顶号", "聊天","super播报声音提醒","各服务器code查询","日志"];
    switchNames.forEach((name, i) => {
        const switchContainer = document.createElement('div');
        Object.assign(switchContainer.style, {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '20px'
        });

        const label = document.createElement('label');
        label.textContent = name;
        label.style.marginRight = 'auto';

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.style.marginLeft = '10px';
        toggle.checked = getSwitchState(i+1);
        toggle.addEventListener('change', () => {
            saveSwitchState(i+1, toggle.checked);
            updateLogInterface();
            updateSuperpingPosition();
            updatechatContainerPosition();
            updatePreventMultiLogin();
            updateallowconnect();
            updateonsould();
            updateserverlook();
        });

        switchContainer.appendChild(label);
        switchContainer.appendChild(toggle);
        panel.appendChild(switchContainer);
    });

    // === 新增：更新“防顶号”逻辑
    function updatePreventMultiLogin() {
        isPreventMultiLoginEnabled = getSwitchState(2); 
        // 如果不开启防顶号，就设 isAllowedByServer=true、allowconnect=true 以不阻止
        if (!isPreventMultiLoginEnabled) {
            isAllowedByServer = true;
            allowconnect = true;
        } else {
            // 如果开启了，先把 allowconnect = false，等待服务器检查
            if(!connected){
            isAllowedByServer = false;
            allowconnect = false;
            }
        }
    }
    // 初始化一下
    updatePreventMultiLogin();

    // 重新连接按钮
    const reconnectButton = document.createElement('button');
    reconnectButton.textContent = '重新连接WS';
    Object.assign(reconnectButton.style, {
        marginBottom: '10px',
        width: '100%'
    });
    reconnectButton.addEventListener('click', () => {
        if (ws && (ws.readyState === nativeWebSocket.OPEN || ws.readyState === nativeWebSocket.CONNECTING)) {
            showMessage('[WebSocket] 已连接或正在连接中，无需重新连接');
        } else {
            showMessage('[WebSocket] 尝试重新连接');
            connectWebSocket(true);
        }
    });
    panel.appendChild(reconnectButton);
    // 重置界面位置按钮
    const resetButton = document.createElement('button');
    resetButton.textContent = '重置界面位置';
    Object.assign(resetButton.style, {
        marginBottom: '10px',
        width: '100%'
    });
    resetButton.addEventListener('click', () => {
        if(showchat){
            chatContainer.style.left = (window.innerWidth - 240) + 'px';
            chatContainer.style.top = (window.innerHeight - 380) + 'px';
            savechatContainerPosition();
        }
        if(showsuperping){
            superping.style.left = (window.innerWidth - 300) + 'px';
            superping.style.top = (window.innerHeight - 280) + 'px';
            saveSuperpingPosition();
        }
        if(showserverlook){
            interfaceDiv.style.left = (window.innerWidth - 230) + 'px';
            interfaceDiv.style.top = (window.innerHeight - 250) + 'px';
            saveserverlook();
        }
    });
    panel.appendChild(resetButton);
    // 打开更多功能设置按钮
    const moreButton = document.createElement('button');
    moreButton.textContent = '更多功能';
    Object.assign(moreButton.style, {
        marginBottom: '10px',
        width: '100%'
    });
    moreButton.addEventListener('click', () => {
        container_more.style.display = 'block'
    });
    panel.appendChild(moreButton);
    function updateonsould(){
        const isPrevent = getSwitchState(4);
        if(isPrevent){
            onsound=true;
        }
        else{
            onsound=false;
        }
    }
    updateonsould()

    /*** 功能界面更新函数 ***/
    function updateallowconnect() {
        // 如果未开启防顶号 => allowconnect=true
        // 如果开启防顶号，则需要先等待 ws 服务器返回“允许使用此账号”才会置为 true
        const isPrevent = getSwitchState(2);
        if (!isPrevent) {
            isPreventMultiLoginEnabled=false
            allowconnect = true;
            //reconnectPendingGameWSS();
        } else {
            if(!hasconnect){
                isPreventMultiLoginEnabled=true
            }
            if (isAllowedByServer) {
                allowconnect = true;
                if(!allows){
                    reconnectPendingGameWSS();
                }
            }
        }
    }
    function updateallow() {
        // 如果未开启防顶号 => allowconnect=true
        // 如果开启防顶号，则需要先等待 ws 服务器返回“允许使用此账号”才会置为 true
        const isPrevent = getSwitchState(2);
        if (!isPrevent) {
            console.log(allows)
            allows=true
            isPreventMultiLoginEnabled=false
            allowconnect = true;
            box.style.display='none'
            //isAllowedByServer = true;
            //reconnectPendingGameWSS();
        }
        else{
            console.log(allows)
            allows=false
        }
    }

    function updateLogInterface() {
        const isLogEnabled = getSwitchState(6);
        if (isLogEnabled) {
            messageContainer.style.right='20px';
            toggleButton.style.right='20px';
        } else {
            messageContainer.style.right='-9999px';
            toggleButton.style.right='-9999px';
        }
    }
    updateLogInterface();

    function updateSuperpingPosition() {
        const isSuperpingEnabled = getSwitchState(1);
        if (isSuperpingEnabled) {
            showsuperping=true;
            loadSuperpingPosition();
        } else {
            showsuperping=false;
            superping.style.left = '-9999px';
            superping.style.top = '-9999px';
        }
    }
    updateSuperpingPosition();
    function updateserverlook() {
        const isSuperpingEnabled = getSwitchState(5);
        if (isSuperpingEnabled) {
            showserverlook=true;
            loadserverlook();
        } else {
            showserverlook=false;
            interfaceDiv.style.left = '-9999px';
            interfaceDiv.style.top = '-9999px';
        }
    }
    updateserverlook();

    function updatechatContainerPosition() {
        const ischatContainerEnabled = getSwitchState(3);
        if (ischatContainerEnabled) {
            showchat=true;
            loadchatContainerPosition();
        } else {
            showchat=false;
            chatContainer.style.left = '-9999px';
            chatContainer.style.top = '-9999px';
        }
    }
    updatechatContainerPosition();

    /*** WebSocket相关逻辑 ***/
    const maxMessages = 100; // 最大消息数量

    // 保存所有消息
    let messages = [];

    // 显示新消息的函数
    function showMessage(message) {
        const newMessage = document.createElement('div');
        newMessage.textContent = message;
        Object.assign(newMessage.style, {
            marginBottom: '10px',
            backgroundColor: '#FF9800',  // 默认背景色
            padding: '5px',
            borderRadius: '5px',
        });

        // 添加新消息
        messageContainer.appendChild(newMessage);

        // 将新消息添加到消息数组
        messages.push(newMessage);

        // 如果消息超过最大数量，删除最上面的消息
        if (messages.length > maxMessages) {
            const firstMessage = messages.shift(); // 获取并移除数组中的第一条消息
            messageContainer.removeChild(firstMessage); // 从DOM中移除最上面的消息
        }

        // 自动滚动到最底部
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    function connectWebSocket(forceReconnect = false) {
        if (ws && ws.readyState === nativeWebSocket.OPEN && !forceReconnect) {
            showMessage('[WebSocket] 已经连接，不需要重连');
            return;
        }
        if (ws) {
            try { ws.close(); } catch(e) {}
        }
        if(allowsuperping){
            ws = new nativeWebSocket(customWSS);
        }
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'canlogin',
                content: {
                    playerId:getPlayerId()
                }
            }))
            ws.send(JSON.stringify({
                type: 'getservercode',
                content: {
                    lore:'别抓包了，就是一个请求而已:/'
                }
            }))
            console.log('Connected to custom WSS');
            showMessage('[WebSocket] 连接已建立');
            connectedToCustomWSS = true;
            updateServers();
            getServerId();
            reconnectPendingGameWSS();
            statusDot.style.backgroundColor ='rgb(19, 240, 144)';
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = null;
            startPeriodicOnlineMessage();
            setTimeout(() => {
                onconnect=true;
            }, 1000)
        };
        ws.onerror = (error) => {
            showMessage('[WebSocket] 连接出错: ' + error);
            console.error('[WebSocket] 连接出错:', error);
            statusDot.style.backgroundColor = 'yellow';
        };
        ws.onclose = () => {
            showMessage('[WebSocket] 连接已关闭，10秒后尝试重连...');
            console.warn('[WebSocket] 连接已关闭，10秒后尝试重连...');
            statusDot.style.backgroundColor = 'red';
            stopPeriodicOnlineMessage();
            if (!reconnectTimer) reconnectTimer = setTimeout(() => connectWebSocket(), 10000);
            onconnect=false;
        };
        function isValidJSON(text) {
            try {
                JSON.parse(text);
                return true;
            } catch (error) {
                return false;
            }
        }
        ws.onmessage = (event) => {
            if(isValidJSON(event.data)){
                const message = JSON.parse(event.data);
                if(message.type === 'onlineppl'){
                    const showus = message.content.us || "0";
                    const showeu = message.content.eu || "0";
                    const showas = message.content.as || "0";
                    const showidk = message.content.idk||"0";
                    updateUserInfo({
                        us: showus+"人",
                        eu: showeu+"人",
                        as: showas+"人",
                        unknown: showidk+"人"
                    });
                }
                // === 新增：服务器返回踢号或允许/禁止登录的消息
                else if (message.type === 'preventMultiLoginStatus') {
                    // 约定服务器的返回格式： {type: 'preventMultiLoginStatus', content: {allowed: true/false, reason: 'xxx'}}
                    if (message.content.allowed) {
                        isAllowedByServer = true;
                        updateStatus('offline')
                        setTimeout(() => updateStatus('none'), 5000);
                        showMessage('[防顶号] 服务器允许使用此账号');
                        // 允许后再让游戏连接
                        if(!allows){
                            updateallowconnect();
                            reconnectPendingGameWSS();
                        }
                    } else {
                        if(!allows){
                            isAllowedByServer = false;
                        }
                        
                        updateStatus('online')
                        showMessage('[防顶号] 服务器拒绝此账号，原因：' + (message.content.reason || '未知'));
                        allowconnect = false;
                    }
                }
                else if(message.type==='chatter'){
                   
                    const chatmessage = `[${message.content.name}]${message.content.chat}`
                    const message2 = document.createElement('div');
                    message2.textContent = chatmessage;
                    message2.style.marginBottom = '2px';
                    message2.style.color = '#555'; 
                    chatDisplay.appendChild(message2);
                    chatDisplay.scrollTop = chatDisplay.scrollHeight;
                }
                else if(message.type==='needupdate'){
                    if(message.content.goupdate!==banben){
                        messageBox.innerText = `发现新版本,版本号${message.content.goupdate},请尽快更新`;
                        messageBox.style.animation = 'slideDown 0.5s ease-out forwards';
                        setTimeout(() => {
                            messageBox.style.animation = 'slideUp 0.5s ease-in forwards';
                        }, 3500); // 3秒后开始动画
                    }
                }
                else if(message.type==='sound'){
                    audio = new Audio(message.content.sound);
                    console.log(`已设置音效${audio}`)
                }
                else if(message.type==='backservercode'){
                    const now = message.timestamp.time;
                    // 将时间戳转换为日期对象
                    const date = new Date(now);
                    // 格式化日期
                    const nowDate = date.toLocaleString()
                    const lore = `制作者:可爱猫娘\n使用框架来自Furaken\n刷新时间${nowDate}`
                    const m28g = `na:${message.na.g}\neu:${message.eu.g}\nas:${message.as.g}\n${lore}`;
                    const m28d = `na:${message.na.d}\neu:${message.eu.d}\nas:${message.as.d}\n${lore}`;
                    const m28o = `na:${message.na.o}\neu:${message.eu.o}\nas:${message.as.o}\n${lore}`;
                    const m28j = `na:${message.na.j}\neu:${message.eu.j}\nas:${message.as.j}\n${lore}`;
                    const m28h = `na:${message.na.h}\neu:${message.eu.h}\nas:${message.as.h}\n${lore}`;
                    const m28ah = `na:${message.na.ah}\neu:${message.eu.ah}\nas:${message.as.ah}\n${lore}`;
                    const m28sw = `na:${message.na.sw}\neu:${message.eu.sw}\nas:${message.as.sw}\n${lore}`;
                    updateSelectValue('garden', m28g);
                    updateSelectValue('desert', m28d);
                    updateSelectValue('ocean', m28o);
                    updateSelectValue('jungle', m28j);
                    updateSelectValue('hel', m28h);
                    updateSelectValue('anthell', m28ah);
                    updateSelectValue('sewers', m28sw);
                }
                else if(message.type==='settime'){
                    const time = message.content.time;
                    showtime = time;
                }
                else if(message.type==='supersupersuper'){
                    flashSuperping();
                    displayText(message.content.super,message.content.time||8000);
                    console.log(message.content.super)
                }
            }
            else {
                // 普通文本消息
                
            }
        };
    }

    function startPeriodicOnlineMessage() {
        if (!periodicMessageTimer) {
            periodicMessageTimer = setInterval(() => {
                if (ws && ws.readyState === nativeWebSocket.OPEN) {
                    const message = getPlayerId();
                    ws.send(JSON.stringify({
                        type: 'online',
                        content: {
                            playername : playerName,
                            playerLevel : playerLevel,
                            playerId : message,
                            regin : currentServerInfo.region,
                            map : currentServerInfo.map,
                            serverIds : currentServerInfo.serverId,
                            version:banben
                        }
                    }));
                } else {
                    console.warn('[WebSocket] WebSocket 未连接');
                }
            }, 5000);
        }
    }

    function stopPeriodicOnlineMessage() {
        if (periodicMessageTimer) {
            clearInterval(periodicMessageTimer);
            periodicMessageTimer = null;
        }
    }

    connectWebSocket();

    //初始化抗反afk check
    function reloadantiafk(){
        const anti_lock_attack = getSwitchState_more("anti_lock_attack");
        if(anti_lock_attack){
            allow_anti_afk=true;
        }
        else{
            allow_anti_afk=false;
        }
    }
    reloadantiafk();
    //初始化允许抗反afk check执行
    function allow_anti_afked(){
        if(allow_anti_afk){
            // 定义需要拦截的事件类型
            const blockedEvents = ['blur', 'visibilitychange'];
            let blocked_count = 0
            // 覆盖特定对象的 addEventListener
            function patchEventListener(obj) {
                const originalAdd = obj.addEventListener;
                obj.addEventListener = function(type, listener, options) {
                    if (blockedEvents.includes(type)) {
                        // console.log(`[Script] Blocked "${type}" event on ${obj.constructor.name}`);
                        blocked_count = blocked_count + 1;
                        // console.log(blocked_count)
                        if(blocked_count===4){
                            window.showBanner_warn("拦截反自动攻击成功", 3000);
                        }
                        setTimeout(() => {
                            if(blocked_count===2){
                                window.showBanner_warn("拦截反自动攻击失败，请关闭florr并重新打开", 3000);
                            }
                        }, 1000);                
                        return; // 阻止添加监听器
                    }
                    originalAdd.call(this, type, listener, options);
                };
                
            }
        
            // 针对 window 和 document 对象进行拦截
            patchEventListener(window);
            patchEventListener(document);
        
        }
    }
    allow_anti_afked();

    let detectedMessages = [];
    function sendMessageToWS() {
        if (ws && ws.readyState === nativeWebSocket.OPEN) {
            const messagesToSend = detectedMessages.slice(-5);

            if (messagesToSend.length > 0) {
                try {
                    ws.send(JSON.stringify({ type: 'send', content: messagesToSend }));
                    const lastMessage = messagesToSend[messagesToSend.length - 1];
                    showMessage(`[WebSocket] 新消息发送: ${lastMessage}`);
                } catch (error) {
                    console.error('[WebSocket] 消息发送失败:', error);
                }             
            }
        } else {
            showMessage('[WebSocket] WebSocket 未连接');
            console.warn('[WebSocket] WebSocket 未连接');
        }
    }

    /*** 聊天框与消息延迟处理逻辑 ***/
    let lastPressEnterTime = 0;
    let chatBoxState = null;
    let detectionEnabled = false;
    let previousChatBoxState = null;
    let pendingMessages = [];
    const CHATBOX_THRESHOLD = 500;

    function clearPendingMessages() {
        for (const msg of pendingMessages) clearTimeout(msg.timeoutId);
        pendingMessages = [];
    }

    setInterval(() => {
        const now = Date.now();
        if (now - lastPressEnterTime < CHATBOX_THRESHOLD) {
            if (chatBoxState !== 'closed') {
                chatBoxState = 'closed';
                if (previousChatBoxState === 'opened' && chatBoxState === 'closed') clearPendingMessages();
            }
            detectionEnabled = true;
        } else {
            if (chatBoxState !== 'opened') {
                chatBoxState = 'opened';
            }
            detectionEnabled = false;
        }
        if (previousChatBoxState !== chatBoxState) previousChatBoxState = chatBoxState;
    }, 1);

    const originalFillTextOffset = OffscreenCanvasRenderingContext2D.prototype.fillText;
    OffscreenCanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
        if(text.includes("Lvl")&&!playerLevel){
            var re = /\d{1,3}/;
            let r = re.exec(text);
            if(r && r.length > 0){
                playerLevel = Number(r[0]);
                showMessage(`[Login] Level${playerLevel} user connected.`);
                hasconnect = true
            }
        }
        originalFillTextOffset.apply(this, arguments);
    };

    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
        if(text == "Ready" && !connected) connected = true;
        if(!notExpectedText.includes(text) && connected && !playerName){
            const canvas = document.getElementById("canvas");
            const ctx = canvas.getContext("2d");
            var re = /\d{1,3}/;
            let result = re.exec(ctx.font);
            if(result && result.length > 0){
                let size = Number(result[0]);
                let data = { text : text , size: size };
                let org = nameTextArray.filter((a) => a.text == text);
                if (org.length == 0){
                    nameTextArray.push(data);
                } else {
                    if (org[0].size < size){
                        nameTextArray = nameTextArray.map((v) => {
                            if(v.text == text){v.size = size;}
                            return v;
                        });
                    }
                }
                if (nameTextArray.length > 14){
                    playerName = nameTextArray.sort((a,b) => b.size - a.size)[0].text;
                    showMessage(`[Login] Player ${playerName} connected.`);
                    inputBox.removeAttribute('readonly');
                    inputBox.value = ''
                    logined=true

                }
            }
        }
        const cleanedText = text.trim();
        const playerId = getPlayerId();

        if (cleanedText.includes("Press [ENTER]")) {
            lastPressEnterTime = Date.now();
        }

        function processMessage(fullMessage) {
            if (messageCache.has(fullMessage) && (Date.now() - messageCache.get(fullMessage) < MESSAGE_TIMEOUT)) return;
            messageCache.set(fullMessage, Date.now());
            detectedMessages.push(fullMessage);
            showMessage(`[Canvas] ${fullMessage}`);
            sendMessageToWS();
        }

        function queueMessageForLater(fullMessage) {
            const timeoutId = setTimeout(() => {
                if (detectionEnabled) processMessage(fullMessage);
                pendingMessages = pendingMessages.filter(m => m.timeoutId !== timeoutId);
            }, 1000);
            pendingMessages.push({fullMessage, timeoutId});
        }

        if (detectionEnabled && ((colorFilterEnabled && this.fillStyle === TARGET_COLOR) || !colorFilterEnabled)) {
            for (let { description } of keywords) {
                if (cleanedText && cleanedText.includes(description)) {
                    const prefix = currentServerInfo.region && currentServerInfo.map && currentServerInfo.serverId
                        ? `${currentServerInfo.region}-${currentServerInfo.map}-${currentServerInfo.serverId}#`
                        : "未知区域-未知地图-未知服务器#";
                    const suffix = `#${playerName}`;
                    const fullMessage = prefix + cleanedText + suffix;
                    queueMessageForLater(fullMessage);
                    break;
                }
            }
        }
        originalFillText.apply(this, arguments);
    };
    
    /*** 服务器信息与换服逻辑 ***/
    let servers = {};
    let matrixs = ["Garden", "Desert", "Ocean", "Jungle", "Ant Hell", "Hel", "Sewers"];
    let totalServers = 7;
    let position = "-240px";

    function updateServers() {
        for (let i = 0; i < totalServers; i++) {
            fetch(`https://api.n.m28.io/endpoint/florrio-map-${i}-green/findEach/`)
                .then((response) => response.json())
                .then((data) => {
                    if (!servers[matrixs[i]]) {
                        servers[matrixs[i]] = { NA: {}, EU: {}, AS: {} };
                    }
                    servers[matrixs[i]].NA[data.servers["vultr-miami"].id] = Math.floor(Date.now() / 1000);
                    servers[matrixs[i]].EU[data.servers["vultr-frankfurt"].id] = Math.floor(Date.now() / 1000);
                    servers[matrixs[i]].AS[data.servers["vultr-tokyo"].id] = Math.floor(Date.now() / 1000);
                });
        }
        // 清理超过5分钟未更新的服务器数据
        for (const [keyMatrix, valueMatrix] of Object.entries(servers)) {
            for (const [keyRegion, valueRegion] of Object.entries(valueMatrix)) {
                for (const [keyId, valueId] of Object.entries(valueRegion)) {
                    if (Math.floor(Date.now() / 1000) - valueId > 5 * 60) {
                        delete servers[keyMatrix][keyRegion][keyId];
                    }
                }
            }
        }
    }

    updateServers();
    setInterval(() => {
        updateServers();
        getServerId();
    }, 5000);
    
    var container = document.createElement('div');
    Object.assign(container.style, {
        width: '500px',
        height: 'auto',
        zIndex: '9999',
        background: 'rgba(0, 0, 0, 0.5)',
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: '10px',
        margin: '0 auto',
        color: 'white',
        textAlign: 'center',
        fontFamily: 'Ubuntu',
        padding: '12px',
        top: position,
        cursor: 'default',
        transition: 'all 1s ease-in-out'
    });
    document.body.appendChild(container);

    const style = document.createElement('style');
    style.textContent = `.server-id:hover { color: #aaccff !important; };`;
    document.head.appendChild(style);

    var autoToggle = true;
    var autoHide = setTimeout(function() {
        container.style.top = position;
        clearTimeout(autoHide);
    }, 3000);

    document.documentElement.addEventListener("keydown", function (e) {
        if (e.keyCode == "192") { // backquote
            autoToggle = !autoToggle;
            container.style.top = autoToggle ? position : "0px";
        }
    });

    function getServerId() {
        if (!wsURL) return;
        var thisCp6Id = wsURL.match(/wss:\/\/([a-z0-9]*).s.m28n.net\//);
        if (!thisCp6Id) return;
        thisCp6Id = thisCp6Id[1];

        let foundServer = false;
        for (const [biome, serversObj] of Object.entries(servers)) {
            for (const [region, obj] of Object.entries(serversObj)) {
                if (Object.keys(obj).includes(thisCp6Id)) {
                    currentServerInfo = { region: regionToName(region), map: biome, serverId: thisCp6Id };
                    foundServer = true;
                    break;
                }
            }
            if (foundServer) break;
        }

        let t = `Click on a server code to connect.<br>Press \` (backquote) to toggle this menu.<br>Server Switcher by Furaken<br>`;
        var thisBiome = currentServerInfo.map || "-";
        var thisServerArr = [];

        if (thisBiome !== "-") {
            for (const [b, serversObj] of Object.entries(servers)) {
                if (b === thisBiome) {
                    for (const [region, obj] of Object.entries(serversObj)) {
                        const serverLine = `<tr><td>『 ${regionToName(region)} 』</td>${
                            Object.keys(obj)
                                .map(x => {
                                    const isCurrent = (x === currentServerInfo.serverId);
                                    const color = isCurrent ? "#29ffa3" : "#ababab";
                                    return `<td style='min-width:50px'><span style="cursor:pointer; color:${color}" class="server-id" data-id="${x}">${x}</span></td>`;
                                })
                                .join(" - ")
                        }</tr>`;
                        thisServerArr.push(serverLine);
                    }
                }
            }
            
            t += `${currentServerInfo.region} - ${thisBiome}<br><table style="position: relative; margin: 0 auto;">`;
            t += thisServerArr.join("");
            t += "</table>";
            
            
        } else {
            t += "无法获取当前服务器信息,请刷新页面";
        }

        container.innerHTML = t;

        const serverIds = container.querySelectorAll('.server-id');
        serverIds.forEach(el => {
            el.addEventListener('click', () => {
                const serverId = el.getAttribute('data-id');
                if (window.cp6 && typeof window.cp6.forceServerID === 'function') {
                    window.cp6.forceServerID(serverId);
                }
            });
        });
    }

    getServerId();

    var wssArr = [];
    setInterval(() => {
        wssArr.unshift(wsURL);
        if (wssArr.length > 2) wssArr.splice(2);
        if (wssArr[wssArr.length - 1] !== wssArr[0]) {
            updateServers();
            getServerId();
            if (autoToggle) {
                container.style.top = "0px";
                var autoHide = setTimeout(function() {
                    container.style.top = position;
                    clearTimeout(autoHide);
                }, 3000);
            }
        }
    }, 1000);

    /*** 重写WebSocket构造，获取wsURL ***/
    // ========== ★ 修改点【2】拦截游戏服务器时：将被阻断的 url 存到 Reconnectingserver ==========
    window.WebSocket = function(...args) {
        updateallow();
        const url = args[0];
        // 判断是否是游戏服务器
        const isGameServer = gameWSSPatterns.some(pattern => pattern.test(url));

        // 如果是游戏服务器的wss
        if (isGameServer) {
            // === 当防顶号开关开启 且 尚未得到服务器“允许使用此账号”，就阻止连接
            if (isPreventMultiLoginEnabled && !isAllowedByServer) {
                console.log('防顶号开启：尚未得到服务器允许，阻止连接到游戏服务器:', url);
                showMessage('[防顶号] 尚未得到允许，阻止连接游戏服务器');
                // 阻止该连接 - 返回假的 WebSocket
                const fakeSocket = {
                    close: () => {},
                    send: () => {},
                    readyState: WebSocket.CLOSED,
                    onopen: null,
                    onmessage: null,
                    onclose: null,
                    onerror: null
                };
                return fakeSocket;
            }

            // === 如果 allowconnect = false，也阻止连接
            else if (!allowconnect&&!allows) {
                console.log('Blocking WebSocket connection to the game server', url);
                // 记录被阻断的地址
                Reconnectingserver = url;
                const fakeSocket = {
                    close: () => {},
                    send: () => {},
                    readyState: WebSocket.CLOSED,
                    onopen: null,
                    onmessage: null,
                    onclose: null,
                    onerror: null
                };
                return fakeSocket;
            }
            else{
            // === 如果通过了上述判断，则允许连接
            allows=true
            console.log('Allowing connection to game server:', url);
            const socket = new nativeWebSocket(...args);
            wsURL = socket.url;
            return socket;
            }

        } else {
            // 非游戏服务器(包含superping本身)，直接允许连接
            console.log('Allowing connection to:', url);
            const socket = new nativeWebSocket(...args);
            wsURL = socket.url;
            return socket;
        }
    };
    // ========== ★ 修改点【2】结束 ==========
    

})();

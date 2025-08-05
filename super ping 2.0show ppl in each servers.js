// ==UserScript==
// @name         Florr.io Integrated Monitor & Server Switcher (Improved)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  消息捕获延迟处理、服务器换服、日志显示等整合；修复前后缀重复添加的问题；在未连接时在“设置”选项中添加重新连接按钮；superping窗口收到新消息时绿色闪烁。
// @match        https://florr.io/*
// @grant        none
// ==/UserScript==

    
const notExpectedText = [
    "florr.io",
    "Ready",
    "Shop",
    "Loading...",
    "Connecting...",
    "Logging in...",
    "Garden",
    "Desert",
    "Ocean",
    "Jungle",
    "Hel"
]
var textArray = [];
var connected = false;
var playerName = "";   

(function() {
    'use strict';

    /*** 全局变量与基础函数 ***/
    let currentServerInfo = { region: "", map: "", serverId: "" };
    const nativeWebSocket = window.WebSocket;
    let wsURL = null;
    let ws;
    let reconnectTimer = null;
    let periodicMessageTimer = null;

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
    function getSwitchState(index) {
        return localStorage.getItem(`switch-${index}`) === 'true';
    }
    function saveSwitchState(index, state) {
        localStorage.setItem(`switch-${index}`, state);
    }

    /*** 重写WebSocket构造，获取wsURL ***/
    window.WebSocket = function(...args) {
        const socket = new nativeWebSocket(...args);
        wsURL = socket.url;
        return socket;
    };

    /*** 创建消息日志窗口及相关UI ***/
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
    });

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

    // 创建右侧框
    const rightBox = document.createElement('div');
    Object.assign(rightBox.style, {
        position: 'fixed',
        top: '10px',
        width: '50px', // 设置右侧框的宽度
        height: '180px', // 高度与superping框一致
        backgroundColor: 'rgba(0, 0, 0, 0.3)', // 半透明背景
        color: 'white',
        fontFamily: 'Ubuntu',
        padding: '10px',
        borderRadius: '10px',
        boxShadow: '0px 0px 5px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-around', // 均匀分布每个项
        fontSize: '15px',  // 设置字体大小
        textAlign: 'center',  // 设置文本对齐方式
    });

    // 为右侧框创建文本容器
    const userInfo = {
        us: '0', // 默认人数为0
        eu: '0',
        as: '0',
        unknown: '0',
    };

    // 创建并添加每个文本
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
    us.textContent = `US`;
    eu.textContent = `EU`;
    as.textContent = `AS`;
    unknown.textContent = `未知`;

    // 将文本添加到右侧框
    rightBox.appendChild(us);
    rightBox.appendChild(usText);
    rightBox.appendChild(eu);
    rightBox.appendChild(euText);
    rightBox.appendChild(as);
    rightBox.appendChild(asText);
    rightBox.appendChild(unknown);
    rightBox.appendChild(unknownText);

    // 更新人数的函数
    function updateUserInfo(data) {
        // 假设传入的数据是一个对象，包含 us, eu, as, unknown 字段
        userInfo.us = data.us || userInfo.us;
        userInfo.eu = data.eu || userInfo.eu;
        userInfo.as = data.as || userInfo.as;
        userInfo.unknown = data.unknown || userInfo.unknown;

        // 更新文本内容
        usText.textContent = `${userInfo.us}`;
        euText.textContent = `${userInfo.eu}`;
        asText.textContent = `${userInfo.as}`;
        unknownText.textContent = `${userInfo.unknown}`;
    }
    // 更新rightBox的位置，使其始终位于superping的右侧
    
    function updateRightBoxPosition() {
        const superpingRect = superping.getBoundingClientRect();  // 获取superping的位置和大小
        rightBox.style.top = `${superpingRect.top}px`;  // 保持右侧框与superping框顶部对齐
        rightBox.style.left = `${superpingRect.right}px`;  // 使右侧框出现在superping右侧的地方
    }
    // 初始化时添加框到页面
    document.body.appendChild(superping);
    superping.appendChild(statusDot);
    document.body.appendChild(rightBox);
    //默认值
    updateUserInfo({
        us: 'idk',
        eu: 'idk',
        as: 'idk',
        unknown: 'idk'
    });
    // 初始化rightBox的位置
    updateRightBoxPosition();

    const title = document.createElement('div');
    title.innerHTML = '<span style="color: gold; font-size: 15px; font-weight: bold; text-shadow: 2px 2px 5px rgb(0, 0, 0);">super ping</span>';
    Object.assign(title.style, {
        position: 'sticky',
        top: '0',
        marginBottom: '10px'
    });
    superping.appendChild(title);
    document.body.appendChild(superping);

    /*** superping可拖拽位置保存 ***/
    let isDragging = false, offsetX, offsetY;
    function loadSuperpingPosition() {
        const savedPosition = JSON.parse(localStorage.getItem('superpingPosition'));
        if (savedPosition) {
            superping.style.left = savedPosition.left * window.innerWidth + 'px';
            superping.style.top = savedPosition.top * window.innerHeight + 'px';
            
        } else {
            superping.style.left = (window.innerWidth - 240) + 'px';
            superping.style.top = (window.innerHeight - 280) + 'px';
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
    // 每0.1秒执行一次updateRightBoxPosition
    setInterval(updateRightBoxPosition, 5);

    superping.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - superping.getBoundingClientRect().left;
        offsetY = e.clientY - superping.getBoundingClientRect().top;
        superping.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            superping.style.left = `${e.clientX - offsetX}px`;
            superping.style.top = `${e.clientY - offsetY}px`;
            
        }
        updateRightBoxPosition();
    });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            saveSuperpingPosition();
            updateRightBoxPosition();
        }
        isDragging = false;
        superping.style.transition = 'all 0.3s ease';
       
    });

    function displayText(text) {
        const textElement = document.createElement('div');
        textElement.textContent = text;
        Object.assign(textElement.style, { marginBottom: '10px', fontSize: '14px', lineHeight: '20px' });
        superping.appendChild(textElement);
        superping.scrollTop = superping.scrollHeight;
    }

    function flashSuperping() {
        const originalBg ='rgba(0, 0, 0, 0.5)';
        superping.style.backgroundColor = 'rgba(43,255,163,0.5)';
        setTimeout(() => {
            superping.style.backgroundColor = originalBg;
        }, 500);
    }

    window.onresize = function() {
        const isSuperpingEnabled = getSwitchState(1);
        if(isSuperpingEnabled){
            loadSuperpingPosition();
        }
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

    const switchNames = ["super播报", "防顶号-未完成", "日志"];
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
        });

        switchContainer.appendChild(label);
        switchContainer.appendChild(toggle);
        panel.appendChild(switchContainer);
    });

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

    /*** 功能界面更新函数 ***/
    function updateLogInterface() {
        const isLogEnabled = getSwitchState(3);
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
            loadSuperpingPosition();
        } else {
            superping.style.left = '-9999px';
            superping.style.top = '-9999px';
        }
    }
    updateSuperpingPosition();

    /*** WebSocket相关逻辑 ***/
    function showMessage(message) {
        const newMessage = document.createElement('div');
        newMessage.textContent = message;
        Object.assign(newMessage.style, {
            marginBottom: '10px',
            backgroundColor: '#FF9800',
            padding: '5px',
            borderRadius: '5px'
        });
        messageContainer.appendChild(newMessage);
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

        ws = new nativeWebSocket('wss://superping.top/ws');
        ws.onopen = () => {
            showMessage('[WebSocket] 连接已建立');
            statusDot.style.backgroundColor ='rgb(19, 240, 144)';
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = null;
            startPeriodicOnlineMessage();
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
                const message = JSON.parse(event.data)
                if(message.type==='onlineppl'){
                    const showus=message.content.us||"0"
                    const showeu=message.content.eu||"0"
                    const showas=message.content.as||"0"
                    const showidk=message.content.idk||"0"
                    updateUserInfo({
                        us: showus+"人",
                        eu: showeu+"人",
                        as: showas+"人",
                        unknown: showidk+"人"
                    });
                }
            }
            else{
                flashSuperping();
                displayText(event.data);
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
                            playerId : message,
                            regin : currentServerInfo.region,
                            map : currentServerInfo.map,
                            serverIds : currentServerInfo.serverId
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

    let detectedMessages = [];
    function sendMessageToWS() {
        if (ws && ws.readyState === nativeWebSocket.OPEN) {
            const messagesToSend = detectedMessages.slice(-5);
            ws.send(JSON.stringify({ type: 'send', content: messagesToSend }));
            if (messagesToSend.length > 0) {
                const lastMessage = messagesToSend[messagesToSend.length - 1];
                showMessage(`[WebSocket] 新消息发送: ${lastMessage}`);
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
                showMessage("聊天框已关闭");
                if (previousChatBoxState === 'opened' && chatBoxState === 'closed') clearPendingMessages();
            }
            detectionEnabled = true;
        } else {
            if (chatBoxState !== 'opened') {
                chatBoxState = 'opened';
                showMessage("聊天框已打开");
            }
            detectionEnabled = false;
        }
        if (previousChatBoxState !== chatBoxState) previousChatBoxState = chatBoxState;
    }, 1);

    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
        for (let ctx of [CanvasRenderingContext2D, OffscreenCanvasRenderingContext2D]) {
            if(text == "Ready" && !connected) connected = true;
            if(!notExpectedText.includes(text) && connected && !playerName){
                const canvas = document.getElementById("canvas");
                const ctx = canvas.getContext("2d");
                var re = /\d{1,3}/;
                let result = re.exec(ctx.font);
                if(result.length > 0){
                    let size = Number(result[0]);
                    let data = { text : text , size: size };
                    let org = textArray.filter((a) => a.text == text);
                            
                    if (org.length == 0){
                        textArray.push(data);
                    }else{
                        if (org.size < size){
                            textArray = textArray.map((v,i,a) => {if(v.text == text){v.size = size}; return v;})
                        }
                    }
                    if (textArray.length > 14){
                        playerName = textArray.sort((a,b) => b.size - a.size)[0].text;
                        showMessage(`[Login] Player ${playerName} connected.`)
                    }
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
                        : `未知区域-未知地图-未知服务器#`;
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
    let position = "-200px";

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
    style.textContent = `.server-id:hover { color: #aaccff !important; }`;
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

        let t = `Click on a server code to connect.<br>Press \` (backquote) to toggle this menu.<br><br>`;
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
            t += `</table>`;
        } else {
            t += `无法获取当前服务器信息。`;
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

})();



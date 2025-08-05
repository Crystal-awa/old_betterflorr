// ==UserScript==
// @name         Florr.io Message Monitor
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  捕获 Canvas 特定颜色及关键词文本，并发送最近五条消息给服务器，仅在信息框中显示最后一条发送的消息。新增检测“Press [ENTER]”消息的功能。
// @author       YourName
// @match        https://florr.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 创建一个对象来存储服务器信息
    let currentServerInfo = {
        region: "",
        map: "",
        serverId: ""
    };

    // 获取玩家ID的函数
    function getPlayerId() {
        return localStorage.cp6_player_id || 'unknown';
    }

    // 保存原始的 WebSocket 构造函数
    const nativeWebSocket = window.WebSocket;

    // 重写 WebSocket 构造函数
    window.WebSocket = function(...args) {
        const socket = new nativeWebSocket(...args);  // 创建新的 WebSocket 实例
        const url = socket.url;  // 获取 WebSocket 连接的 URL

        // 调试日志
        console.log(`[WebSocket Override] New WebSocket connection to: ${url}`);

        // 从 WebSocket URL 中提取服务器号
        const match = url.match(/wss:\/\/([a-z0-9]+)\.s\.m28n\.net\//);
        if (match && match[1]) {
            const serverId = match[1];  // 提取到的服务器号

            // 获取地图和区域信息
            const totalMaps = 7;
            const mapNames = ["Garden", "Desert", "Ocean", "Jungle", "Ant Hell", "Hel", "Sewers"];
            const regions = ["US", "EU", "AS"];

            let mapFound = false;

            // 遍历地图
            for (let i = 0; i < totalMaps; i++) {
                fetch(`https://api.n.m28.io/endpoint/florrio-map-${i}-green/findEach/`)
                    .then(response => response.json())
                    .then(data => {
                        let regionIndex = 0;

                        // 遍历每个服务器的区域
                        for (const serverKey in data.servers) {
                            const server = data.servers[serverKey];
                            if (server.id === serverId) {
                                // 找到匹配的服务器，保存区域和地图信息
                                const region = regions[regionIndex];
                                currentServerInfo = {
                                    region: region,
                                    map: mapNames[i],
                                    serverId: serverId
                                };
                                console.log(`[WebSocket Override] 服务器信息已设置: 地图 - ${currentServerInfo.map}, 区域 - ${currentServerInfo.region}, 服务器号 - ${currentServerInfo.serverId}`);
                                mapFound = true;
                                break;
                            }

                            // 更新区域顺序
                            regionIndex = (regionIndex + 1) % regions.length;
                        }

                        if (mapFound) return;
                    })
                    .catch(error => console.error("[WebSocket Override] 获取服务器信息失败:", error));

                if (mapFound) break;
            }
        }

        return socket;  // 返回新的 WebSocket 实例
    };

    // 创建一个消息显示容器
    const messageContainer = document.createElement('div');
    messageContainer.style.position = 'fixed';
    messageContainer.style.right = '20px'; // 移出屏幕
    messageContainer.style.top = '20px';
    messageContainer.style.width = '350px';
    messageContainer.style.height = '400px';
    messageContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    messageContainer.style.color = '#fff';
    messageContainer.style.padding = '10px';
    messageContainer.style.borderRadius = '10px';
    messageContainer.style.zIndex = '9999';
    messageContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    messageContainer.style.overflowY = 'auto';
    messageContainer.style.fontFamily = 'Arial, sans-serif';

    // 消息缓存和超时设置
    const messageCache = new Map();
    const MESSAGE_TIMEOUT = 30 * 1000; // 30秒

    // 目标颜色代码
    const TARGET_COLOR = '#2bffa3';

    // 定义关键词
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

    // 初始设置：默认启用颜色过滤
    let colorFilterEnabled = true;

    // 创建一个开关按钮，用来启用/禁用颜色过滤
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Toggle Color Filter: ON';
    toggleButton.style.position = 'fixed';
    toggleButton.style.right = '20px'; // 移出屏幕
    toggleButton.style.top = '440px';
    toggleButton.style.backgroundColor = '#4CAF50';
    toggleButton.style.color = '#fff';
    toggleButton.style.padding = '10px';
    toggleButton.style.fontSize = '16px';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '5px';
    toggleButton.style.zIndex = '9999';
    toggleButton.style.width = '200px';
    //设置按钮
    const buttonSize = 60; // 固定为50px，正方形
    const setting = document.createElement('button');
    setting.textContent = '设置';
    setting.style.position = 'fixed';
    setting.style.bottom = '10px';
    setting.style.right = '10px';
    setting.style.backgroundColor = '#FFD700';
    setting.style.color = '#000';
    setting.style.width = `${buttonSize}px`;
    setting.style.height = `${buttonSize}px`;
    setting.style.border = '2px solid #DAA520';
    setting.style.fontSize = `${buttonSize * 0.3}px`; // 动态设置字体大小为宽高的30%
    setting.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)'; // 增加阴影
    setting.style.borderRadius = '5px';
    setting.style.zIndex = '9999';
    setting.style.overflow = 'hidden'; // 防止文字溢出
    //设置按钮
    //设置界面
    const panel = document.createElement('div');
    panel.textContent = '功能设置';
    panel.style.position = 'fixed';
    panel.style.bottom = '75px'; // 放在按钮上方
    panel.style.marginTop = '20px auto'; // 如果标题和 panel 是连续的，可以给 panel 顶部添加外边距
    panel.style.right = '10px';
    panel.style.width = '200px';
    panel.style.height = '300px';
    panel.style.backgroundColor = 'white';
    panel.style.border = '1px solid gray';
    panel.style.borderRadius = '5px';
    panel.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    panel.style.padding = '10px';
    panel.style.zIndex = '999';
    panel.style.display = 'none'; // 默认隐藏
    panel.style.overflowY = 'auto'; // 添加垂直滚动条
    document.body.appendChild(panel);
    document.body.appendChild(toggleButton);
    document.body.appendChild(setting);
    //设置界面
    function getSwitchState(index) {
        return localStorage.getItem(`switch-${index}`) === 'true';
    }

    // 保存开关状态
    function saveSwitchState(index, state) {
        localStorage.setItem(`switch-${index}`, state);
    }
    //按钮点击事件
    document.querySelector('body').appendChild(messageContainer);
    document.querySelector('body').appendChild(toggleButton);
    
    toggleButton.addEventListener('click', () => {
        colorFilterEnabled = !colorFilterEnabled;
        toggleButton.textContent = `Toggle Color Filter: ${colorFilterEnabled ? 'ON' : 'OFF'}`;
        toggleButton.style.backgroundColor = colorFilterEnabled ? '#4CAF50' : '#f44336'
    });    
    setting.addEventListener('click', () => {
        if (panel.style.display === 'none') {
            panel.style.display = 'block'; // 显示界面
        } else {
            panel.style.display = 'none'; // 隐藏界面
        }
    });
    const switchNames = ["super播报", "防顶号","日志"]; // 你可以根据需要修改名称
    for (let i = 0; i < switchNames.length; i++) {
        const switchContainer = document.createElement('div');
        switchContainer.style.display = 'flex';
        switchContainer.style.alignItems = 'center';
        switchContainer.style.marginBottom = '20px';

        const label = document.createElement('label');
        label.textContent = switchNames[i];
        label.style.marginRight = 'auto';

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.style.marginLeft = '10px';

        // 设置开关的初始状态
        toggle.checked = getSwitchState(i+1);

        // 监听开关状态变化
        toggle.addEventListener('change', () => {
            saveSwitchState(i+1, toggle.checked);
            // 如果是“日志”开关，实时更新界面显示状态
            updateLogInterface();
        });

        switchContainer.appendChild(label);
        switchContainer.appendChild(toggle);
        panel.appendChild(switchContainer);
    }
    // 日志界面初始状态
   
    //按钮点击事件
    // 监听按钮点击事件，切换颜色过滤状态
    button.addEventListener('click', () => {
        const isActive = getButtonState();

        if (isActive) {
            // 如果按钮是开启状态，显示界面并切换按钮文本
            panel.style.display = 'block';
            saveButtonState(false); // 更新按钮状态为关闭
        } else {
            // 如果按钮是关闭状态，隐藏界面并切换按钮文本
            panel.style.display = 'none';
            saveButtonState(true); // 更新按钮状态为开启
        }
    });

    // 初始化按钮状态


    

    let ws;
    let reconnectTimer = null;

    // 定时器变量
    let periodicMessageTimer = null;

    function connectWebSocket() {
        ws = new nativeWebSocket('wss://superping.top/ws');

        ws.onopen = () => {
            showMessage('[WebSocket] 连接已建立');
            console.log('[WebSocket] 连接已建立');

            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            // 启动每 5 秒发送在线状态消息的功能
            startPeriodicOnlineMessage();
        };

        ws.onerror = (error) => {
            showMessage('[WebSocket] 连接出错: ' + error);
            console.error('[WebSocket] 连接出错:', error);
        };

        ws.onclose = () => {
            showMessage('[WebSocket] 连接已关闭，10秒后尝试重连...');
            console.warn('[WebSocket] 连接已关闭，10秒后尝试重连...');

            // 停止发送在线状态消息
            stopPeriodicOnlineMessage();

            if (!reconnectTimer) {
                reconnectTimer = setTimeout(connectWebSocket, 10000);
            }
        };

        ws.onmessage = (event) => {
            console.log('[WebSocket] 收到消息:', event.data);
        };
    }

    // 启动每 5 秒发送在线状态消息
    function startPeriodicOnlineMessage() {
        if (!periodicMessageTimer) {
            periodicMessageTimer = setInterval(() => {
                if (ws && ws.readyState === nativeWebSocket.OPEN) {
                    const playerId = getPlayerId();
                    const message = `${playerId} online##`;
                    ws.send(JSON.stringify({ type: 'online', content: message }));
                } else {
                    console.warn('[WebSocket] WebSocket 未连接，无法发送在线状态消息');
                }
            }, 5000);
        }
    }

    // 停止发送在线状态消息
    function stopPeriodicOnlineMessage() {
        if (periodicMessageTimer) {
            clearInterval(periodicMessageTimer);
            periodicMessageTimer = null;
        }
    }

    // 首次连接
    connectWebSocket();


    // 全局存储已检测到的消息
    let detectedMessages = [];

    // 发送消息到 WebSocket 服务器（只发送最后五条消息）
    function sendMessageToWS() {
        if (ws && ws.readyState === nativeWebSocket.OPEN) {
            const messagesToSend = detectedMessages.slice(-5); // 获取最后五条
            ws.send(JSON.stringify({ type: 'send', content: messagesToSend }));
            // 只在右上角显示本次发送的最后一条消息
            if (messagesToSend.length > 0) {
                const lastMessage = messagesToSend[messagesToSend.length - 1];
                showMessage(`[WebSocket] 新消息发送: ${lastMessage}`);
            }
            console.log('[WebSocket] 发送消息:', messagesToSend);
        } else {
            showMessage('[WebSocket] WebSocket 未连接');
            console.warn('[WebSocket] WebSocket 未连接');
        }
    }

    // 显示消息到消息框（这里依然是增加一条消息显示）
    function showMessage(message) {
        const newMessage = document.createElement('div');
        newMessage.textContent = message;
        newMessage.style.marginBottom = '10px';
        newMessage.style.backgroundColor = '#FF9800';
        newMessage.style.padding = '5px';
        newMessage.style.borderRadius = '5px';
        messageContainer.appendChild(newMessage);
        messageContainer.scrollTop = messageContainer.scrollHeight; // 滚动到底部
    }

    // Canvas 处理
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
        const cleanedText = text.trim();
        const playerId = getPlayerId();

        // Variables for detecting "Press [ENTER]"
        if (cleanedText.includes("Press [ENTER]")) {
            lastPressEnterTime = Date.now();
        }

        function processMessage(text) {
            if (messageCache.has(text)) {
                const lastDisplayedTime = messageCache.get(text);
                if (Date.now() - lastDisplayedTime < MESSAGE_TIMEOUT) {
                    return;
                }
            }

            messageCache.set(text, Date.now());

            let fullMessage;
            if (currentServerInfo.region && currentServerInfo.map && currentServerInfo.serverId) {
                const prefix = `${currentServerInfo.region}-${currentServerInfo.map}-${currentServerInfo.serverId}#`;
                const suffix = `#${playerId}`;
                fullMessage = prefix + text + suffix;
            } else {
                const prefix = `未知区域-未知地图-未知服务器#`;
                const suffix = `#${playerId}`;
                fullMessage = prefix + text + suffix;
            }

            // 将新消息加入检测列表
            detectedMessages.push(fullMessage);

            // 显示捕获到的消息（这里正常显示捕获的最后一条消息）
            showMessage(`[Canvas] ${fullMessage}`);
            console.log(`[Canvas] 新消息捕获: ${fullMessage}`);

            // 每次捕获到新消息时发送最近五条消息
            sendMessageToWS();
        }

        // 如果检测启用，并且颜色过滤符合条件
        if (detectionEnabled && ((colorFilterEnabled && this.fillStyle === TARGET_COLOR) || !colorFilterEnabled)) {
            keywords.forEach(({ description }) => {
                if (cleanedText && cleanedText.includes(description)) {
                    processMessage(cleanedText);
                }
            });
        }

        // 调用原始的 fillText 方法
        originalFillText.apply(this, arguments);
    };

    // Variables for "Press [ENTER]" detection
    let lastPressEnterTime = 0;
    let chatBoxState = null; // 'opened' or 'closed'
    let detectionEnabled = false;

    // 设置一个定时器来检测 "Press [ENTER]" 的存在
    setInterval(() => {
        const now = Date.now();
        if (now - lastPressEnterTime < 10) { // "Press [ENTER]" 被检测到
            if (chatBoxState !== 'closed') {
                chatBoxState = 'closed';
                showMessage("聊天框已关闭");
                console.log("聊天框已关闭");
            }
            detectionEnabled = true;
        } else { // "Press [ENTER]" 未被检测到
            if (chatBoxState !== 'opened') {
                chatBoxState = 'opened';
                showMessage("聊天框已打开");
                console.log("聊天框已打开");
            }
            detectionEnabled = false;
        }
    }, 1); // 每500毫秒检查一次

    // 监听按下键盘事件，按下 U 键时切换显示/隐藏消息框
    function updateLogInterface() {
        const isLogEnabled = getSwitchState(3); // "日志"是第三个开关，索引为3
        console.log('状态',isLogEnabled)
        if (isLogEnabled===true) {
            messageContainer.style.right='20px'
            toggleButton.style.right='20px'
        } else {
            messageContainer.style.right='-9999px'
            toggleButton.style.right='-9999px'
        }
        
    }
    
    updateLogInterface()
    // 初始化：确保消息容器和按钮显示
    
})();

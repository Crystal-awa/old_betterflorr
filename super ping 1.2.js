// ==UserScript==
// @name         Florr.io Message Monitor
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  捕获 Canvas 特定颜色及关键词文本，并发送最近五条消息给服务器，仅在信息框中显示最后一条发送的消息
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
    messageContainer.style.top = '20px';
    messageContainer.style.right = '20px';
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
    document.body.appendChild(messageContainer);

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
    toggleButton.style.top = '440px';
    toggleButton.style.right = '20px';
    toggleButton.style.backgroundColor = '#4CAF50';
    toggleButton.style.color = '#fff';
    toggleButton.style.padding = '10px';
    toggleButton.style.fontSize = '16px';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '5px';
    toggleButton.style.zIndex = '9999';

    // 监听按钮点击事件，切换颜色过滤状态
    toggleButton.addEventListener('click', () => {
        colorFilterEnabled = !colorFilterEnabled;
        toggleButton.textContent = `Toggle Color Filter: ${colorFilterEnabled ? 'ON' : 'OFF'}`;
        toggleButton.style.backgroundColor = colorFilterEnabled ? '#4CAF50' : '#f44336';
    });

    document.body.appendChild(toggleButton);

    let ws;
    let reconnectTimer = null;

    function connectWebSocket() {
        ws = new nativeWebSocket('wss://superping.top/ws');

        ws.onopen = () => {
            const playerId = getPlayerId();
            showMessage('[WebSocket] 连接已建立');
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            setInterval(() => {
                ws.send(`${playerId} online##`);
            }, 5000);
        };

        ws.onerror = (error) => {
            showMessage('[WebSocket] 连接出错: ' + error);
        };

        ws.onclose = () => {
            showMessage('[WebSocket] 连接已关闭，10秒后尝试重连...');
            console.warn('[WebSocket] 连接已关闭，10秒后尝试重连...');
            if (!reconnectTimer) {
                reconnectTimer = setTimeout(connectWebSocket, 10000);
            }
        };

        ws.onmessage = (event) => {
            showMessage(`${event}`)
        };
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
        } else {
            showMessage('[WebSocket] WebSocket 未连接');

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

        let isTextModified = false;

        // 判断该文本是否已被修改颜色
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

        // 清除阴影和描边
        this.shadowColor = 'transparent';
        this.lineWidth = 0;

        let shouldModifyColor = false;

        if ((colorFilterEnabled && this.fillStyle === TARGET_COLOR) || !colorFilterEnabled) {
            keywords.forEach(({ description }) => {
                if (cleanedText && cleanedText.includes(description)) {
                    processMessage(cleanedText); // 捕捉到的消息
                    shouldModifyColor = true;
                }
            });
        }

        // 只有在符合条件并且没有被修改过颜色的情况下才会修改颜色
        if (shouldModifyColor && !isTextModified) {
            this.save(); // 保存当前 Canvas 状态
            this.fillStyle = "#aaccff"; // 修改文字颜色为浅蓝色
            isTextModified = true; // 标记文本已修改
        }

        // 调用原始的 fillText 方法
        originalFillText.apply(this, arguments);

        // 恢复 Canvas 状态
        if (isTextModified) {
            this.restore(); // 恢复 Canvas 状态
        }

        // 检查实际渲染的颜色
        let imageData = this.getImageData(x, y, maxWidth || 100, 20); // 获取部分区域的像素
        let data = imageData.data;
        let textColorMatch = false;

        // 遍历像素点来判断实际颜色
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i]; // Red
            let g = data[i + 1]; // Green
            let b = data[i + 2]; // Blue

            // 判断是否接近目标颜色（容忍度可以调整）
            if (Math.abs(r - 170) < 10 && Math.abs(g - 204) < 10 && Math.abs(b - 255) < 10) {
                textColorMatch = true;
                break;
            }
        }

        if (!textColorMatch) {
            // 如果检测到颜色不匹配，取消捕捉
            return;
        }
    };





    // 监听按下键盘事件，按下 U 键时切换显示/隐藏消息框
    document.addEventListener('keydown', (event) => {
        if (event.key === 'u' || event.key === 'U') {
            // 切换 messageContainer 和 toggleButton 的显示状态
            if (messageContainer.style.display === 'none') {
                messageContainer.style.display = 'block';
                toggleButton.style.display = 'block';
            } else {
                messageContainer.style.display = 'none';
                toggleButton.style.display = 'none';
            }
        }
    });

    // 初始化：确保消息容器和按钮显示
    messageContainer.style.display = 'block';
    toggleButton.style.display = 'block';
})();

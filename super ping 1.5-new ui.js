// ==UserScript==
// @name         Florr.io Integrated Monitor & Server Switcher
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  消息捕获延迟处理、服务器换服、日志显示等整合；修复前后缀重复添加的问题。
// @match        https://florr.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let currentServerInfo = {
        region: "",
        map: "",
        serverId: ""
    };

    function getPlayerId() {
        return localStorage.cp6_player_id || 'unknown';
    }

    const nativeWebSocket = window.WebSocket;
    let wsURL = null;

    window.WebSocket = function(...args) {
        const socket = new nativeWebSocket(...args);
        wsURL = socket.url;
        return socket;
    };

    // 创建消息显示容器（原UI）
    const messageContainer = document.createElement('div');
    messageContainer.style.position = 'fixed';
    messageContainer.style.right = '-9999px';
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
    document.body.appendChild(messageContainer);

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
    toggleButton.style.position = 'fixed';
    toggleButton.style.right = '-9999px';
    toggleButton.style.top = '440px';
    toggleButton.style.backgroundColor = '#4CAF50';
    toggleButton.style.color = '#fff';
    toggleButton.style.padding = '10px';
    toggleButton.style.fontSize = '16px';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '5px';
    toggleButton.style.zIndex = '9999';
    document.body.appendChild(toggleButton);

    toggleButton.addEventListener('click', () => {
        colorFilterEnabled = !colorFilterEnabled;
        toggleButton.textContent = `Toggle Color Filter: ${colorFilterEnabled ? 'ON' : 'OFF'}`;
        toggleButton.style.backgroundColor = colorFilterEnabled ? '#4CAF50' : '#f44336'
    });

    const buttonSize = 60;
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
    setting.style.fontSize = `${buttonSize * 0.3}px`;
    setting.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    setting.style.borderRadius = '5px';
    setting.style.zIndex = '9999';
    setting.style.overflow = 'hidden';
    document.body.appendChild(setting);

    const panel = document.createElement('div');
    panel.textContent = '功能设置';
    panel.style.position = 'fixed';
    panel.style.bottom = '75px';
    panel.style.right = '10px';
    panel.style.width = '200px';
    panel.style.height = '300px';
    panel.style.backgroundColor = 'white';
    panel.style.border = '1px solid gray';
    panel.style.borderRadius = '5px';
    panel.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    panel.style.padding = '10px';
    panel.style.zIndex = '999';
    panel.style.display = 'none';
    panel.style.overflowY = 'auto';
    document.body.appendChild(panel);

    setting.addEventListener('click', () => {
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    });

    function getSwitchState(index) {
        return localStorage.getItem(`switch-${index}`) === 'true';
    }

    function saveSwitchState(index, state) {
        localStorage.setItem(`switch-${index}`, state);
    }

    const switchNames = ["super播报", "防顶号","日志"];
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
        toggle.checked = getSwitchState(i+1);

        toggle.addEventListener('change', () => {
            saveSwitchState(i+1, toggle.checked);
            updateLogInterface();
        });

        switchContainer.appendChild(label);
        switchContainer.appendChild(toggle);
        panel.appendChild(switchContainer);
    }

    function updateLogInterface() {
        const isLogEnabled = getSwitchState(3);
        if (isLogEnabled === true) {
            messageContainer.style.right='20px'
            toggleButton.style.right='20px'
        } else {
            messageContainer.style.right='-9999px'
            toggleButton.style.right='-9999px'
        }
    }
    updateLogInterface();

    document.addEventListener('keydown', (event) => {
        if (event.key === 'u' || event.key === 'U') {
            const currentLogState = getSwitchState(3);
            saveSwitchState(3, !currentLogState);
            updateLogInterface();
        }
    });

    let ws;
    let reconnectTimer = null;
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
            startPeriodicOnlineMessage();
        };

        ws.onerror = (error) => {
            showMessage('[WebSocket] 连接出错: ' + error);
            console.error('[WebSocket] 连接出错:', error);
        };

        ws.onclose = () => {
            showMessage('[WebSocket] 连接已关闭，10秒后尝试重连...');
            console.warn('[WebSocket] 连接已关闭，10秒后尝试重连...');

            stopPeriodicOnlineMessage();

            if (!reconnectTimer) {
                reconnectTimer = setTimeout(connectWebSocket, 10000);
            }
        };

        ws.onmessage = (event) => {
            console.log('[WebSocket] 收到消息:', event.data);
        };
    }

    function startPeriodicOnlineMessage() {
        if (!periodicMessageTimer) {
            periodicMessageTimer = setInterval(() => {
                if (ws && ws.readyState === nativeWebSocket.OPEN) {
                    const playerId = getPlayerId();
                    const message = `${playerId} online##`;
                    ws.send(JSON.stringify({ type: 'online', content: message }));
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
            console.log('[WebSocket] 发送消息:', messagesToSend);
        } else {
            showMessage('[WebSocket] WebSocket 未连接');
            console.warn('[WebSocket] WebSocket 未连接');
        }
    }

    function showMessage(message) {
        const newMessage = document.createElement('div');
        newMessage.textContent = message;
        newMessage.style.marginBottom = '10px';
        newMessage.style.backgroundColor = '#FF9800';
        newMessage.style.padding = '5px';
        newMessage.style.borderRadius = '5px';
        messageContainer.appendChild(newMessage);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    let lastPressEnterTime = 0;
    let chatBoxState = null;
    let detectionEnabled = false;
    let previousChatBoxState = null;

    let pendingMessages = [];
    function clearPendingMessages() {
        for (const msg of pendingMessages) {
            clearTimeout(msg.timeoutId);
        }
        pendingMessages = [];
    }

    const CHATBOX_THRESHOLD = 500;

    setInterval(() => {
        const now = Date.now();
        if (now - lastPressEnterTime < CHATBOX_THRESHOLD) {
            if (chatBoxState !== 'closed') {
                chatBoxState = 'closed';
                showMessage("聊天框已关闭");
                console.log("聊天框已关闭");
                if (previousChatBoxState === 'opened' && chatBoxState === 'closed') {
                    clearPendingMessages();
                }
            }
            detectionEnabled = true;
        } else {
            if (chatBoxState !== 'opened') {
                chatBoxState = 'opened';
                showMessage("聊天框已打开");
                console.log("聊天框已打开");
            }
            detectionEnabled = false;
        }

        if (previousChatBoxState !== chatBoxState) {
            previousChatBoxState = chatBoxState;
        }
    }, 1);

    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
        const cleanedText = text.trim();
        const playerId = getPlayerId();

        if (cleanedText.includes("Press [ENTER]")) {
            lastPressEnterTime = Date.now();
        }

        function processMessage(fullMessage) {
            if (messageCache.has(fullMessage)) {
                const lastDisplayedTime = messageCache.get(fullMessage);
                if (Date.now() - lastDisplayedTime < MESSAGE_TIMEOUT) {
                    return;
                }
            }

            messageCache.set(fullMessage, Date.now());
            detectedMessages.push(fullMessage);
            showMessage(`[Canvas] ${fullMessage}`);
            console.log(`[Canvas] 新消息捕获: ${fullMessage}`);
            sendMessageToWS();
        }

        function queueMessageForLater(fullMessage) {
            const timeoutId = setTimeout(() => {
                if (detectionEnabled) {
                    // 聊天框关闭时处理消息
                    processMessage(fullMessage);
                } else {
                    // 聊天框开启时取消处理
                    console.log(`[Canvas] 聊天框开启，取消消息: ${fullMessage}`);
                }
                pendingMessages = pendingMessages.filter(m => m.timeoutId !== timeoutId);
            }, 1000);

            pendingMessages.push({fullMessage, timeoutId});
        }

        // 检测符合条件的关键字
        if (detectionEnabled && ((colorFilterEnabled && this.fillStyle === TARGET_COLOR) || !colorFilterEnabled)) {
            for (let { description } of keywords) {
                if (cleanedText && cleanedText.includes(description)) {
                    // 一次性生成fullMessage
                    let fullMessage;
                    if (currentServerInfo.region && currentServerInfo.map && currentServerInfo.serverId) {
                        const prefix = `${currentServerInfo.region}-${currentServerInfo.map}-${currentServerInfo.serverId}#`;
                        const suffix = `#${playerId}`;
                        fullMessage = prefix + cleanedText + suffix;
                    } else {
                        const prefix = `未知区域-未知地图-未知服务器#`;
                        const suffix = `#${playerId}`;
                        fullMessage = prefix + cleanedText + suffix;
                    }

                    queueMessageForLater(fullMessage);
                    break;
                }
            }
        }

        originalFillText.apply(this, arguments);
    };

    // 服务器换服菜单与信息获取逻辑保持不变
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

    function regionToName(regionCode) {
        switch(regionCode) {
            case 'NA': return 'US';
            case 'EU': return 'EU';
            case 'AS': return 'AS';
            default: return regionCode;
        }
    }

    var container = document.createElement('div');
    container.style = `
        width: 500px;
        height: auto;
        z-index: 9999;
        background: rgba(0, 0, 0, 0.5);
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 10px;
        margin: 0 auto;
        color: white;
        text-align: center;
        font-family: 'Ubuntu';
        padding: 12px;
        top: ${position};
        cursor: default;
        transition: all 1s ease-in-out;
    `;
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
        if (e.keyCode == "192") {
            if (autoToggle) {
                autoToggle = false;
                container.style.top = "0px";
            } else {
                autoToggle = true;
                container.style.top = position;
            }
        }
    });

    let cp6 = window.cp6;

    function getServerId() {
        if (!wsURL) return;
        var thisCp6Id = wsURL.match(/wss:\/\/([a-z0-9]*).s.m28n.net\//);
        if (!thisCp6Id) return;
        thisCp6Id = thisCp6Id[1];

        let foundServer = false;
        for (const [biome, serversObj] of Object.entries(servers)) {
            for (const [region, obj] of Object.entries(serversObj)) {
                if (Object.keys(obj).includes(thisCp6Id)) {
                    currentServerInfo = {
                        region: regionToName(region),
                        map: biome,
                        serverId: thisCp6Id
                    };
                    foundServer = true;
                    break;
                }
            }
            if (foundServer) break;
        }

        var t = `Click on a server code to connect.<br>Press \` (backquote) to toggle this menu.<br><br>`;
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
                                return `<td style='min-width:50px'>
                                            <span style="cursor:pointer; color:${color}" class="server-id" data-id="${x}">${x}</span>
                                        </td>`;
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


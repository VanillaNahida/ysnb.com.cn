// 原神牛逼 ysnb.com.cn 页面逻辑实现

// 壁纸相关，适配手机和电脑，展示随机的壁纸，并支持下载
var wallpaperPc = null;
var wallpaperMobile = null;

function loadWallpapers() {
    fetch('api/get_wallpaper.php')
        .then(function (resp) {
            if (!resp.ok) throw new Error('Failed to load wallpapers');
            return resp.json();
        })
        .then(function (data) {
            wallpaperPc = data.pc;
            wallpaperMobile = data.mobile;
            applyWallpaper();
        })
        .catch(function () {
            customAlert('随机背景图加载失败，请刷新页面重试！');
        });
}

function applyWallpaper() {
    var bg = document.getElementById('bg');
    var url = window.innerWidth <= 768
        ? (wallpaperMobile || '')
        : (wallpaperPc || '');
    if (url) {
        bg.style.backgroundImage = 'url("' + url + '")';
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundPosition = 'center center';
        bg.style.backgroundRepeat = 'no-repeat';
    }
}

// 自定义弹窗
// URL参数解析：/?skip 路由直接跳过所有验证
// 访问 https://ysnb.com.cn/?skip
(function () {
    if (window.location.search.indexOf('skip') !== -1) {
        document.addEventListener('DOMContentLoaded', function () {
            skip();
        });
    }
})();

// 页面加载时请求壁纸
document.addEventListener('DOMContentLoaded', function () {
    loadWallpapers();
});
// 窗口尺寸变化时切换 PC/手机壁纸
window.addEventListener('resize', function () {
    applyWallpaper();
});

var _modalCallback = null;

function _showModal(msg, inputShow, buttons) {
    var overlay = document.getElementById('customModalOverlay');
    var msgEl = document.getElementById('customModalMsg');
    var inputEl = document.getElementById('customModalInput');
    var btnsEl = document.getElementById('customModalBtns');

    msgEl.textContent = msg;
    if (inputShow) {
        inputEl.classList.remove('hidden');
        inputEl.value = '';
    } else {
        inputEl.classList.add('hidden');
    }
    btnsEl.innerHTML = '';
    buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.textContent = b.label;
        btn.className = b.primary ? 'modal-btn-primary' : 'modal-btn-cancel';
        btn.onclick = function () {
            overlay.classList.add('hidden');
            if (b.callback) b.callback(inputShow ? inputEl.value : undefined);
        };
        btnsEl.appendChild(btn);
    });
    overlay.classList.remove('hidden');
    if (inputShow) setTimeout(function () { inputEl.focus(); }, 100);
}

function customAlert(msg, cb) {
    _showModal(msg, false, [
        { label: '确定', primary: true, callback: cb || function () {} }
    ]);
}

function customConfirm(msg, onOk, onCancel) {
    _showModal(msg, false, [
        { label: '取消', primary: false, callback: onCancel || function () {} },
        { label: '确定', primary: true, callback: onOk || function () {} }
    ]);
}

function customPrompt(msg, onSubmit) {
    _showModal(msg, true, [
        { label: '取消', primary: false, callback: function () { onSubmit(null); } },
        { label: '确定', primary: true, callback: function (val) { onSubmit(val); } }
    ]);
}

// HTML内容弹窗
function _showModalHtml(html, buttons) {
    var overlay = document.getElementById('customModalOverlay');
    var msgEl = document.getElementById('customModalMsg');
    var inputEl = document.getElementById('customModalInput');
    var btnsEl = document.getElementById('customModalBtns');

    msgEl.innerHTML = html;
    inputEl.classList.add('hidden');
    btnsEl.innerHTML = '';
    buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.textContent = b.label;
        btn.className = b.primary ? 'modal-btn-primary' : 'modal-btn-cancel';
        btn.onclick = function () {
            overlay.classList.add('hidden');
            if (b.callback) b.callback();
        };
        btnsEl.appendChild(btn);
    });
    overlay.classList.remove('hidden');
}

function customConfirmHtml(html, onOk, onCancel) {
    _showModalHtml(html, [
        { label: '取消', primary: false, callback: onCancel || function () {} },
        { label: '确定', primary: true, callback: onOk || function () {} }
    ]);
}

function customAlertHtml(html, cb) {
    _showModalHtml(html, [
        { label: '确定', primary: true, callback: cb || function () {} }
    ]);
}

// 年龄验证相关

// 加载外部 JSON 配置
loadUnderageVideos();

// 初始化年份下拉框 1000~3000
(function initYearSelect() {
    var sel = document.getElementById('yearSelect');
    for (var y = 1000; y <= 3000; y++) {
        var opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + '年';
        sel.appendChild(opt);
    }
})();

// 月份：点击后随机 0~24
(function initMonthSelect() {
    var sel = document.getElementById('monthSelect');
    var placeholder = document.createElement('option');
    placeholder.textContent = '选择';
    placeholder.disabled = true;
    placeholder.selected = true;
    sel.appendChild(placeholder);

    sel.addEventListener('mousedown', function (e) {
        var r = Math.floor(Math.random() * 25); // 0~24
        sel.innerHTML = '';
        var opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r + '月';
        opt.selected = true;
        sel.appendChild(opt);
    });
})();

// 日期滚动
var dayValue = 0;
var dayRunning = true;
var dayTimer = null;

function startDayRolling() {
    if (dayTimer) clearInterval(dayTimer);
    dayTimer = setInterval(function () {
        dayValue = Math.floor(Math.random() * 101);
        document.getElementById('dayBox').textContent = dayValue;
    }, 100);
}

function stopDayRolling() {
    if (dayTimer) {
        clearInterval(dayTimer);
        dayTimer = null;
    }
}

document.getElementById('dayBox').addEventListener('click', function () {
    var box = document.getElementById('dayBox');
    if (dayRunning) {
        stopDayRolling();
        dayRunning = false;
        box.classList.remove('running');
        box.classList.add('paused');
        document.getElementById('hintText').textContent = '已暂停，再次点击继续滚动';
    } else {
        startDayRolling();
        dayRunning = true;
        box.classList.remove('paused');
        box.classList.add('running');
        document.getElementById('hintText').textContent = '点击"日"暂停滚动，再次点击继续';
    }
});

function showDatePicker() {
    document.getElementById('overlay1').classList.add('hidden');
    document.getElementById('overlay2').classList.remove('hidden');
    startDayRolling();
}

// 未满十八岁跳转视频列表（从外部 JSON 加载）
var underageVideos = [];

function loadUnderageVideos() {
    return fetch('video-playlist.json')
        .then(function (resp) {
            if (!resp.ok) throw new Error('Failed to load videos');
            return resp.json();
        })
        .then(function (data) {
            underageVideos = data;
        })
        .catch(function () {
            // 加载失败时使用默认链接
            underageVideos = [
                'https://www.bilibili.com/video/BV1dgR9B2E1S',
                'https://www.bilibili.com/video/BV1YjLw6PEHx',
                'https://www.bilibili.com/video/BV1hWVA6hEGM'
            ];
        });
}

function redirectUnderage() {
    var item = underageVideos[Math.floor(Math.random() * underageVideos.length)];
    var url = typeof item === 'string' ? item : item.url;
    window.location.href = url;
}

function handleCancel() {
    redirectUnderage();
}

function resetAll() {
    document.getElementById('yearSelect').selectedIndex = 0;
    var sel = document.getElementById('monthSelect');
    sel.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.textContent = '选择';
    placeholder.disabled = true;
    placeholder.selected = true;
    sel.appendChild(placeholder);
    stopDayRolling();
    dayValue = 0;
    document.getElementById('dayBox').textContent = '0';
    var box = document.getElementById('dayBox');
    box.classList.remove('paused');
    box.classList.add('running');
    dayRunning = true;
    startDayRolling();
    document.getElementById('hintText').textContent = '点击"日"暂停滚动，再次点击继续';
}

function submitDate() {
    stopDayRolling();

    var year = parseInt(document.getElementById('yearSelect').value);
    var month = parseInt(document.getElementById('monthSelect').value);
    var day = parseInt(document.getElementById('dayBox').textContent);

    // 彩蛋：2077年，优先检查
    if (year === 2077) {
        var eggHtml = '<p style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">🎉 你触发了一个彩蛋！🎉</p>'
            + '<p style="font-size: 14px; margin-bottom: 12px;">”牛逼啊V“，赛博朋克2077，经典永流传</p>'
            + '<audio controls autoplay id="eggAudio" style="width: 100%; border-radius: 8px;">'
            + '<source src="./assets/Samuel Kim、Lorien - I Really Want to Stay at Your House.mp3" type="audio/mpeg">'
            + '您的浏览器不支持音频播放'
            + '</audio>';
        _showModalHtml(eggHtml, [
            { label: '继续', primary: true, callback: function () {
                var audio = document.getElementById('eggAudio');
                if (audio) audio.pause();
                // 关闭彩蛋后继续验证
                continueSubmit(year, month, day);
            } }
        ]);
        return;
    }

    // 彩蛋：2022年10月27日（纳西妲生日彩蛋），与2077彩蛋互斥
    if (year === 2022 && month === 10 && day === 27) {
        var eggHtml = '<p style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">🎉 纳西妲的生日！🎉</p>'
            + '<p style="font-size: 14px; margin-bottom: 12px;">"Piax花玲，失眠飞行"</p>'
            + '<audio controls autoplay id="eggAudio" style="width: 100%; border-radius: 8px;">'
            + '<source src="./assets/【Piax花玲】失眠飞行.mp3" type="audio/mpeg">'
            + '您的浏览器不支持音频播放'
            + '</audio>';
        _showModalHtml(eggHtml, [
            { label: '继续', primary: true, callback: function () {
                var audio = document.getElementById('eggAudio');
                if (audio) audio.pause();
                continueSubmit(year, month, day);
            } }
        ]);
        return;
    }

    continueSubmit(year, month, day);
}

function continueSubmit(year, month, day) {
    if (isNaN(month)) {
        var r = Math.floor(Math.random() * 25);
        var sel = document.getElementById('monthSelect');
        sel.innerHTML = '';
        var opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r + '月';
        opt.selected = true;
        sel.appendChild(opt);
        month = r;
        startDayRolling();
        return;
    } else if (month < 1 || month > 12) {
        customAlert('月份 ' + month + ' 不合法！请重新选择。', function () { resetAll(); });
        return;
    }

    if (day < 1 || day > 31) {
        customAlert('日期 ' + day + ' 不合法！请重新选择。', function () { resetAll(); });
        return;
    }

    var birth = new Date(year, month - 1, day);
    if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) {
        customAlert(year + '年' + month + '月' + day + '日 不符合客观事实，请重新选择！', function () { resetAll(); });
        return;
    }

    var today = new Date();
    var age = today.getFullYear() - birth.getFullYear();
    var mDiff = today.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    if (age < 0) {
        customAlert('你活在未来吗？年龄不可以是负数', function () { resetAll(); });
        return;
    }

    if (age > 100) {
        customAlert('您都' + age + '岁了，您老人家还看\uD83D\uDD1E啊？', function () { resetAll(); });
        return;
    }

    if (age >= 18) {
        document.getElementById('overlay2').classList.add('hidden');
        captchaErrorCount = 0;
        document.getElementById('surrenderBtn').classList.remove('show');
        initCaptcha();
        document.getElementById('overlay3').classList.remove('hidden');
    } else {
        redirectUnderage();
    }
}

// ========== 人机验证相关 ==========

var captchaTarget = [];
var captchaFrozen = [];
var captchaFreezeState = [];
var captchaJumpTimers = [];
var captchaErrorCount = 0;

function initCaptcha() {
    captchaTarget = [];
    captchaFrozen = [];
    captchaFreezeState = [];
    captchaJumpTimers = [];

    var targetRow = document.getElementById('targetRow');
    var jumpRow = document.getElementById('jumpRow');
    targetRow.innerHTML = '';
    jumpRow.innerHTML = '';

    for (var i = 0; i < 6; i++) {
        var t = Math.floor(Math.random() * 10);
        captchaTarget.push(t);
        captchaFrozen.push(0);
        captchaFreezeState.push(false);

        var targetBox = document.createElement('div');
        targetBox.className = 'captcha-box target';
        targetBox.textContent = t;
        targetRow.appendChild(targetBox);

        var jumpBox = document.createElement('div');
        jumpBox.className = 'captcha-box jumping';
        jumpBox.id = 'jumpBox' + i;
        jumpBox.textContent = Math.floor(Math.random() * 10);
        jumpBox.dataset.index = i;
        jumpBox.addEventListener('click', function () {
            toggleJumpBox(parseInt(this.dataset.index));
        });
        jumpRow.appendChild(jumpBox);

        captchaJumpTimers.push(setInterval((function (idx) {
            return function () {
                if (!captchaFreezeState[idx]) {
                    var box = document.getElementById('jumpBox' + idx);
                    if (box) box.textContent = Math.floor(Math.random() * 10);
                }
            };
        })(i), 100));
    }
}

function toggleJumpBox(index) {
    var box = document.getElementById('jumpBox' + index);
    if (captchaFreezeState[index]) {
        captchaFreezeState[index] = false;
        box.classList.remove('frozen');
        box.classList.add('jumping');
        captchaJumpTimers[index] = setInterval(function () {
            if (!captchaFreezeState[index]) {
                box.textContent = Math.floor(Math.random() * 10);
            }
        }, 100);
    } else {
        captchaFreezeState[index] = true;
        captchaFrozen[index] = parseInt(box.textContent);
        box.classList.remove('jumping');
        box.classList.add('frozen');
        if (captchaJumpTimers[index]) {
            clearInterval(captchaJumpTimers[index]);
            captchaJumpTimers[index] = null;
        }
    }
}

function stopAllJumping() {
    for (var i = 0; i < captchaJumpTimers.length; i++) {
        if (captchaJumpTimers[i]) {
            clearInterval(captchaJumpTimers[i]);
            captchaJumpTimers[i] = null;
        }
    }
}

function resetCaptcha() {
    stopAllJumping();
    initCaptcha();
}

function submitCaptcha() {
    for (var i = 0; i < 6; i++) {
        if (!captchaFreezeState[i]) {
            customAlert('请先点击所有6个跳动数字完成选择！');
            return;
        }
    }

    var allMatch = true;
    for (var i = 0; i < 6; i++) {
        if (captchaFrozen[i] !== captchaTarget[i]) {
            allMatch = false;
            break;
        }
    }

    if (allMatch) {
        stopAllJumping();
        document.getElementById('overlay3').classList.add('hidden');
        showUIDVerification();
    } else {
        captchaErrorCount++;

        if (captchaErrorCount >= 5) {
            document.getElementById('surrenderBtn').classList.add('show');
        }

        customAlert('数字不匹配，请重新选择！', function () { resetCaptcha(); });
    }
}

function surrender() {
    customAlert('人机验证：算你识相，这一关就放过你了', function () {
        stopAllJumping();
        document.getElementById('overlay3').classList.add('hidden');
        showUIDVerification();
    });
}

// ========== UID验证相关 ==========
// 作弊命令：document.getElementById('uidInput').value = '你的UID'

var uidSlider = document.getElementById('uidSlider');
var uidInput = document.getElementById('uidInput');
var uidIconClickCount = 0;

document.getElementById('uidIcon').addEventListener('click', function () {
    uidIconClickCount++;
    if (uidIconClickCount >= 10) {
        uidIconClickCount = 0;
        customPrompt('竟然被你发现了作弊窗口！那我就放你一马吧！\n请输入你的UID（纯数字，最多9位）：\n输入"跳过"可跳过验证', function (customUid) {
            if (customUid === '跳过') {
                confirmUID();
            } else if (customUid !== null && customUid !== '') {
                customUid = customUid.replace(/[^0-9]/g, '');
                if (customUid.length > 9) {
                    customUid = customUid.substring(0, 9);
                }
                if (customUid.length > 0) {
                    uidSlider.value = customUid;
                    uidInput.value = customUid;
                    document.getElementById('uidError').classList.remove('show');
                }
            }
        });
    }
});

uidSlider.addEventListener('input', function () {
    uidInput.value = this.value;
    document.getElementById('uidError').classList.remove('show');
});

function showUIDVerification() {
    // 初始化UID滑块
    uidSlider.value = '100000000';
    uidInput.value = '100000000';
    document.getElementById('uidError').classList.remove('show');
    document.getElementById('loadingText').classList.remove('show');
    document.getElementById('overlay4').classList.remove('hidden');
}

function queryUID() {
    var uid = uidInput.value;
    var loadingEl = document.getElementById('loadingText');
    var errorEl = document.getElementById('uidError');
    var hintEl = document.getElementById('fallbackHint');

    errorEl.classList.remove('show');
    hintEl.classList.remove('show');
    loadingEl.classList.add('show');

    var apis = [
        { url: 'api/enkaapi.php?uid=' + uid + '&source=mys', name: '米游社API' },
        { url: 'api/enkaapi.php?uid=' + uid + '&source=enka', name: 'Enka API' },
        { url: 'api/enkaapi.php?uid=' + uid + '&source=microgg', name: 'Microgg API' },
    ];

    function tryFetch(index) {
        if (index >= apis.length) {
            loadingEl.classList.remove('show');
            errorEl.textContent = '查询失败，请检查UID后或者稍后重试，也有可能是网页太火爆了，可以稍后再试或者输入已缓存的UID';
            errorEl.classList.add('show');
            return;
        }

        loadingEl.textContent = '正在查询玩家信息...（' + apis[index].name + '）';

        fetch(apis[index].url)
        .then(function (resp) {
            if (resp.status === 429) {
                throw { is429: true, message: '上游返回信息：查询太频繁，请稍后再试。（我确信应该是服务器炸了）\n网页太火爆了，可以稍后再试或者输入已缓存的UID' };
            }
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        })
        .then(function (data) {
            loadingEl.classList.remove('show');
            hintEl.classList.remove('show');

            var player = data.playerInfo;
            if (!player) {
                errorEl.textContent = '未找到该UID的玩家信息';
                errorEl.classList.add('show');
                return;
            }

            var notSupported = '目标API不支持该信息查询';
            var nickname = player.nickname || '-';
            var level = player.level || '-';
            var signature = (player.signature !== undefined && player.signature !== '') ? player.signature : (player._source === 'mys' ? notSupported : (player.signature || '-'));
            var worldLevel = player.worldLevel === -1 ? notSupported : (player.worldLevel !== undefined ? player.worldLevel : '-');
            var achievement = player.finishAchievementNum !== undefined ? player.finishAchievementNum : '-';

            // 检查是否符合要求：冒险等级60 且 成就数大于900
            var achievementNum = player.finishAchievementNum || 0;
            var html = '<table class="modal-player-table">'
                + '<tr><td class="label">玩家昵称</td><td class="value">' + nickname + '</td></tr>'
                + '<tr><td class="label">冒险等级</td><td class="value">' + level + '</td></tr>'
                + '<tr><td class="label">签名</td><td class="value">' + signature + '</td></tr>'
                + '<tr><td class="label">世界等级</td><td class="value">' + worldLevel + '</td></tr>'
                + '<tr><td class="label">完成成就数</td><td class="value">' + achievement + '</td></tr>'
                + '</table>';

            if (player.level === 60 && achievementNum > 900) {
                html += '<div class="modal-result-pass">符合要求！</div>';
                customConfirmHtml(html, function () {
                    confirmUID();
                });
            } else {
                html += '<div class="modal-result-fail">不符合要求（需要等级60 + 成就数&gt;900）</div>';
                customAlertHtml(html);
            }
        })
        .catch(function (err) {
            // 显示回退提示
            if (index + 1 < apis.length) {
                var reason = err && err.is429 ? '限流' : '失败';
                hintEl.textContent = apis[index].name + '查询' + reason + '，自动切换至' + apis[index + 1].name + '查询，请耐心等待……';
                hintEl.classList.add('show');
                tryFetch(index + 1);
            } else {
                // 所有 API 都试完了
                loadingEl.classList.remove('show');
                if (err && err.is429) {
                    errorEl.textContent = err.message;
                } else {
                    errorEl.textContent = '所有方法查询失败，请检查UID后或者稍后重试，也有可能是网页太火爆了，可以加Q群:1064345563 联系群主修复。';
                }
                errorEl.classList.add('show');
            }
        });
    }

    tryFetch(0);
}

function confirmUID() {
    showCongrats();
}

function showCongrats(skipMode) {
    document.getElementById('overlay4').classList.add('hidden');
    document.getElementById('overlay5').classList.remove('hidden');
    if (skipMode) {
        document.querySelector('#overlay5 .modal p').textContent = '你通过神秘小参数跳过了认证，现在你可以自由开始探索了！';
    }
}

function closeCongrats() {
    document.getElementById('overlay5').classList.add('hidden');
    document.getElementById('bg').classList.remove('blur');
    document.getElementById('mainButtons').classList.add('show');
}

function goYuanShen() {
    var urls = [
        'https://www.yuanshen.com',
        'https://ys.mihoyo.com',
        'https://space.bilibili.com/401742377'
    ];
    var url = urls[Math.floor(Math.random() * urls.length)];
    window.open(url, '_blank');
}

function installYuanShen() {
    var ua = navigator.userAgent;

    // iOS/iPadOS 走 AppStore（这些设备 UA 也可能包含 Mac，需优先判断）
    if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1 || ua.indexOf('iPod') !== -1) {
        window.open('https://ys-api.mihoyo.com/event/download_porter/link/ys_cn/official/ios_default', '_blank');
        return;
    }

    // 桌面端 Mac
    if (ua.indexOf('Mac') !== -1) {
        customConfirm('你用的是MacOS，暂不支持下载安装原神，请问是否跳转到云原神官网？', function () {
            window.open('https://ys.mihoyo.com/cloud', '_blank');
        });
        return;
    }

    var url;

    if (ua.indexOf('OpenHarmony') !== -1) {
        // 纯血鸿蒙
        url = 'https://appgallery.huawei.com/app/detail?id=com.miHoYo.Yuanshen';
    } else if (ua.indexOf('Android') !== -1 || ua.indexOf('Adr') !== -1) {
        // Android
        url = 'https://ys-api.mihoyo.com/event/download_porter/link/ys_cn/official/android_backup320';
    } else if (ua.indexOf('Linux') !== -1 && ua.indexOf('Android') === -1) {
        // Linux 桌面端
        customConfirm('你使用的貌似是Linux系统，暂不支持下载安装原神，请问是否跳转到云原神官网？', function () {
            window.open('https://ys.mihoyo.com/cloud', '_blank');
        });
        return;
    } else {
        // 默认Windows
        url = 'https://ys-api.mihoyo.com/event/download_porter/link/ys_cn/official/pc_backup320';
    }

    window.open(url, '_blank');
}

var hotVideoClickCount = 0;

// Toast 浮动通知
function showToast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(function () {
        toast.classList.add('toast-out');
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 2500);
}

// 下载背景图
function downloadBg() {
    if (!window.fetch || !window.URL || !window.URL.createObjectURL) {
        showToast('您的浏览器不支持blob，请更换浏览器后重试', 'error');
        return;
    }

    var isMobile = window.innerWidth <= 768;
    var path = isMobile ? wallpaperMobile : wallpaperPc;
    if (!path) {
        showToast('壁纸尚未加载完成，请稍后再试', 'error');
        return;
    }

    showToast('正在下载背景图，请稍后...', 'info');

    var url = path;
    var filename = path.split('/').pop();

    fetch(url)
        .then(function (resp) {
            if (!resp.ok) throw new Error('下载失败');
            return resp.blob();
        })
        .then(function (blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href); // 销毁URL对象
            showToast('已发送下载请求，请查看浏览器下载通知。', 'success');
        })
        .catch(function () {
            showToast('背景图下载失败，请稍后重试', 'error');
        });
}

function hotVideos() {
    var btns = document.querySelectorAll('.btn-big');
    btns.forEach(function (b) {
        if (b.textContent.indexOf('3D区') !== -1) {
            b.textContent = '\uD83D\uDE013D区热门大骗(多次点击有不同效果哦)\uD83D\uDE01';
        }
    });
    hotVideoClickCount++;
    if (hotVideoClickCount === 1) {
        window.open('https://www.bilibili.com/video/BV1GJ411x7h7', '_blank');
        return;
    }
    if (hotVideoClickCount === 2) {
        window.open('https://www.bilibili.com/video/BV1dyXqBaEE5/', '_blank');
        return;
    }
    fetch('hotvideo.json')
        .then(function (resp) {
            if (!resp.ok) throw new Error('Failed to load');
            return resp.json();
        })
        .then(function (items) {
            var item = items[Math.floor(Math.random() * items.length)];
            var url = typeof item === 'string' ? item : item.url;
            var title = typeof item === 'string' ? '' : (item.title || '');
            if (title) {
                showToast('🎬 ' + title, 'success');
            }
            window.open(url, '_blank');
        })
        .catch(function () {
            window.open('https://www.bilibili.com/video/BV1dyXqBaEE5', '_blank');
        });
}

function closeVideo() {
    document.getElementById('videoOverlay').classList.add('hidden');
    var video = document.getElementById('videoPlayer');
    video.pause();
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else if (document.webkitFullscreenElement) {
        document.webkitExitFullscreen();
    } else if (document.msFullscreenElement) {
        document.msExitFullscreen();
    }
}

// 监听全屏退出事件，自动隐藏视频遮罩
document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) {
        document.getElementById('videoOverlay').classList.add('hidden');
        var video = document.getElementById('videoPlayer');
        video.pause();
    }
});
document.addEventListener('webkitfullscreenchange', function () {
    if (!document.webkitFullscreenElement) {
        document.getElementById('videoOverlay').classList.add('hidden');
        var video = document.getElementById('videoPlayer');
        video.pause();
    }
});
document.addEventListener('msfullscreenchange', function () {
    if (!document.msFullscreenElement) {
        document.getElementById('videoOverlay').classList.add('hidden');
        var video = document.getElementById('videoPlayer');
        video.pause();
    }
});

// 科乐美秘技：上上下下左左右右BA
(function () {
    var konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    var index = 0;
    document.addEventListener('keydown', function (e) {
        if (e.key === konami[index]) {
            index++;
            if (index === konami.length) {
                index = 0;
                skip();
            }
        } else {
            index = 0;
        }
    });
})();

function goRival() {
    fetch('acg-game-list.json')
        .then(function (resp) {
            if (!resp.ok) throw new Error('Failed to load');
            return resp.json();
        })
        .then(function (games) {
            var game = games[Math.floor(Math.random() * games.length)];
            customAlert('即将跳转到：' + game.name, function () {
                window.open(game.official_site_cn, '_blank');
            });
        })
        .catch(function () {
            // 默认跳转到鸣潮（我自己写的时候都没绷住，这里没有黑鸣潮的意思，不要骂我呜呜呜）
            window.open('https://mc.kurogames.com', '_blank');
        });
}

// 奇妙小函数，用来一键跳过所有验证
function skip() {
    var overlays = document.querySelectorAll('.overlay');
    for (var i = 0; i < overlays.length; i++) {
        overlays[i].classList.add('hidden');
    }
    stopAllJumping();
    stopDayRolling();
    document.getElementById('bg').classList.remove('blur');
    document.getElementById('mainButtons').classList.add('show');
    showCongrats(true);
    console.log('这个后门都被你发现了？');
}

// 使用操作系统注册协议启动原神
function startGenshineImpact() {
    var ua = navigator.userAgent;
    // iOS/iPadOS/Android
    if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1 || ua.indexOf('iPod') !== -1 || ua.indexOf('Android') !== -1 || ua.indexOf('Adr') !== -1) {
        window.open('yuanshen://');
    } else if (ua.indexOf('OpenHarmony') !== -1) {
        // 纯血鸿蒙
        window.open('yuanshen://oig.mihoyo.com/ys');
    } else if (ua.indexOf('Windows') !== -1) {
        // 国服
        window.open('HYP-cn://launchgame?gamebiz=hk4e_cn&openGame=true');
        // 国际服
        setTimeout(function() {
            window.open('HYP-global://launchgame?gamebiz=hk4e_global&openGame=true');
        }, 100);
    } else {
        window.open('https://oig.mihoyo.com/ys/', '_blank');
    }
}

// 主按钮显示/隐藏切换（双向图标互换）
var _btnShow = true;
var _toggleBtn = document.getElementById('toggleMainBtn');
var _toggleSvg = _toggleBtn ? _toggleBtn.querySelector('svg') : null;
var _svgShow = '<path d="M602.83-377.17q50.5-50.5 50.5-122.83t-50.5-122.83q-50.5-50.5-122.83-50.5t-122.83 50.5q-50.5 50.5-50.5 122.83t50.5 122.83q50.5 50.5 122.83 50.5t122.83-50.5ZM401.5-421.5q-32.17-32.17-32.17-78.5t32.17-78.5q32.17-32.17 78.5-32.17t78.5 32.17q32.17 32.17 32.17 78.5t-32.17 78.5q-32.17 32.17-78.5 32.17t-78.5-32.17Zm-186.17 139Q96.67-365 40-500q56.67-135 175.33-217.5Q334-800 480-800t264.67 82.5Q863.33-635 920-500q-56.67 135-175.33 217.5Q626-200 480-200t-264.67-82.5ZM480-500Zm217.5 169.83q99.17-63.5 151.17-169.83-52-106.33-151.17-169.83-99.17-63.5-217.5-63.5t-217.5 63.5Q163.33-606.33 110.67-500q52.66 106.33 151.83 169.83 99.17 63.5 217.5 63.5t217.5-63.5Z"/>';
var _svgHide = '<path d="m634-422-48.67-48.67q20.34-63-27-108-47.33-45-107.66-26.66L402-654q17-10 36.83-14.67 19.84-4.66 41.17-4.66 72.33 0 122.83 50.5T653.33-500q0 21.33-5 41.5T634-422Zm128.67 128-46-45.33Q762-373 796.17-414.17q34.16-41.16 52.5-85.83-50-107.67-147.84-170.5-97.83-62.83-214.16-62.83-37.67 0-76.34 6.66Q371.67-720 346-710l-51.33-52q37-16.33 87.66-27.17Q433-800 483.33-800q145.67 0 264 82.17Q865.67-635.67 920-500q-25 62.33-64.83 114.5-39.84 52.17-92.5 91.5ZM808-61.33 640-226.67q-35 13-76.17 19.84Q522.67-200 480-200q-147.67 0-266.33-82.17Q95-364.33 40-500q20.33-52.33 54.67-100.5 34.33-48.17 82-90.17L56-812l46.67-47.33 750 750-44.67 48ZM222.67-644q-34.34 26.67-65.34 66.33-31 39.67-46.66 77.67 50.66 107.67 150.16 170.5t224.5 62.83q28.67 0 56.34-3.5 27.66-3.5 45-9.83L532-335.33q-11 4.33-25 6.5-14 2.16-27 2.16-71.67 0-122.5-50.16Q306.67-427 306.67-500q0-13.67 2.16-27 2.17-13.33 6.5-25l-92.66-633.33ZM426-416Z"/>';
if (_toggleBtn && _toggleSvg) {
    _toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (_btnShow) {
            // 隐藏按钮 + 切为闭眼图标
            document.getElementById('mainButtons').classList.remove('show');
            showToast('已隐藏界面，点击任意一处地方显示', 'success');
            _toggleSvg.innerHTML = _svgHide;
            _btnShow = false;
        } else {
            // 显示按钮 + 切为睁眼图标
            document.getElementById('mainButtons').classList.add('show');
            _toggleSvg.innerHTML = _svgShow;
            _btnShow = true;
        }
    });
    document.addEventListener('click', function () {
        if (!_btnShow) {
            document.getElementById('mainButtons').classList.add('show');
            _toggleSvg.innerHTML = _svgShow;
            _btnShow = true;
        }
    });
}

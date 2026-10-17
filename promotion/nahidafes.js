/**
 * 2026 纳西妲生日会「旅叶知微」全国大屏应援计划 —— 推广弹窗
 * 结构片段：promotion/nahidafes.html
 * 样式：promotion/nahidafes.css
 * 展示时机：通过年龄/UID 验证、关闭祝贺弹窗进入主界面时（挂在 closeCongrats 上）
 * 「当日不再弹出」：勾选后按本地日期写入 localStorage，当天不再展示
 */
(function () {
    'use strict';

    var FRAGMENT_URL = 'promotion/nahidafes.html';
    var STORAGE_KEY = 'nahidafes_promo_muted_date';
    var VIEW_URL = 'https://www.bilibili.com/opus/1254213820103000073';

    var overlay = null;
    var pendingShow = false;

    function todayKey() {
        var d = new Date();
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    }

    function isMutedToday() {
        try {
            return window.localStorage.getItem(STORAGE_KEY) === todayKey();
        } catch (e) {
            return false;
        }
    }

    function muteToday() {
        try {
            window.localStorage.setItem(STORAGE_KEY, todayKey());
        } catch (e) {
            // 无痕模式下 localStorage 不可用，忽略
        }
    }

    function applyMuteIfChecked() {
        var box = document.getElementById('nahidafesNoRemind');
        if (box && box.checked) muteToday();
    }

    function onKeydown(e) {
        if (e.key === 'Escape' || e.keyCode === 27) nahidafesClose();
    }

    function show() {
        if (!overlay) {
            pendingShow = true;
            return;
        }
        if (isMutedToday()) return;
        overlay.classList.remove('nahidafes-hidden');
        document.addEventListener('keydown', onKeydown);
    }

    function hide() {
        if (!overlay) return;
        overlay.classList.add('nahidafes-hidden');
        document.removeEventListener('keydown', onKeydown);
    }

    function nahidafesClose() {
        applyMuteIfChecked();
        hide();
    }

    function nahidafesView() {
        applyMuteIfChecked();
        hide();
        window.open(VIEW_URL, '_blank');
    }

    window.nahidafesClose = nahidafesClose;
    window.nahidafesView = nahidafesView;

    function mountFragment() {
        if (overlay || isMutedToday() || !window.fetch) return;
        fetch(FRAGMENT_URL, { cache: 'no-cache' })
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.text();
            })
            .then(function (html) {
                var holder = document.createElement('div');
                holder.innerHTML = html;
                while (holder.firstChild) {
                    document.body.appendChild(holder.firstChild);
                }
                overlay = document.getElementById('nahidafesOverlay');
                if (overlay && pendingShow) {
                    pendingShow = false;
                    show();
                }
            })
            .catch(function (err) {
                console.warn('[nahidafes] 推广弹窗结构加载失败：', err);
            });
    }

    // 验证通过进入主界面时弹出（正常流程与 /?skip 最终都会走 closeCongrats）
    function hookVerifyDone() {
        var original = window.closeCongrats;
        if (typeof original !== 'function') return false;
        window.closeCongrats = function () {
            original.apply(this, arguments);
            show();
        };
        return true;
    }

    function init() {
        mountFragment();
        if (!hookVerifyDone()) {
            document.addEventListener('DOMContentLoaded', hookVerifyDone);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
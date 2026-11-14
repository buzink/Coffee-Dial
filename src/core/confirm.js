let appConfirmResolver = null;

export const resolveAppConfirm = (result) => {
    const overlay = document.getElementById('appConfirmOverlay');
    if (overlay) overlay.classList.add('hidden');
    if (appConfirmResolver) {
        const resolve = appConfirmResolver;
        appConfirmResolver = null;
        resolve(!!result);
    }
};

export const closeAppConfirm = (event) => {
    if (!event || event.target.id === 'appConfirmOverlay') {
        resolveAppConfirm(false);
    }
};

export const openAppConfirm = ({
    title = 'Confirm action',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = true,
    showCancel = true
} = {}) => {
    const overlay = document.getElementById('appConfirmOverlay');
    document.getElementById('appConfirmInput')?.classList.add('hidden');
    const titleEl = document.getElementById('appConfirmTitle');
    const messageEl = document.getElementById('appConfirmMessage');
    const confirmBtn = document.getElementById('appConfirmConfirmBtn');
    const cancelBtn = document.getElementById('appConfirmCancelBtn');
    if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) return Promise.resolve(false);

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;
    cancelBtn.classList.toggle('hidden', !showCancel);
    confirmBtn.className = danger
        ? 'px-3 py-1.5 text-sm font-semibold rounded bg-red-600 hover:bg-red-700 text-white'
        : 'px-3 py-1.5 text-sm font-semibold rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white';

    overlay.classList.remove('hidden');
    return new Promise((resolve) => {
        appConfirmResolver = resolve;
    });
};

// Ask the user for a line of text in the app's own dialog (window.prompt is turned off
// below). Resolves with the trimmed text, or null when cancelled or left empty.
export const openAppPrompt = ({
    title = 'Enter a value',
    message = '',
    placeholder = '',
    value = '',
    inputType = 'text',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel'
} = {}) => {
    const input = document.getElementById('appConfirmInput');
    if (!input) return Promise.resolve(null);
    const result = openAppConfirm({ title, message, confirmLabel, cancelLabel, danger: false });
    input.type = inputType;
    input.placeholder = placeholder;
    input.value = value;
    input.classList.remove('hidden');
    input.onkeydown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            resolveAppConfirm(true);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            resolveAppConfirm(false);
        }
    };
    setTimeout(() => input.focus(), 50);
    return result.then((confirmed) => {
        const text = `${input.value || ''}`.trim();
        input.onkeydown = null;
        input.classList.add('hidden');
        return confirmed && text ? text : null;
    });
};

export const installDialogAdapters = (showToast) => {
    window.alert = (message) => {
        showToast(message);
    };
    window.confirm = () => false;
    window.prompt = () => null;
};

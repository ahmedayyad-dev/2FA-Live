const STORAGE_KEY = '2fa_secret';
const STEP = 30;

const secretInput = document.getElementById('secret');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const inputSection = document.getElementById('input-section');
const codeSection = document.getElementById('code-section');
const codeDisplay = document.getElementById('code-display');
const countdownBar = document.getElementById('countdown-bar');
const countdownText = document.getElementById('countdown-text');

let interval = null;

function base32Decode(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    str = str.replace(/[=\s]/g, '').toUpperCase();

    let bits = '';
    for (const char of str) {
        const val = alphabet.indexOf(char);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }

    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
    }
    return bytes;
}

async function generateTOTP(secret) {
    const keyBytes = base32Decode(secret);
    const timeStep = Math.floor(Date.now() / 1000 / STEP);

    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(4, timeStep, false);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    const hmac = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
    const hmacBytes = new Uint8Array(hmac);

    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const code = (
        ((hmacBytes[offset] & 0x7f) << 24) |
        ((hmacBytes[offset + 1] & 0xff) << 16) |
        ((hmacBytes[offset + 2] & 0xff) << 8) |
        (hmacBytes[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, '0');
}

function getTimeRemaining() {
    return STEP - (Math.floor(Date.now() / 1000) % STEP);
}

function updateCountdown() {
    const remaining = getTimeRemaining();
    const percent = (remaining / STEP) * 100;

    countdownBar.style.width = percent + '%';
    countdownText.textContent = remaining + 's';

    if (remaining <= 5) {
        countdownBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
    } else {
        countdownBar.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
    }
}

async function updateCode() {
    const secret = localStorage.getItem(STORAGE_KEY);
    if (!secret) return;

    try {
        const code = await generateTOTP(secret);
        codeDisplay.textContent = code;
    } catch {
        codeDisplay.textContent = '------';
    }
}

function startInterval() {
    if (interval) clearInterval(interval);

    updateCode();
    updateCountdown();

    interval = setInterval(async () => {
        updateCountdown();
        await updateCode();
    }, 1000);
}

function showCode() {
    inputSection.classList.add('hidden');
    codeSection.classList.remove('hidden');
    startInterval();
}

function showInput() {
    codeSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    if (interval) clearInterval(interval);
    secretInput.value = '';
    secretInput.classList.remove('error');
}

function save() {
    const secret = secretInput.value.replace(/\s/g, '');

    if (!secret || secret.length < 8) {
        secretInput.classList.add('error');
        setTimeout(() => secretInput.classList.remove('error'), 1000);
        return;
    }

    try {
        base32Decode(secret);
    } catch {
        secretInput.classList.add('error');
        setTimeout(() => secretInput.classList.remove('error'), 1000);
        return;
    }

    localStorage.setItem(STORAGE_KEY, secret);
    showCode();
}

function clear() {
    localStorage.removeItem(STORAGE_KEY);
    showInput();
}

saveBtn.addEventListener('click', save);
clearBtn.addEventListener('click', clear);
secretInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
});

if (localStorage.getItem(STORAGE_KEY)) {
    showCode();
}

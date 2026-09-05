import { getLocale } from './i18n.js';

const REPO_URL = 'https://github.com/sidphoto/shrimp-intelligence';
const REPO_NAME = 'sidphoto/shrimp-intelligence';
const GITHUB_MARK_URL = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';

const COPY = {
  'zh-TW': {
    label: '專案來源',
    hint: 'GitHub 原始碼公開（非商業授權）'
  },
  en: {
    label: 'Project source',
    hint: 'Source-available on GitHub'
  },
  'vi-VN': {
    label: 'Nguồn dự án',
    hint: 'Mã nguồn công khai trên GitHub'
  }
};

let scheduled = false;

function copy() {
  return COPY[getLocale()] || COPY['zh-TW'];
}

function mount() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || sidebar.querySelector('[data-github-source]')) return;

  const c = copy();
  const block = document.createElement('div');
  block.className = 'sidebar-github-source';
  block.dataset.githubSource = '';
  block.innerHTML = `
    <div class="sidebar-github-label">${c.label}</div>
    <a class="sidebar-github-link" href="${REPO_URL}" target="_blank" rel="noopener noreferrer" aria-label="GitHub ${REPO_NAME}">
      <span class="sidebar-github-icon" aria-hidden="true">
        <img src="${GITHUB_MARK_URL}" alt="" width="24" height="24" decoding="async">
      </span>
      <span class="sidebar-github-copy">
        <strong>${REPO_NAME}</strong>
        <small>${c.hint} ↗</small>
      </span>
    </a>
  `;
  sidebar.appendChild(block);
}

function scheduleMount() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    mount();
  });
}

const app = document.querySelector('#app');
if (app) {
  new MutationObserver(scheduleMount).observe(app, { childList: true, subtree: true });
}
window.addEventListener('hashchange', scheduleMount);
window.addEventListener('popstate', scheduleMount);
scheduleMount();

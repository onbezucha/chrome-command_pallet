import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  version: '0.1.0',
  description: '__MSG_extDescription__',
  default_locale: 'cs',
  minimum_chrome_version: '121',
  permissions: [
    'tabs',
    'tabGroups',
    'sessions',
    'storage',
    'bookmarks',
    'history',
    'favicon',
    'activeTab',
    'scripting',
    'alarms',
    'notifications',
    'clipboardRead',
  ],
  optional_host_permissions: ['https://www.cnb.cz/*'],
  options_ui: { page: 'src/options/index.html', open_in_tab: true },
  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  web_accessible_resources: [
    { resources: ['_favicon/*'], matches: ['<all_urls>'], extension_ids: ['*'] },
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_title: '__MSG_actionTitle__',
    default_icon: { '16': 'icons/icon-16.png', '32': 'icons/icon-32.png' },
  },
  commands: {
    'open-command-bar': {
      suggested_key: { default: 'Alt+K' },
      description: '__MSG_cmdOpenBar__',
    },
  },
})

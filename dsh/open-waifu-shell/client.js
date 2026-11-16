// Browser half of the open-waifu shell plugin. Hand-written for DSH's module
// loader (no build step): `require` hands out the shell's shared React and
// slot runtime, and `apply` registers everything through `ctx.slots`.
window.__ModuleLoader__.load({
  id: '@open-waifu/dsh-shell',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { IconPluginPinwheelOutlineRegular, IconSettingsOutlineMedium } = require('@deepseek-ai/dsh-client-ui-primitives')
    const shell = window.__OW_SHELL__ ?? { look: null }
    // Present only inside the app window; a plain browser tab has no window to drive.
    const tauri = window.__TAURI_INTERNALS__
    const win = (cmd) => tauri.invoke(`plugin:window|${cmd}`, { label: 'main' })
    // macOS keeps its native traffic lights (titleBarStyle Overlay); only the
    // frameless Windows/Linux window needs our own buttons.
    const mac = /Mac/.test(navigator.platform || navigator.userAgent)

    // Jan's blue accent, the app's default when the settings carry none.
    const look = shell.look ?? { primary: '#456BDE', sidebar: { light: '#C4D0F3', dark: '#0F2157' } }
    const both = (v) => ({ light: v, dark: v })
    // Jan's palette (web-app/src/index.css) mapped onto DSH's alias tokens.
    const TOKENS = {
      '--dsh-font-family-text': both("'Inter', 'Segoe UI', sans-serif"),
      '--dsw-alias-bg-base': { light: 'oklch(1 0 0)', dark: 'oklch(0.18 0 0)' },
      '--dsw-alias-bg-layer-1': { light: 'oklch(1 0 0)', dark: 'oklch(0.205 0 0)' },
      '--dsw-alias-bg-layer-2': { light: 'oklch(0.97 0 0)', dark: 'oklch(0.235 0 0)' },
      '--dsw-alias-bg-overlay': { light: 'oklch(1 0 0)', dark: 'oklch(0.205 0 0)' },
      '--dsw-alias-border-l1': { light: 'oklch(0.922 0 0)', dark: 'oklch(1 0 0 / 10%)' },
      '--dsw-alias-border-l2': { light: 'oklch(0.88 0 0)', dark: 'oklch(1 0 0 / 15%)' },
      '--dsw-alias-label-primary': { light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)' },
      '--dsw-alias-label-secondary': { light: 'oklch(0.556 0 0)', dark: 'oklch(0.708 0 0)' },
      '--dsw-alias-button-primary-fill': both(look.primary),
      '--dsw-alias-button-info-fill': both(look.primary),
      '--dsw-alias-state-business-primary': both(look.primary),
      '--dsw-specific-input-major': { light: 'oklch(0.97 0 0)', dark: 'oklch(0.235 0 0)' },
      '--dsw-specific-selector': { light: 'oklch(0.94 0 0)', dark: 'oklch(0.269 0 0)' },
      '--dsw-specific-bubble': {
        light: `color-mix(in oklch, ${look.primary} 22%, white)`,
        dark: `color-mix(in oklch, ${look.primary} 70%, black)`,
      },
      '--dsw-specific-sidebar-fill': look.sidebar,
      '--dsw-specific-sidebar-nav-item-hover': {
        light: `color-mix(in oklch, ${look.sidebar.light} 85%, black)`,
        dark: `color-mix(in oklch, ${look.sidebar.dark} 85%, white)`,
      },
      '--dsw-specific-sidebar-nav-item-active': {
        light: `color-mix(in oklch, ${look.sidebar.light} 75%, black)`,
        dark: `color-mix(in oklch, ${look.sidebar.dark} 75%, white)`,
      },
      '--dsw-specific-sidebar-nav-item-active-accent': {
        light: `color-mix(in oklch, ${look.sidebar.light} 75%, black)`,
        dark: `color-mix(in oklch, ${look.sidebar.dark} 75%, white)`,
      },
    }

    const CSS = `
@font-face { font-family: 'Inter'; font-display: swap; font-weight: 100 900; src: url('/ow-shell/assets/InterVariable.woff2') format('woff2'); }
@font-face { font-family: 'StudioFeixenSans'; font-display: swap; font-weight: 500; src: url('/ow-shell/assets/StudioFeixenSans-Medium.otf') format('opentype'); }
.ow-name { font-family: 'StudioFeixenSans', 'Inter', sans-serif; font-size: 16px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.ow-titlebar { position: fixed; inset: 0 0 auto 0; height: var(--dsh-windows-titlebar-height); z-index: 40; pointer-events: none; }
.ow-titlebar > .ow-drag { position: absolute; inset: 0 140px 0 280px; pointer-events: auto; }
.ow-controls { position: absolute; top: 0; right: 0; display: flex; height: 100%; pointer-events: auto; }
.ow-controls button { width: 46px; height: 100%; border: 0; background: transparent; color: var(--dsw-alias-label-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: default; }
.ow-controls button:hover { background: color-mix(in oklch, var(--dsw-alias-label-primary) 10%, transparent); color: var(--dsw-alias-label-primary); }
.ow-controls button.ow-close:hover { background: #c42b1c; color: #fff; }
/* DSH 0.2.2's public data-slot anchors and frame data attributes delimit these
   rules. Only the shipped shell's immediate structure is styled; no hashed
   classes, DOM moves, or blanket slot suppression. A replaced parent owns its
   own geometry. Later theme plugins can override tokens, and later CSS can
   override these marker-scoped rules. */
  html[data-ow-shell] {
    --ow-sidebar-gap: 8px;
    --ow-sidebar-radius: 14px;
  }
  html[data-ow-shell] [data-slot='root'] > [data-sidebar-collapsed], html[data-ow-shell] [data-slot='root'] > :has(> [data-shell-overlay]) {
    background: var(--dsw-alias-bg-base);
  }
  html[data-ow-shell] [data-slot='root'] > :has(> [data-shell-overlay])::before { background: var(--dsw-alias-bg-base); }
  html[data-ow-shell] [data-slot='root'] > :has(> [data-shell-overlay]) > :has([data-slot='main']) {
    border: 0;
    border-radius: 0;
  }
  html[data-ow-shell] [data-slot='root'] > :has(> [data-shell-overlay]):not([data-sidebar-collapsed]):not([data-sidebar-drawer]) > :has(> [data-slot='sidebar']) {
    position: relative;
    margin: var(--ow-sidebar-gap) 0 var(--ow-sidebar-gap) var(--ow-sidebar-gap);
    border: 1px solid var(--dsw-alias-border-l1);
    border-radius: var(--ow-sidebar-radius);
    background: var(--dsw-alias-bg-base);
    overflow: hidden;
  }
  html[data-ow-shell] [data-slot='sidebar'] > div {
    width: 100% !important; /* DSH passes the outer column width, before the inset. */
    background: linear-gradient(to bottom, var(--dsw-specific-sidebar-fill), var(--dsw-alias-bg-base));
    padding: 6px 8px;
  }
  html[data-ow-shell] body[data-ds-dark-theme] [data-slot='sidebar'] > div {
    background: linear-gradient(to bottom, color-mix(in srgb, var(--dsw-specific-sidebar-fill) 70%, transparent), var(--dsw-alias-bg-base));
  }
  html[data-ow-shell] [data-slot='sidebar'] > div > :has([data-slot='sidebar.brand.name']) {
    height: 40px;
    padding: 0 2px 0 4px;
    margin: 0 0 8px;
  }
  html[data-ow-shell] [data-slot='sidebar'] [data-slot='sidebar.brand.mark']:has(.ow-sidebar-mark) { display: none; }
  /* Clear the native traffic lights (tauri.macos.conf.json trafficLightPosition). */
  html[data-ow-shell][data-ow-mac] [data-slot='sidebar'] > div > :has([data-slot='sidebar.brand.name']) { padding-left: 64px; }
  html[data-ow-shell][data-ow-mac]:has([data-sidebar-collapsed]) [data-slot='sidebar'] [data-sidebar-toggle] { left: 84px; }
  html[data-ow-shell] [data-slot='sidebar.brand.name'] .ow-name { font-size: 14px; }
  html[data-ow-shell] [data-slot='sidebar'] [data-sidebar-toggle] {
    position: relative;
    inset: auto;
    margin-left: auto;
  }
  html[data-ow-shell]:has([data-sidebar-collapsed]) [data-slot='sidebar'] [data-sidebar-toggle] {
    position: fixed;
    top: calc((var(--dsh-windows-titlebar-height, 40px) - 28px) / 2);
    left: 12px;
  }
  html[data-ow-shell] [data-slot='sidebar'] > div > button {
    justify-content: flex-start;
    height: 36px;
    margin: 0 3px 2px;
    padding: 7px 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    box-shadow: none;
    font-weight: 400;
  }
  html[data-ow-shell] [data-slot='sidebar'] > div > button > span:first-child > span { width: auto; justify-content: flex-start; gap: 8px; }
  html[data-ow-shell] [data-slot='sidebar'] > div > button > span:last-child:not(:first-child) { opacity: 1; color: var(--dsw-alias-label-secondary); font-size: 11px; }
  html[data-ow-shell] [data-slot='sidebar'] nav { margin: 0 0 12px; }
  html[data-ow-shell] [data-slot='sidebar'] nav > button, html[data-ow-shell] [data-slot='sidebar'] nav > div > button { min-height: 36px; border-radius: 6px; }
  html[data-ow-shell] [data-row-key^='session:'] { min-height: 36px; }
  html[data-ow-shell] [data-slot='sidebar.settings'] { color: var(--dsw-alias-label-secondary); }
  html[data-ow-shell] [data-conversation-content] { --dsh-composer-card-max-width: 768px; }
  html[data-ow-shell] [data-composer-card] {
    border: 1px solid var(--dsw-alias-border-l1);
    border-radius: 28px;
    box-shadow: none;
    padding-top: 12px;
  }
  html[data-ow-shell] [data-composer-input] { padding-left: 18px; }
  html[data-ow-shell] [data-composer-placeholder] { left: 18px; }
  html[data-ow-shell] span:has(> [data-slot='conversation.hero.brand.mark'] .ow-hero-title) + span { display: none; }
  html[data-ow-shell] [data-slot='conversation.hero.brand.mark']:has(.ow-hero-title) { display: contents; }
  .ow-hero-title { margin: 0 0 8px; font-family: 'StudioFeixenSans', 'Inter', sans-serif; font-size: 24px; font-weight: 500; line-height: 32px; text-wrap: balance; }
.ow-footer-action { width: 100%; min-height: 36px; display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; text-align: left; cursor: pointer; }
.ow-footer-action:hover { background: var(--dsw-specific-sidebar-nav-item-hover); color: var(--dsw-alias-label-primary); }
.ow-footer-action:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }
.ow-footer-action[data-rail] { justify-content: center; padding-inline: 0; }
/* Native titlebar rules need to outrank DSH's platform rules; they never touch
   third-party panel or composer contents. The existing DSH track motion stays. */
html[data-ow-shell][data-windows-titlebar] [data-slot='root'] > :has(> [data-shell-overlay]) { padding-top: 0; }
html[data-ow-shell][data-windows-titlebar] [data-slot='root'] > :has(> [data-shell-overlay]) > :has([data-slot='main']),
html[data-ow-shell][data-windows-titlebar] [data-slot='root'] > :has(> [data-shell-overlay]) > [data-rightbar-col] { padding-top: var(--dsh-windows-titlebar-height); }

`

    const svg = (d, size = 10) => h('svg', { width: size, height: size, viewBox: '0 0 10 10', fill: 'none', stroke: 'currentColor', strokeWidth: 1 }, d)
    const Name = () => h('span', { className: 'ow-name' }, 'Jan')

    function TitleBar() {
      const [maximized, setMaximized] = React.useState(false)
      const sync = () => { win('is_maximized').then(setMaximized, () => { }) }
      React.useEffect(() => {
        sync()
        window.addEventListener('resize', sync)
        return () => window.removeEventListener('resize', sync)
      }, [])
      return h('div', { className: 'ow-titlebar' },
        h('div', { className: 'ow-drag', 'data-tauri-drag-region': '' }),
        !mac && h('div', { className: 'ow-controls' },
          h('button', { type: 'button', 'aria-label': 'Minimize', onClick: () => win('minimize') }, svg(h('path', { d: 'M0 5h10' }))),
          h('button', { type: 'button', 'aria-label': maximized ? 'Restore' : 'Maximize', onClick: () => win('toggle_maximize').then(sync) },
            svg(maximized ? h('path', { d: 'M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z' }) : h('rect', { x: 0.5, y: 0.5, width: 9, height: 9 }))),
          h('button', { type: 'button', className: 'ow-close', 'aria-label': 'Close', onClick: () => win('close') }, svg(h('path', { d: 'M0 0l10 10M10 0L0 10' })))))
    }

    // The mark leaf is the only public hero seat in this DSH release. Owning
    // its text avoids editing the conversation namespace's single-owner dictionary.
    const HeroTitle = ({ t }) => h('h1', { className: 'ow-hero-title' }, t('hero.headline'))
    const SidebarMark = () => h('span', { className: 'ow-sidebar-mark', 'aria-hidden': true })

    function PluginManagerAction({ wide, useAvailable, openPlugins, t }) {
      const available = useAvailable((value) => value)
      if (!available) return null
      return h('button', {
        type: 'button', className: 'ow-footer-action', 'data-rail': !wide || undefined,
        'aria-label': t('plugins'), title: !wide ? t('plugins') : undefined,
        onClick: openPlugins,
      }, h(IconPluginPinwheelOutlineRegular, { size: 16 }), wide && t('plugins'))
    }

    function SettingsLauncher({ wide, settingsOpen, settingsShortcut, openSettings, t }) {
      return h('button', {
        type: 'button', className: 'ow-footer-action', 'data-rail': !wide || undefined,
        'aria-label': t('settings'), title: !wide ? t('settings') : undefined,
        'aria-haspopup': 'dialog', 'aria-expanded': settingsOpen,
        'aria-keyshortcuts': settingsShortcut?.aria, onClick: openSettings,
      }, h(IconSettingsOutlineMedium, { size: 16 }), wide && t('settings'))
    }

    return {
      name: 'open-waifu-shell',
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.dataset.plugin = '@open-waifu/dsh-shell'
        style.textContent = CSS
        document.head.append(style)
        ctx.effect(() => () => style.remove(), 'open-waifu-shell: styles')

        ctx.inject(['theme'], (scope) => {
          scope.effect(() => scope.theme.overrideTokens('open-waifu', TOKENS), 'open-waifu-shell: Jan palette')
        })

        const html = document.documentElement
        html.setAttribute('data-ow-shell', '')
        ctx.effect(() => () => html.removeAttribute('data-ow-shell'), 'open-waifu-shell: root marker')

        ctx.inject(['locale'], (scope) => {
          scope.effect(() => scope.locale.register('open-waifu.shell', {
            en: { 'hero.headline': 'How can I help you today?', plugins: 'Plugin manager', settings: 'Settings' },
            zh: { 'hero.headline': '今天有什么可以帮您？', plugins: '插件管理', settings: '设置' },
          }), 'open-waifu-shell: owned hero copy')
        })

        // Single seats elect the lowest priority. These replace bundled branding
        // at zero; a user plugin can shadow Jan with priority -2 or lower.
        ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, SidebarMark))
        ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({ name: 'sidebar.brand.name', priority: -1 }, Name))
        ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: -1, locale: 'open-waifu.shell' }, HeroTitle))

        ctx.inject(['layout'], (scope) => {
          const available = {
            getSnapshot: () => scope.slots.entriesOfSlot('main').some((entry) => entry.options.key === 'plugins'),
            subscribe: (listener) => scope.slots.subscribe('main', listener),
          }
          scope.slots.inject('sidebar.footer.action', () => scope.slots.register({
            name: 'sidebar.footer.action', id: 'ow-plugin-manager', order: 0,
            locale: 'open-waifu.shell',
            inject: () => ({
              hooks: { available },
              openPlugins: () => scope.layout.selectPanel('plugins'),
            }),
          }, PluginManagerAction))
        })
        ctx.slots.inject('settings.launcher', () => ctx.slots.register({
          name: 'settings.launcher', priority: -1, locale: 'open-waifu.shell',
        }, SettingsLauncher))

        if (tauri) {
          // DSH's layout reserves a Windows-style title row under these two
          // values; the row's buttons are ours, since the window has no frame.
          const html = document.documentElement
          html.setAttribute('data-windows-titlebar', '')
          html.style.setProperty('--dsh-windows-titlebar-height', '40px')
          if (mac) html.setAttribute('data-ow-mac', '')
          ctx.effect(() => () => {
            html.removeAttribute('data-windows-titlebar')
            html.style.removeProperty('--dsh-windows-titlebar-height')
            html.removeAttribute('data-ow-mac')
          }, 'open-waifu-shell: title row')
          ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'ow-titlebar', order: 100 }, TitleBar))
        }
      },
    }
  },
})

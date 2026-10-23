"""Optional UI check: run the app, then `python tests/browser_smoke.py`.

Requires Playwright for Python and a Chromium browser. No application dependency.
"""
import os
import shutil
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get('TYPEGARDEN_URL', 'http://127.0.0.1:3000')

with sync_playwright() as p:
    chromium_path = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    options = {'headless': True}
    if chromium_path:
        options['executable_path'] = chromium_path
    browser = p.chromium.launch(**options)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install()
    page.goto(BASE_URL, wait_until='networkidle')
    expect(page).to_have_title('Type Garden — 毎日のタイピング練習')
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    page.screenshot(path='/tmp/typegarden-desktop.png', full_page=True)

    # Timer does not start until the first input.
    page.locator('[data-duration="30"]').click()
    page.clock.fast_forward(5000)
    expect(page.locator('#time-remaining')).to_have_text('30')
    target = page.locator('#word-display').inner_text()
    entry = page.locator('#typing-input')
    entry.focus()
    wrong = 'x' if target[0] != 'x' else 'z'
    entry.press_sequentially(wrong)
    expect(page.locator('.word-display .incorrect')).to_have_count(1)
    entry.press('Space')
    expect(page.locator('#live-words')).to_have_text('0')
    entry.press('Backspace')
    entry.press_sequentially(target)
    expect(page.locator('.word-display .incorrect')).to_have_count(0)
    entry.press('Space')
    expect(page.locator('#live-words')).to_have_text('1')
    assert int(page.locator('#live-accuracy').inner_text()) < 100
    page.clock.fast_forward(30050)
    expect(page.locator('#result-panel')).to_be_visible()
    expect(page.locator('#time-remaining')).to_have_text('0')
    expect(entry).to_be_disabled()
    assert page.evaluate('JSON.parse(localStorage.getItem("typegarden.history.v1")).length') == 1
    assert page.locator('#best-wpm').inner_text() != '—'
    expect(page.locator('.recent-row')).to_have_count(1)
    page.screenshot(path='/tmp/typegarden-result.png', full_page=True)

    # Reload restores results; English and Japanese bests stay separate.
    page.reload(wait_until='networkidle')
    expect(page.locator('.recent-row')).to_have_count(1)
    page.locator('[data-mode="english"]').click()
    expect(page.locator('#best-wpm')).to_have_text('—')
    page.locator('[data-duration="120"]').click()
    expect(page.locator('#time-remaining')).to_have_text('120')
    entry = page.locator('#typing-input')
    entry.fill('あ')
    expect(entry).to_have_value('')
    expect(page.locator('#input-hint')).to_contain_text('半角英字')
    word = page.locator('#word-display').inner_text()
    entry.press_sequentially(word)
    entry.press('Space')
    expect(page.locator('#live-words')).to_have_text('1')
    entry.press('Escape')
    expect(page.locator('#live-words')).to_have_text('0')
    expect(page.locator('#time-remaining')).to_have_text('120')

    # Another complete session in a different mode.
    page.locator('[data-duration="30"]').click()
    word = page.locator('#word-display').inner_text()
    entry.press_sequentially(word)
    entry.press('Space')
    page.clock.fast_forward(30050)
    expect(page.locator('#result-panel')).to_be_visible()
    assert page.evaluate('JSON.parse(localStorage.getItem("typegarden.history.v1")).length') == 2
    expect(page.locator('#live-accuracy')).to_have_text('100')
    page.locator('#retry-button').click()
    expect(page.locator('#result-panel')).to_be_hidden()
    expect(entry).to_be_focused()

    # History navigation, cancellation, deletion, and persistence.
    page.locator('#history-nav').click()
    expect(page.locator('#history-view')).to_be_visible()
    expect(page.locator('.history-table tbody tr')).to_have_count(2)
    page.screenshot(path='/tmp/typegarden-history.png', full_page=True)
    page.locator('#clear-history').click()
    expect(page.locator('#clear-dialog')).to_be_visible()
    page.locator('#cancel-clear').click()
    expect(page.locator('.history-table tbody tr')).to_have_count(2)
    page.locator('#clear-history').click()
    page.locator('#confirm-clear').click()
    expect(page.locator('.history-empty')).to_be_visible()
    assert page.evaluate('localStorage.getItem("typegarden.history.v1")') is None
    page.locator('#back-practice').click()
    expect(page.locator('#practice-view')).to_be_visible()

    # Responsive layout at common phone/tablet sizes.
    for width in [320, 375, 390, 768, 1024]:
        page.set_viewport_size({'width': width, 'height': 844})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Horizontal overflow at {width}px'
        expect(entry).to_be_visible()
        if width == 390:
            page.screenshot(path='/tmp/typegarden-mobile.png', full_page=True)

    # Disabled storage and damaged saved JSON must not break practice.
    isolated = browser.new_context(viewport={'width': 390, 'height': 844})
    offline = isolated.new_page()
    offline.on('pageerror', lambda error: errors.append(str(error)))
    offline.add_init_script('Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Unavailable", "SecurityError") } });')
    offline.clock.install()
    offline.goto(BASE_URL, wait_until='networkidle')
    offline.locator('[data-duration="30"]').click()
    offline.locator('#typing-input').fill(offline.locator('#word-display').inner_text())
    offline.locator('#typing-input').press('Space')
    offline.clock.fast_forward(30050)
    expect(offline.locator('#result-panel')).to_be_visible()
    expect(offline.locator('#toast')).to_contain_text('保存ができませんでした')
    isolated.close()
    page.evaluate('localStorage.setItem("typegarden.history.v1", "corrupt")')
    page.reload(wait_until='networkidle')
    expect(page.locator('#typing-input')).to_be_enabled()
    expect(page.locator('.empty-recent')).to_be_visible()
    page.evaluate('localStorage.clear()')
    assert not errors, errors
    browser.close()
    print('PASS: timed practice, corrections, Japanese/English modes, history persistence/deletion, restart, responsive layouts, unavailable/corrupt storage; no browser errors.')

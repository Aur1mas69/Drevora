import drevoraDMarkUrl from './assets/drevora-d-mark.png'

const FEATURE_ART = {
    workers: '/icons/sliced/workers.webp',
    vehicles: '/icons/sliced/vehicles.webp',
    timesheets: '/icons/sliced/timesheets.webp',
    holidays: '/icons/sliced/holidays.webp',
    checks: '/icons/sliced/vehicle-checks.webp',
    tyres: '/icons/sliced/tyre-checks.webp',
    reports: '/icons/sliced/driver-reports.webp',
    documents: '/icons/sliced/documents.webp',
    consumables: '/icons/sliced/consumables.webp',
    mobile: '/icons/sliced/offline-mobile.webp',
    dashboard: '/icons/sliced/fleet-office-dashboard.webp',
    security: '/icons/sliced/security-compliance.webp',
}

function restoreMobileScroll() {
    document.documentElement.style.removeProperty('overflow')
    document.documentElement.style.removeProperty('overflow-y')
    document.documentElement.style.removeProperty('position')
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('overflow-y')
    document.body.style.removeProperty('position')
    document.body.style.removeProperty('top')
    document.body.style.removeProperty('width')
    document.body.classList.remove('no-scroll', 'menu-open', 'modal-open')
}

window.addEventListener('pageshow', restoreMobileScroll)
window.addEventListener('load', restoreMobileScroll)

const COOKIE_NOTICE_STORAGE_KEY = 'drevora.cookie_notice.v1'
const COOKIE_NOTICE_VALUE = 'accepted'
const COOKIE_NOTICE_ROOT_ID = 'drevora-cookie-notice-root'

function hasCookieNoticeAcknowledgement() {
    try {
        return window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) === COOKIE_NOTICE_VALUE
    } catch {
        return false
    }
}

function storeCookieNoticeAcknowledgement() {
    try {
        window.localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, COOKIE_NOTICE_VALUE)
        return true
    } catch {
        return false
    }
}

function removeCookieNotice() {
    const root = document.getElementById(COOKIE_NOTICE_ROOT_ID)
    if (root) {
        root.remove()
    }
    document.documentElement.classList.remove('cookie-notice-open')
}

function acknowledgeCookieNotice() {
    storeCookieNoticeAcknowledgement()
    removeCookieNotice()
}

function createCookieNotice() {
    if (document.getElementById(COOKIE_NOTICE_ROOT_ID)) {
        return
    }

    const root = document.createElement('div')
    root.id = COOKIE_NOTICE_ROOT_ID
    root.className = 'cookie-notice-root'
    root.innerHTML = `
        <div class="cookie-notice-backdrop" aria-hidden="true"></div>
        <div
            class="cookie-notice"
            role="dialog"
            aria-modal="false"
            aria-labelledby="cookie-notice-title"
            aria-describedby="cookie-notice-body"
        >
            <div class="cookie-notice__content">
                <h2 id="cookie-notice-title" class="cookie-notice__title">Cookies and browser storage</h2>
                <p id="cookie-notice-body" class="cookie-notice__body">
                    DREVORA uses necessary cookies and similar browser storage technologies to support
                    secure sign-in, remember user preferences and provide essential platform features.
                    DREVORA does not currently use advertising or behavioural tracking cookies.
                </p>
                <div class="cookie-notice__actions">
                    <a class="cookie-notice__link" href="/cookies">View Cookie Policy</a>
                    <button type="button" class="cookie-notice__accept" data-cookie-notice-accept>
                        Accept necessary cookies
                    </button>
                </div>
            </div>
        </div>
    `

    document.body.appendChild(root)
    document.documentElement.classList.add('cookie-notice-open')

    const acceptButton = root.querySelector('[data-cookie-notice-accept]')
    if (acceptButton instanceof HTMLButtonElement) {
        acceptButton.addEventListener('click', () => {
            acknowledgeCookieNotice()
        })
    }

    // Acknowledgement is required — Escape must not dismiss the notice.
    root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
        }
    })
}

function initCookieNotice() {
    if (hasCookieNoticeAcknowledgement()) {
        return
    }
    createCookieNotice()
}

function initChallengeNoteLift() {
    const notes = document.querySelectorAll('#problems .challenges-notes > .challenges-note')
    if (!notes.length) return

    notes.forEach((note) => {
        note.addEventListener('pointerenter', () => {
            note.classList.add('is-lifted')
        })
        note.addEventListener('pointerleave', () => {
            note.classList.remove('is-lifted')
        })
    })
}

document.addEventListener('DOMContentLoaded', () => {
    restoreMobileScroll()
    initCookieNotice()
    initChallengeNoteLift()

    const footerYear = document.getElementById('footer-year')
    if (footerYear) {
        footerYear.textContent = String(new Date().getFullYear())
    }

    if (document.body.classList.contains('legal-page') && !window.location.hash) {
        window.scrollTo(0, 0)
    }

    const header = document.getElementById('main-header')
    const menuToggle = document.getElementById('menu-toggle')
    const mobileMenu = document.getElementById('mobile-menu')
    const menuIcon = document.getElementById('menu-icon')
    const mobileMoreToggle = document.getElementById('mobile-more-toggle')
    const mobileMoreContent = document.getElementById('mobile-more-content')
    const mobileMoreChevron = document.getElementById('mobile-more-chevron')
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link')

    if (!header || !menuToggle || !mobileMenu || !menuIcon) {
        return
    }

    function updateHeaderStyles() {
        if (window.scrollY > 20) {
            header.classList.remove('bg-transparent')
            header.classList.add('bg-surface/80', 'backdrop-blur-md', 'shadow-md')
        } else {
            header.classList.remove('bg-surface/80', 'backdrop-blur-md', 'shadow-md')
            header.classList.add('bg-transparent')
        }
    }

    function isMobileMenuOpen() {
        return mobileMenu.classList.contains('mobile-menu-panel--open')
    }

    function closeMobileMenu() {
        mobileMenu.classList.remove('mobile-menu-panel--open', 'translate-x-0')
        mobileMenu.classList.add('translate-x-full')
        mobileMenu.setAttribute('aria-hidden', 'true')
        menuIcon.classList.remove('fa-xmark')
        menuIcon.classList.add('fa-bars')
        menuToggle.setAttribute('aria-expanded', 'false')
        restoreMobileScroll()
    }

    function openMobileMenu() {
        mobileMenu.classList.add('mobile-menu-panel--open', 'translate-x-0')
        mobileMenu.classList.remove('translate-x-full')
        mobileMenu.setAttribute('aria-hidden', 'false')
        menuIcon.classList.remove('fa-bars')
        menuIcon.classList.add('fa-xmark')
        menuToggle.setAttribute('aria-expanded', 'true')
        restoreMobileScroll()
    }

    updateHeaderStyles()
    menuToggle.setAttribute('aria-expanded', 'false')
    closeMobileMenu()

    let headerTicking = false
    window.addEventListener(
        'scroll',
        () => {
            if (headerTicking) return
            headerTicking = true
            requestAnimationFrame(() => {
                updateHeaderStyles()
                headerTicking = false
            })
        },
        { passive: true },
    )

    menuToggle.addEventListener('click', () => {
        if (isMobileMenuOpen()) {
            closeMobileMenu()
        } else {
            openMobileMenu()
        }
    })

    window.addEventListener('resize', () => {
        restoreMobileScroll()
        if (window.innerWidth >= 768) {
            closeMobileMenu()
        }
    })

    window.addEventListener('orientationchange', () => {
        restoreMobileScroll()
        if (window.innerWidth >= 768) {
            closeMobileMenu()
        }
    })

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isMobileMenuOpen()) {
            closeMobileMenu()
        }
    })

    window.addEventListener('hashchange', () => {
        closeMobileMenu()
        restoreMobileScroll()
    })

    window.addEventListener('pageshow', () => {
        restoreMobileScroll()
        if (!isMobileMenuOpen()) {
            closeMobileMenu()
        }
    })

    if (mobileMoreToggle && mobileMoreContent) {
        mobileMoreToggle.addEventListener('click', () => {
            const isExpanded =
                mobileMoreContent.style.maxHeight &&
                mobileMoreContent.style.maxHeight !== '0px'

            if (isExpanded) {
                mobileMoreContent.style.maxHeight = '0px'
                if (mobileMoreChevron) mobileMoreChevron.style.transform = 'rotate(0deg)'
            } else {
                mobileMoreContent.style.maxHeight = mobileMoreContent.scrollHeight + 'px'
                if (mobileMoreChevron) mobileMoreChevron.style.transform = 'rotate(180deg)'
            }
        })
    }

    mobileNavLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href')

            if (!href || !href.startsWith('#')) {
                closeMobileMenu()
                restoreMobileScroll()
                return
            }

            e.preventDefault()
            closeMobileMenu()
            restoreMobileScroll()

            const targetElement = document.querySelector(href)

            if (targetElement) {
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth' })
                    restoreMobileScroll()
                }, 200)
            }
        })
    })

    document.querySelectorAll('a[href="#contact"]').forEach((link) => {
        link.addEventListener('click', () => {
            closeMobileMenu()
            restoreMobileScroll()
            setTimeout(restoreMobileScroll, 300)
        })
    })

    const contactSection = document.getElementById('contact')
    if (contactSection) {
        contactSection.addEventListener('focusin', restoreMobileScroll)
    }

})

// Dashboard slider

document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('dashboard-slider')
    const dots = document.querySelectorAll('#slider-dots .dot')

    if (!slider || dots.length === 0) return

    let autoplayInterval
    const autoplayDelay = 4000

    function updateDots(activeIndex) {
        dots.forEach((dot, idx) => {
            const isActive = idx === activeIndex
            dot.classList.toggle('is-active', isActive)
            if (isActive) {
                dot.setAttribute('aria-current', 'true')
            } else {
                dot.removeAttribute('aria-current')
            }
        })
    }

    function startAutoplay() {
        if (window.innerWidth < 768) return

        clearInterval(autoplayInterval)
        autoplayInterval = setInterval(() => {
            const width = slider.clientWidth
            if (width === 0) return

            let currentIdx = Math.round(slider.scrollLeft / width)
            let nextIdx = currentIdx + 1

            if (nextIdx >= dots.length) {
                nextIdx = 0
            }

            slider.scrollTo({
                left: nextIdx * width,
                behavior: 'smooth',
            })
        }, autoplayDelay)
    }

    function resetAutoplay() {
        clearInterval(autoplayInterval)
        startAutoplay()
    }

    slider.addEventListener('scroll', () => {
        const width = slider.clientWidth
        if (width === 0) return
        const activeIndex = Math.round(slider.scrollLeft / width)
        updateDots(activeIndex)
    }, { passive: true })

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.getAttribute('data-index'))
            const width = slider.clientWidth

            slider.scrollTo({
                left: index * width,
                behavior: 'smooth',
            })

            resetAutoplay()
        })
    })

    slider.addEventListener('touchstart', () => clearInterval(autoplayInterval), { passive: true })
    slider.addEventListener('touchend', () => startAutoplay(), { passive: true })

    window.addEventListener('resize', () => {
        clearInterval(autoplayInterval)
        startAutoplay()
    })

    startAutoplay()
})

// Demo request form (inline section — no modal)

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('demo-request-form')
    if (!form) return

    const submitBtn = document.getElementById('demo-request-submit')
    const statusEl = document.getElementById('demo-request-status')
    const defaultBtnText = submitBtn.textContent

    const fullNameInput = document.getElementById('demo-full-name')
    const companyNameInput = document.getElementById('demo-company-name')
    const workEmailInput = document.getElementById('demo-work-email')
    const vehicleCountInput = document.getElementById('demo-vehicle-count')
    const messageInput = document.getElementById('demo-message')

    function hideStatus() {
        statusEl.classList.add('hidden')
        statusEl.textContent = ''
        statusEl.classList.remove('bg-primary/10', 'border', 'border-primary/20', 'text-primary', 'bg-red-50', 'border-red-200', 'text-red-700')
    }

    function showStatus(message, type) {
        hideStatus()
        statusEl.textContent = message
        statusEl.classList.remove('hidden')

        if (type === 'success') {
            statusEl.classList.add('bg-primary/10', 'border', 'border-primary/20', 'text-primary')
        } else {
            statusEl.classList.add('bg-red-50', 'border', 'border-red-200', 'text-red-700')
        }
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        hideStatus()

        const fullName = fullNameInput.value.trim()
        const companyName = companyNameInput.value.trim()
        const workEmail = workEmailInput.value.trim()
        const vehicleCount = vehicleCountInput.value.trim()
        const message = messageInput.value.trim()

        if (!fullName || !companyName || !workEmail || !vehicleCount) {
            showStatus('Please fill in all required fields.', 'error')
            return
        }

        if (!isValidEmail(workEmail)) {
            showStatus('Please enter a valid work email address.', 'error')
            return
        }

        submitBtn.disabled = true
        submitBtn.textContent = 'Sending...'

        try {
            const response = await fetch('/api/request-demo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName,
                    companyName,
                    workEmail,
                    vehicleCount,
                    message,
                }),
            })

            if (!response.ok) {
                throw new Error('Request failed')
            }

            showStatus('Thank you — we’ll contact you shortly.', 'success')
            form.reset()
        } catch {
            showStatus('Something went wrong. Please try again or email admin@drevora.uk.', 'error')
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = defaultBtnText
            restoreMobileScroll()
        }
    })
})

function initFeaturesCoverflow() {
    const root = document.querySelector('[data-features-coverflow]')
    if (!root) return

    const features = [
        {
            title: 'Workers',
            preview: 'workers',
            art: FEATURE_ART.workers,
            body: 'Manage Worker profiles, employment information and compliance records from one organised workspace.',
            caps: [
                { icon: 'badge', label: 'Licence, CPC & Tachograph' },
                { icon: 'medical_services', label: 'Medical & expiry tracking' },
                { icon: 'person', label: 'Worker profiles' },
                { icon: 'verified', label: 'Compliance status' },
            ],
        },
        {
            title: 'Vehicles',
            preview: 'vehicles',
            art: FEATURE_ART.vehicles,
            body: 'Keep vehicles and trailers organised with fleet information, compliance records and operational history.',
            caps: [
                { icon: 'local_shipping', label: 'Vehicles & trailers' },
                { icon: 'info', label: 'Fleet information' },
                { icon: 'build', label: 'MOT, tax & service' },
                { icon: 'history', label: 'Vehicle history' },
            ],
        },
        {
            title: 'Timesheets',
            preview: 'timesheets',
            body: 'Digital Worker timesheets with automatic or manual hours, overtime rules, approvals and payroll-ready exports.',
        },
        {
            title: 'Holidays',
            preview: 'holidays',
            art: FEATURE_ART.holidays,
            body: 'Manage leave requests, individual entitlements and approvals without relying on paper or messages.',
            caps: [
                { icon: 'event_available', label: 'Paid & unpaid leave' },
                { icon: 'account_balance_wallet', label: 'Individual entitlements' },
                { icon: 'thumb_up', label: 'Approve or decline' },
                { icon: 'pie_chart', label: 'Live balances' },
            ],
        },
        {
            title: 'Vehicle Checks',
            preview: 'checks',
            art: FEATURE_ART.checks,
            body: 'Workers complete structured daily walkaround checks with evidence and clear defect reporting.',
            caps: [
                { icon: 'edit_note', label: 'Configurable templates' },
                { icon: 'rule', label: 'OK / Defect / N/A' },
                { icon: 'photo_camera', label: 'Photos & signatures' },
                { icon: 'report', label: 'Defect history' },
            ],
        },
        {
            title: 'Tyre Checks',
            preview: 'tyres',
            art: FEATURE_ART.tyres,
            body: 'Record truck and trailer tyre condition using axle-based inspections and tread-depth measurements.',
            caps: [
                { icon: 'view_module', label: 'Truck & trailer layouts' },
                { icon: 'straighten', label: 'Tread-depth recording' },
                { icon: 'traffic', label: 'Condition indicators' },
                { icon: 'history', label: 'Inspection history' },
            ],
        },
        {
            title: 'Driver Reports',
            preview: 'reports',
            art: FEATURE_ART.reports,
            body: 'Workers can report operational issues directly from mobile so the Office can review and act quickly.',
            caps: [
                { icon: 'car_crash', label: 'Vehicle damage' },
                { icon: 'inventory_2', label: 'Load & site issues' },
                { icon: 'attach_file', label: 'Supporting evidence' },
                { icon: 'rate_review', label: 'Office review' },
            ],
        },
        {
            title: 'Documents',
            preview: 'documents',
            art: FEATURE_ART.documents,
            body: 'Keep company, Worker and vehicle documents organised with expiry visibility and mobile submissions.',
            caps: [
                { icon: 'badge', label: 'Worker documents' },
                { icon: 'directions_car', label: 'Vehicle documents' },
                { icon: 'description', label: 'CMR, POD & receipts' },
                { icon: 'event', label: 'Expiry tracking' },
            ],
        },
        {
            title: 'Consumables',
            preview: 'consumables',
            art: FEATURE_ART.consumables,
            body: 'Record fuel and other consumables against vehicles to maintain a clear usage and cost history.',
            caps: [
                { icon: 'local_gas_station', label: 'Diesel & AdBlue' },
                { icon: 'water_drop', label: 'Oils & consumables' },
                { icon: 'payments', label: 'Quantity & cost' },
                { icon: 'history', label: 'Vehicle usage history' },
            ],
        },
        {
            title: 'Offline & Mobile',
            preview: 'mobile',
            art: FEATURE_ART.mobile,
            body: 'Give Workers mobile-first tools designed for real transport work, including limited-connectivity environments.',
            caps: [
                { icon: 'smartphone', label: 'Mobile-first Worker UI' },
                { icon: 'cloud_off', label: 'Offline-capable workflows' },
                { icon: 'storage', label: 'Local data handling' },
                { icon: 'sync', label: 'Sync when reconnected' },
            ],
        },
        {
            title: 'Fleet & Office Dashboard',
            preview: 'dashboard',
            art: FEATURE_ART.dashboard,
            body: 'Give the Office a central operational view of fleet activity, staff workflows and items requiring attention.',
            caps: [
                { icon: 'groups', label: 'Workers & fleet' },
                { icon: 'calendar_month', label: 'Timesheets & holidays' },
                { icon: 'notification_important', label: 'Compliance alerts' },
                { icon: 'checklist', label: 'Daily actions' },
            ],
        },
        {
            title: 'Security & Compliance',
            preview: 'security',
            art: FEATURE_ART.security,
            body: 'Keep company data separated and controlled with structured permissions and secure record handling.',
            caps: [
                { icon: 'domain', label: 'Company-isolated data' },
                { icon: 'admin_panel_settings', label: 'Role-based access' },
                { icon: 'policy', label: 'Audit-friendly records' },
                { icon: 'privacy_tip', label: 'GDPR-focused handling' },
            ],
        },
    ]

    const track = root.querySelector('[data-coverflow-track]')
    const stage = root.querySelector('[data-coverflow-stage]')
    const dotsWrap = root.querySelector('[data-coverflow-dots]')
    const prevBtn = root.querySelector('[data-coverflow-prev]')
    const nextBtn = root.querySelector('[data-coverflow-next]')
    const countEl = root.querySelector('[data-coverflow-count]')
    if (!track || !stage || !dotsWrap) return

    let current = 0
    let ignoreClick = false
    let dragging = false
    let dragStartX = 0
    let dragX = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    function illustrationClass(preview) {
        const modifiers = {
            vehicles: ' feature-illustration--vehicles',
            tyres: ' feature-illustration--tyres',
            dashboard: ' feature-illustration--dashboard',
        }
        return `ts-card__art feature-illustration${modifiers[preview] || ''}`
    }

    function statusChip(label, tone = 'ok') {
        return `<span class="ts-status ts-status--${tone}">${label}</span>`
    }

    function listRow({ avatar, title, detail, chip, extra = false }) {
        return `<div class="ts-list__row${avatar ? ' ts-list__row--person' : ''}${extra ? ' ts-preview__extra' : ''}">
            ${avatar ? `<span class="ts-avatar">${avatar}</span>` : ''}
            <div class="ts-list__meta">
                <strong>${title}</strong>
                ${detail ? `<span>${detail}</span>` : ''}
            </div>
            ${chip || ''}
        </div>`
    }

    function showcasePreviewHtml(kind) {
        switch (kind) {
            case 'workers':
                return `<div class="ts-sheet__head"><span>Workers</span></div>
                    ${listRow({ avatar: 'OW', title: 'Oliver Whitmore', detail: 'Driver · Licence Valid', chip: statusChip('Compliant', 'ok') })}
                    ${listRow({ avatar: 'DT', title: 'Daniel Telford', detail: 'Driver · CPC 14 days', chip: statusChip('Expiring soon', 'ot') })}
                    ${listRow({ avatar: 'GG', title: 'Grace Gresham', detail: 'Office', chip: statusChip('Compliant', 'ok') })}`
            case 'vehicles':
                return `<div class="ts-sheet__head"><span>Fleet</span></div>
                    ${listRow({ title: 'YN24 DVR', detail: 'Rigid HGV · MOT Valid', chip: statusChip('Available', 'ok') })}
                    ${listRow({ title: 'VB18 LKB', detail: 'Articulated · Service due in 12 days', chip: statusChip('In service', 'ot') })}
                    ${listRow({ title: 'TR14 002', detail: 'Trailer', chip: statusChip('Available', 'ok') })}`
            case 'holidays':
                return `<div class="ts-sheet__head">
                        <span>August</span>
                        <span class="ts-balance">18.5 days remaining</span>
                    </div>
                    <div class="ts-cal" aria-hidden="true">
                        <span>M</span><span>T</span><span>W</span><span>T</span><span class="is-on">F</span><span>S</span><span>S</span>
                    </div>
                    ${listRow({ title: '12–16 Aug', detail: 'Annual Leave', chip: statusChip('Approved', 'ok') })}
                    ${listRow({ title: '27 Aug', detail: 'Unpaid Leave', chip: statusChip('Pending', 'ot') })}
                    ${listRow({ title: '02 Sep', detail: 'Annual Leave', chip: statusChip('Approved', 'ok') })}`
            case 'checks':
                return `<div class="ts-sheet__head"><span>Daily Walkaround</span></div>
                    ${listRow({ title: 'Lights', chip: statusChip('OK', 'ok') })}
                    ${listRow({ title: 'Mirrors', chip: statusChip('OK', 'ok'), extra: true })}
                    ${listRow({ title: 'Brakes', chip: statusChip('Defect', 'defect') })}
                    ${listRow({ title: 'Bodywork', chip: statusChip('N/A', 'muted') })}
                    <div class="ts-sheet__foot ts-sheet__foot--preview">
                        <span>12 / 14 completed</span>
                        <span class="ts-progress"><i class="ts-progress__fill"></i></span>
                    </div>`
            case 'tyres':
                return `<div class="ts-axle">
                        <div class="ts-axle__label">Steer axle</div>
                        <div class="ts-axle__tyres ts-axle__tyres--2">
                            <div class="ts-tyre"><span>Left</span><b>7.2 mm</b>${statusChip('Good', 'ok')}</div>
                            <div class="ts-tyre"><span>Right</span><b>6.8 mm</b>${statusChip('Good', 'ok')}</div>
                        </div>
                    </div>
                    <div class="ts-axle">
                        <div class="ts-axle__label">Drive axle</div>
                        <div class="ts-axle__tyres ts-axle__tyres--4">
                            <div class="ts-tyre"><span>Outer Left</span><b>4.1 mm</b>${statusChip('Attention', 'ot')}</div>
                            <div class="ts-tyre ts-preview__extra"><span>Inner Left</span><b>5.7 mm</b>${statusChip('Good', 'ok')}</div>
                            <div class="ts-tyre ts-preview__extra"><span>Inner Right</span><b>5.5 mm</b>${statusChip('Good', 'ok')}</div>
                            <div class="ts-tyre"><span>Outer Right</span><b>2.0 mm</b>${statusChip('Critical', 'defect')}</div>
                        </div>
                    </div>`
            case 'reports':
                return `<div class="ts-sheet__head"><span>Driver Reports</span></div>
                    ${listRow({ title: 'Vehicle Damage', detail: 'Mirror damaged', chip: statusChip('New', 'info') })}
                    ${listRow({ title: 'Load Issue', detail: 'Load discrepancy', chip: statusChip('In Progress', 'ot') })}
                    ${listRow({ title: 'Site Issue', detail: 'Access restricted', chip: statusChip('Closed', 'ok') })}`
            case 'documents':
                return `<div class="ts-sheet__head"><span>Documents</span></div>
                    ${listRow({ title: 'Driving Licence', detail: 'Oliver Whitmore', chip: statusChip('Valid', 'ok') })}
                    ${listRow({ title: 'CPC', detail: 'Daniel Telford', chip: statusChip('Expires in 14 days', 'ot') })}
                    ${listRow({ title: 'POD #4582', chip: statusChip('Submitted', 'info') })}
                    ${listRow({ title: 'CMR #4582', chip: statusChip('Submitted', 'info'), extra: true })}`
            case 'consumables':
                return `<div class="ts-sheet__head">
                        <span>This month</span>
                    </div>
                    <div class="ts-usage">
                        <div class="ts-usage__top"><span>Diesel</span><b>426 L</b><em>£612.40</em></div>
                        <span class="ts-bar"><i class="ts-bar__fill ts-bar__fill--high"></i></span>
                    </div>
                    <div class="ts-usage">
                        <div class="ts-usage__top"><span>AdBlue</span><b>38 L</b><em>£31.20</em></div>
                        <span class="ts-bar"><i class="ts-bar__fill ts-bar__fill--mid"></i></span>
                    </div>
                    <div class="ts-usage">
                        <div class="ts-usage__top"><span>Oils</span><b>12 L</b><em>£74.00</em></div>
                        <span class="ts-bar"><i class="ts-bar__fill ts-bar__fill--low"></i></span>
                    </div>`
            case 'mobile':
                return `<div class="ts-sheet__head">
                        <span>Sync queue</span>
                        <span class="ts-balance">Connection restored</span>
                    </div>
                    ${listRow({ title: 'Vehicle Check', chip: statusChip('Synced', 'ok') })}
                    ${listRow({ title: 'Tyre Check', chip: statusChip('Pending sync', 'ot') })}
                    ${listRow({ title: 'Photo evidence', chip: statusChip('Uploading', 'info') })}`
            case 'dashboard':
                return `<div class="ts-kpis">
                        <div class="ts-kpi"><b>25</b><span>Active Vehicles</span></div>
                        <div class="ts-kpi"><b>21</b><span>Workers</span></div>
                        <div class="ts-kpi"><b>3</b><span>Compliance Alerts</span></div>
                        <div class="ts-kpi"><b>5</b><span>Open Reports</span></div>
                    </div>
                    <div class="ts-action">Timesheets awaiting review — 4</div>
                    <div class="ts-action">Vehicle checks missing — 2</div>
                    <div class="ts-action ts-preview__extra">Documents expiring — 3</div>`
            case 'security':
                return `<div class="ts-sheet__head"><span>Access</span></div>
                    ${listRow({ title: 'Director', detail: 'Full company access', chip: statusChip('Active', 'ok') })}
                    ${listRow({ title: 'Office', detail: 'Operational access', chip: statusChip('Active', 'ok') })}
                    ${listRow({ title: 'Worker', detail: 'Own records &amp; workflows', chip: statusChip('Active', 'ok') })}
                    <div class="ts-secure">
                        <span>Tenant isolation &#10003;</span>
                        <span>Audit records &#10003;</span>
                        <span class="ts-preview__extra">Secure authentication &#10003;</span>
                    </div>`
            default:
                return ''
        }
    }

    function featureShowcaseHtml(feature, number) {
        return `
            <div class="ts-card">
                <span class="ts-card__watermark" aria-hidden="true">
                    <img src="${drevoraDMarkUrl}" alt="" width="512" height="512">
                </span>
                <span class="ts-card__number">${number}</span>
                <div class="ts-card__hero">
                    <div class="ts-card__visual">
                        <img class="${illustrationClass(feature.preview)}" src="${feature.art}" alt="" width="150" height="150" aria-hidden="true">
                    </div>
                    <div class="ts-card__intro">
                        <h3 class="ts-card__title">${feature.title}</h3>
                        <p class="ts-card__body">${feature.body}</p>
                    </div>
                </div>
                <div class="ts-card__lower">
                    <div class="ts-card__caps">
                        ${feature.caps.map((cap) => `
                            <div class="ts-cap">
                                <span class="ts-cap__icon material-symbols-outlined" aria-hidden="true">${cap.icon}</span>
                                <span class="ts-cap__label">${cap.label}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="ts-sheet ts-sheet--preview" aria-hidden="true">
                        ${showcasePreviewHtml(feature.preview)}
                    </div>
                </div>
            </div>
        `
    }

    function timesheetsShowcaseHtml(number) {
        const caps = [
            { icon: 'date_range', label: 'Daily & weekly hours' },
            { icon: 'more_time', label: 'Automatic overtime' },
            { icon: 'task_alt', label: 'Manager approval' },
            { icon: 'file_download', label: 'Payroll export' },
        ]

        return `
            <div class="ts-card">
                <span class="ts-card__watermark" aria-hidden="true">
                    <img src="${drevoraDMarkUrl}" alt="" width="512" height="512">
                </span>
                <span class="ts-card__number">${number}</span>
                <div class="ts-card__hero">
                    <div class="ts-card__visual">
                        <img class="${illustrationClass('timesheets')}" src="${FEATURE_ART.timesheets}" alt="" width="150" height="150" aria-hidden="true">
                    </div>
                    <div class="ts-card__intro">
                        <h3 class="ts-card__title">Timesheets</h3>
                        <p class="ts-card__body">Digital Worker timesheets with automatic or manual hours, overtime rules, approvals and payroll-ready exports.</p>
                    </div>
                </div>
                <div class="ts-card__lower">
                    <div class="ts-card__caps">
                        ${caps.map((cap) => `
                            <div class="ts-cap">
                                <span class="ts-cap__icon material-symbols-outlined" aria-hidden="true">${cap.icon}</span>
                                <span class="ts-cap__label">${cap.label}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="ts-sheet" aria-hidden="true">
                    <div class="ts-sheet__head">
                        <span>This Week</span>
                        <span class="ts-sheet__saved">&#10003; All changes saved</span>
                    </div>
                    <div class="ts-sheet__cols">
                        <span>Day</span>
                        <span class="ts-sheet__time">Start</span>
                        <span class="ts-sheet__time">Finish</span>
                        <span class="ts-sheet__optional">Break</span>
                        <span>Total</span>
                        <span>Status</span>
                    </div>
                    <div class="ts-sheet__row">
                        <span class="ts-sheet__day">Monday</span>
                        <span class="ts-sheet__time">08:00</span>
                        <span class="ts-sheet__time">17:00</span>
                        <span class="ts-sheet__optional">01:00</span>
                        <span class="ts-sheet__total">8h 00m</span>
                        <span class="ts-status ts-status--ok">Approved</span>
                    </div>
                    <div class="ts-sheet__row">
                        <span class="ts-sheet__day">Tuesday</span>
                        <span class="ts-sheet__time">08:00</span>
                        <span class="ts-sheet__time">19:00</span>
                        <span class="ts-sheet__optional">01:00</span>
                        <span class="ts-sheet__total">10h 00m</span>
                        <span class="ts-status ts-status--ot">OT</span>
                    </div>
                    <div class="ts-sheet__row">
                        <span class="ts-sheet__day">Wednesday</span>
                        <span class="ts-sheet__time">08:00</span>
                        <span class="ts-sheet__time">17:00</span>
                        <span class="ts-sheet__optional">01:00</span>
                        <span class="ts-sheet__total">8h 00m</span>
                        <span class="ts-status ts-status--ok">Approved</span>
                    </div>
                    <div class="ts-sheet__foot">
                        <span>Week Total</span>
                        <strong>26h 00m</strong>
                        <span class="ts-status ts-status--ok">Ready for payroll</span>
                    </div>
                    </div>
                </div>
            </div>
        `
    }

    features.forEach((feature, i) => {
        const number = String(i + 1).padStart(2, '0')
        const slide = document.createElement('article')
        slide.className = 'feature-coverflow__slide is-showcase'
        if (i === 0) slide.classList.add('is-active')
        if (feature.preview === 'timesheets') slide.classList.add('is-timesheets')
        slide.setAttribute('data-title', feature.title)
        slide.setAttribute('aria-label', `Feature ${i + 1} of ${features.length}: ${feature.title}`)
        slide.innerHTML = feature.preview === 'timesheets'
            ? timesheetsShowcaseHtml(number)
            : featureShowcaseHtml(feature, number)
        slide.addEventListener('click', () => {
            if (ignoreClick || i === current) return
            current = i
            render()
        })
        track.appendChild(slide)

        const dot = document.createElement('button')
        dot.type = 'button'
        dot.className = 'feature-coverflow__dot'
        dot.setAttribute('role', 'tab')
        dot.setAttribute('aria-label', `Show ${feature.title}`)
        dot.addEventListener('click', () => {
            current = i
            render()
        })
        dotsWrap.appendChild(dot)
    })

    const slides = track.querySelectorAll('.feature-coverflow__slide')
    const dots = dotsWrap.querySelectorAll('.feature-coverflow__dot')

    function circularOffset(index) {
        let offset = index - current
        const half = features.length / 2
        if (offset > half) offset -= features.length
        if (offset < -half) offset += features.length
        return offset
    }

    function geometry() {
        const width = window.innerWidth

        if (width < 640) {
            return {
                spacing: 120,
                depthPer: -100,
                rotate: 22,
                baseX: 150,
                scaleStep: 0.1,
            }
        }

        if (width < 1024) {
            return {
                spacing: 170,
                depthPer: -130,
                rotate: 26,
                baseX: 200,
                scaleStep: 0.1,
            }
        }

        return {
            spacing: 210,
            depthPer: -160,
            rotate: 28,
            baseX: 250,
            scaleStep: 0.1,
        }
    }

    function render() {
        const { spacing, depthPer, rotate, baseX, scaleStep } = geometry()

        slides.forEach((slide, i) => {
            const offset = circularOffset(i)
            const abs = Math.abs(offset)
            let transform = 'translate(-50%, -50%)'
            let opacity = 1
            let zIndex = 10 - abs
            let filter = 'brightness(1)'

            if (abs === 0) {
                transform = `translate(-50%, -50%) translateX(${dragX}px) translateZ(0) rotateY(0deg) scale(1)`
            } else {
                const dir = offset > 0 ? 1 : -1
                const depth = depthPer * abs
                const rotateY = -rotate * dir
                const translateX = dir * (baseX + (abs - 1) * spacing) + dragX
                const scale = 1 - abs * scaleStep
                transform = `translate(-50%, -50%) translateX(${translateX}px) translateZ(${depth}px) rotateY(${rotateY}deg) scale(${scale})`
                filter = `brightness(${1 - abs * 0.12})`
            }

            if (abs > 3) {
                opacity = 0
            } else {
                opacity = 1 - abs * 0.18
            }

            slide.style.transform = transform
            slide.style.opacity = String(opacity)
            slide.style.zIndex = String(abs === 0 ? 20 : zIndex)
            slide.style.filter = filter
            slide.style.pointerEvents = opacity > 0 ? 'auto' : 'none'
            slide.classList.toggle('is-active', abs === 0)
            slide.setAttribute('aria-hidden', abs === 0 ? 'false' : 'true')
        })

        dots.forEach((dot, i) => {
            const active = i === current
            dot.classList.toggle('is-active', active)
            dot.setAttribute('aria-selected', active ? 'true' : 'false')
            dot.tabIndex = active ? 0 : -1
        })

        if (countEl) {
            countEl.textContent = `${String(current + 1).padStart(2, '0')} / ${String(features.length).padStart(2, '0')}`
        }
    }

    prevBtn?.addEventListener('click', () => {
        current = (current - 1 + features.length) % features.length
        render()
    })

    nextBtn?.addEventListener('click', () => {
        current = (current + 1) % features.length
        render()
    })

    function isDragIgnoredTarget(target) {
        return Boolean(target.closest?.('.feature-coverflow__nav, .feature-coverflow__dot'))
    }

    function endDrag() {
        if (!dragging) return

        const step = geometry().baseX
        let steps = Math.round(-dragX / step)
        if (steps === 0 && Math.abs(dragX) >= 50) {
            steps = dragX > 0 ? -1 : 1
        }
        if (steps !== 0) {
            ignoreClick = true
            current = (current + steps + features.length * 8) % features.length
        }

        dragging = false
        stage.classList.remove('is-dragging')
        void stage.offsetWidth
        dragX = 0
        render()
    }

    stage.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || isDragIgnoredTarget(e.target)) return
        dragging = true
        dragStartX = e.clientX
        dragX = 0
        ignoreClick = false
        stage.classList.add('is-dragging')
        stage.setPointerCapture(e.pointerId)
    })

    stage.addEventListener('pointermove', (e) => {
        if (!dragging) return
        dragX = e.clientX - dragStartX
        if (Math.abs(dragX) > 8) ignoreClick = true
        render()
    })

    stage.addEventListener('pointerup', endDrag)
    stage.addEventListener('pointercancel', endDrag)

    root.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault()
            current = (current - 1 + features.length) % features.length
            render()
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            current = (current + 1) % features.length
            render()
        }
    })

    window.addEventListener('resize', render)
    reducedMotion.addEventListener?.('change', render)
    render()
}

initFeaturesCoverflow()

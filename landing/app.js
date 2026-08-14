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

document.addEventListener('DOMContentLoaded', () => {
    restoreMobileScroll()
    initCookieNotice()

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
            icon: 'groups',
            preview: 'workers',
            body: 'Manage Worker profiles, employment information and compliance records from one organised workspace.',
            bullets: [
                'Driving Licence, CPC and Tachograph records',
                'Medical certificates and expiry tracking',
                'Worker contact and employment details',
                'Clear compliance status at a glance',
            ],
        },
        {
            title: 'Vehicles',
            icon: 'local_shipping',
            preview: 'vehicles',
            body: 'Keep vehicles and trailers organised with fleet information, compliance records and operational history.',
            bullets: [
                'Vehicle and trailer profiles',
                'Fleet and registration information',
                'MOT, tax, service and compliance visibility',
                'Vehicle status and history',
            ],
        },
        {
            title: 'Timesheets',
            icon: 'schedule',
            preview: 'timesheets',
            body: 'Give Workers a simple digital timesheet while the Office gets accurate hours ready for review and payroll.',
            bullets: [
                'Automatic or manual hour entry',
                'Daily or weekly overtime rules',
                'Break and weekend settings',
                'Approval and payroll-ready export',
            ],
        },
        {
            title: 'Holidays',
            icon: 'beach_access',
            preview: 'holidays',
            body: 'Manage leave requests, individual entitlements and approvals without relying on paper or messages.',
            bullets: [
                'Paid and unpaid holiday requests',
                'Individual Worker entitlements',
                'Approve or decline requests',
                'Live balances and calendar overview',
            ],
        },
        {
            title: 'Vehicle Checks',
            icon: 'fact_check',
            preview: 'checks',
            body: 'Workers complete structured daily walkaround checks with evidence and clear defect reporting.',
            bullets: [
                'Configurable Vehicle Check templates',
                'OK / Defect / N/A workflow',
                'Photos, notes and signatures',
                'Completed inspection and defect history',
            ],
        },
        {
            title: 'Tyre Checks',
            icon: 'tire_repair',
            preview: 'tyres',
            body: 'Record truck and trailer tyre condition using axle-based inspections and tread-depth measurements.',
            bullets: [
                'Truck and trailer axle layouts',
                'Tread-depth recording',
                'Dirty, Defect and Critical indicators',
                'Tyre inspection history',
            ],
        },
        {
            title: 'Driver Reports',
            icon: 'warning',
            preview: 'reports',
            body: 'Workers can report operational issues directly from mobile so the Office can review and act quickly.',
            bullets: [
                'Vehicle defects and damage',
                'Load and site issues',
                'Notes and supporting evidence',
                'Office review and status tracking',
            ],
        },
        {
            title: 'Documents',
            icon: 'folder_open',
            preview: 'documents',
            body: 'Keep company, Worker and vehicle documents organised with expiry visibility and mobile submissions.',
            bullets: [
                'Driving Licence, CPC, Tachograph and Medical',
                'Company and vehicle documents',
                'POD, CMR, Delivery Notes and receipts',
                'Expiry and document status tracking',
            ],
        },
        {
            title: 'Consumables',
            icon: 'receipt_long',
            preview: 'consumables',
            body: 'Record fuel and other consumables against vehicles to maintain a clear usage and cost history.',
            bullets: [
                'Diesel and AdBlue records',
                'Oils and other consumables',
                'Quantity and optional cost entry',
                'Vehicle-linked usage history',
            ],
        },
        {
            title: 'Offline & Mobile',
            icon: 'smartphone',
            preview: 'mobile',
            body: 'Give Workers mobile-first tools designed for real transport work, including limited-connectivity environments.',
            bullets: [
                'Worker-focused mobile experience',
                'Offline-capable operational workflows',
                'Local data handling',
                'Synchronisation when connection returns',
            ],
        },
        {
            title: 'Fleet & Office Dashboard',
            icon: 'dashboard',
            preview: 'dashboard',
            body: 'Give the Office a central operational view of fleet activity, staff workflows and items requiring attention.',
            bullets: [
                'Workers and fleet overview',
                'Timesheets, holidays and reports',
                'Vehicle and compliance alerts',
                'Daily actions requiring attention',
            ],
        },
        {
            title: 'Security & Compliance',
            icon: 'security',
            preview: 'security',
            body: 'Keep company data separated and controlled with structured permissions and secure record handling.',
            bullets: [
                'Company-isolated data access',
                'Role-based permissions',
                'Audit-friendly records',
                'GDPR-focused data handling',
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

    function chip(label, tone = 'info') {
        return `<span class="fp-chip fp-chip--${tone}">${label}</span>`
    }

    function previewHtml(kind) {
        switch (kind) {
            case 'workers':
                return `<div class="fp fp--workers">
                    <div class="fp-row"><span class="fp-avatar">JP</span><span class="fp-name">J. Patel</span><span class="fp-chips">${chip('Licence', 'ok')}${chip('CPC', 'ok')}</span></div>
                    <div class="fp-row"><span class="fp-avatar">AK</span><span class="fp-name">A. Khan</span><span class="fp-chips">${chip('CPC', 'ok')}${chip('Medical', 'warn')}</span></div>
                    <div class="fp-row"><span class="fp-avatar">MB</span><span class="fp-name">M. Brown</span><span class="fp-chips">${chip('Licence', 'ok')}${chip('Medical', 'ok')}</span></div>
                </div>`
            case 'vehicles':
                return `<div class="fp fp--vehicles">
                    <div class="fp-plate">YS21 DVR</div>
                    <div class="fp-row"><span class="fp-name">Tractor unit · Fleet A</span>${chip('Active', 'ok')}</div>
                    <div class="fp-chips">${chip('MOT', 'ok')}${chip('Tax', 'ok')}${chip('Service due', 'warn')}</div>
                </div>`
            case 'timesheets':
                return `<div class="fp fp--timesheets">
                    <div class="fp-row"><span class="fp-day">Mon</span><span class="fp-name">08:00–17:00</span>${chip('Approved', 'ok')}</div>
                    <div class="fp-row"><span class="fp-day">Tue</span><span class="fp-name">08:00–18:30</span>${chip('OT', 'warn')}</div>
                    <div class="fp-row"><span class="fp-day">Wed</span><span class="fp-name">Total 24h</span>${chip('Total', 'info')}</div>
                </div>`
            case 'holidays':
                return `<div class="fp fp--holidays">
                    <div class="fp-week"><span>M</span><span>T</span><span class="is-on">W</span><span class="is-on">T</span><span class="is-on">F</span><span>S</span><span>S</span></div>
                    <div class="fp-row"><span class="fp-name">12–16 Aug</span>${chip('Approved', 'ok')}</div>
                    <div class="fp-row"><span class="fp-name">Balance 18 days</span>${chip('Pending', 'warn')}</div>
                </div>`
            case 'checks':
                return `<div class="fp fp--checks">
                    <div class="fp-row"><span class="fp-name">Lights</span>${chip('OK', 'ok')}</div>
                    <div class="fp-row"><span class="fp-name">Brakes</span>${chip('Defect', 'defect')}</div>
                    <div class="fp-row"><span class="fp-name">Mirrors</span>${chip('OK', 'ok')}</div>
                    <div class="fp-row"><span class="fp-name">Bodywork</span>${chip('N/A', 'muted')}</div>
                </div>`
            case 'tyres':
                return `<div class="fp fp--tyres">
                    <div class="fp-tyre-grid">
                        <div class="fp-tyre"><span>FL</span><i class="fp-dot fp-dot--ok"></i><b>8.2 mm</b><span class="fp-meter"><span class="fp-meter__fill is-high"></span></span></div>
                        <div class="fp-tyre"><span>FR</span><i class="fp-dot fp-dot--ok"></i><b>7.9 mm</b><span class="fp-meter"><span class="fp-meter__fill is-high"></span></span></div>
                        <div class="fp-tyre"><span>RL</span><i class="fp-dot fp-dot--warn"></i><b>6.4 mm</b><span class="fp-meter"><span class="fp-meter__fill is-mid"></span></span></div>
                        <div class="fp-tyre"><span>RR</span><i class="fp-dot fp-dot--defect"></i><b>5.1 mm</b><span class="fp-meter"><span class="fp-meter__fill is-low"></span></span></div>
                    </div>
                </div>`
            case 'reports':
                return `<div class="fp fp--reports">
                    <div class="fp-row"><span class="fp-name">Vehicle damage</span>${chip('Open', 'defect')}</div>
                    <div class="fp-row"><span class="fp-name">Load issue</span>${chip('Review', 'warn')}</div>
                    <div class="fp-row"><span class="fp-name">Site issue</span>${chip('Closed', 'ok')}</div>
                </div>`
            case 'documents':
                return `<div class="fp fp--documents">
                    <div class="fp-row"><span class="fp-name">CPC</span>${chip('Valid', 'ok')}</div>
                    <div class="fp-row"><span class="fp-name">Tachograph</span>${chip('Expiring', 'warn')}</div>
                    <div class="fp-row"><span class="fp-name">POD</span>${chip('Received', 'info')}</div>
                    <div class="fp-row"><span class="fp-name">Receipt</span>${chip('Filed', 'muted')}</div>
                </div>`
            case 'consumables':
                return `<div class="fp fp--consumables">
                    <div class="fp-usage"><span>Diesel</span><span class="fp-meter"><span class="fp-meter__fill is-high"></span></span><b>72%</b></div>
                    <div class="fp-usage"><span>AdBlue</span><span class="fp-meter"><span class="fp-meter__fill is-mid"></span></span><b>48%</b></div>
                    <div class="fp-usage"><span>Oils</span><span class="fp-meter"><span class="fp-meter__fill is-low"></span></span><b>31%</b></div>
                </div>`
            case 'mobile':
                return `<div class="fp fp--mobile">
                    <div class="fp-phone">
                        <span class="fp-phone__notch"></span>
                        <div class="fp-row">${chip('Offline saved', 'warn')}</div>
                        <div class="fp-row"><span class="fp-name">Pending upload</span><b>3</b></div>
                        <div class="fp-row">${chip('Sync ready', 'ok')}</div>
                    </div>
                </div>`
            case 'dashboard':
                return `<div class="fp fp--dashboard">
                    <div class="fp-kpis">
                        <div class="fp-kpi"><b>24</b><span>Workers</span></div>
                        <div class="fp-kpi"><b>18</b><span>Vehicles</span></div>
                        <div class="fp-kpi fp-kpi--alert"><b>3</b><span>Alerts</span></div>
                        <div class="fp-kpi"><b>6</b><span>Reports</span></div>
                    </div>
                </div>`
            case 'security':
                return `<div class="fp fp--security">
                    <div class="fp-row"><span class="fp-shield material-symbols-outlined">verified_user</span><span class="fp-name">Access control</span>${chip('Secure', 'ok')}</div>
                    <div class="fp-row"><span class="fp-name">Office</span>${chip('Role', 'info')}</div>
                    <div class="fp-row"><span class="fp-name">Worker</span>${chip('Limited', 'muted')}</div>
                    <div class="fp-row"><span class="fp-name">Audit log</span>${chip('2 new', 'warn')}</div>
                </div>`
            default:
                return ''
        }
    }

    features.forEach((feature, i) => {
        const number = String(i + 1).padStart(2, '0')
        const slide = document.createElement('article')
        slide.className = 'feature-coverflow__slide'
        if (i === 0) slide.classList.add('is-active')
        slide.setAttribute('data-title', feature.title)
        slide.setAttribute('aria-label', `Feature ${i + 1} of ${features.length}: ${feature.title}`)
        slide.innerHTML = `
            <div class="feature-coverflow__copy">
                <div class="feature-coverflow__copy-top">
                    <span class="feature-coverflow__number">${number}</span>
                    <span class="feature-coverflow__icon material-symbols-outlined" aria-hidden="true">${feature.icon}</span>
                </div>
                <h3 class="feature-coverflow__title font-headline-sm">${feature.title}</h3>
                <p class="feature-coverflow__body font-body-sm">${feature.body}</p>
                <ul class="feature-coverflow__bullets">
                    ${feature.bullets.map((item) => `<li>${item}</li>`).join('')}
                </ul>
            </div>
            <div class="feature-coverflow__preview" aria-hidden="true">
                ${previewHtml(feature.preview)}
            </div>
        `
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

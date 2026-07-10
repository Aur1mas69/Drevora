document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('main-header')
    const menuToggle = document.getElementById('menu-toggle')
    const mobileMenu = document.getElementById('mobile-menu')
    const menuIcon = document.getElementById('menu-icon')
    const mobileMoreToggle = document.getElementById('mobile-more-toggle')
    const mobileMoreContent = document.getElementById('mobile-more-content')
    const mobileMoreChevron = document.getElementById('mobile-more-chevron')
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link')

    function updateHeaderStyles() {
        if (window.scrollY > 20) {
            header.classList.remove('bg-transparent')
            header.classList.add('bg-surface/80', 'backdrop-blur-md', 'shadow-md')
        } else {
            header.classList.remove('bg-surface/80', 'backdrop-blur-md', 'shadow-md')
            header.classList.add('bg-transparent')
        }
    }

    updateHeaderStyles()

    window.addEventListener('scroll', updateHeaderStyles)

    menuToggle.addEventListener('click', () => {
        const isOpen = mobileMenu.classList.contains('translate-x-0')

        if (isOpen) {
            mobileMenu.classList.remove('translate-x-0')
            mobileMenu.classList.add('translate-x-full')
            menuIcon.classList.remove('fa-xmark')
            menuIcon.classList.add('fa-bars')
            document.body.style.overflow = ''
        } else {
            mobileMenu.classList.remove('translate-x-full')
            mobileMenu.classList.add('translate-x-0')
            menuIcon.classList.remove('fa-bars')
            menuIcon.classList.add('fa-xmark')
            document.body.style.overflow = 'hidden'
        }
    })

    mobileMoreToggle.addEventListener('click', () => {
        const isExpanded = mobileMoreContent.style.maxHeight && mobileMoreContent.style.maxHeight !== '0px'

        if (isExpanded) {
            mobileMoreContent.style.maxHeight = '0px'
            mobileMoreChevron.style.transform = 'rotate(0deg)'
        } else {
            mobileMoreContent.style.maxHeight = mobileMoreContent.scrollHeight + 'px'
            mobileMoreChevron.style.transform = 'rotate(180deg)'
        }
    })

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href')

            if (!href || !href.startsWith('#')) {
                document.body.style.overflow = ''
                mobileMenu.classList.remove('translate-x-0')
                mobileMenu.classList.add('translate-x-full')
                menuIcon.classList.remove('fa-xmark')
                menuIcon.classList.add('fa-bars')
                return
            }

            e.preventDefault()

            document.body.style.overflow = ''
            mobileMenu.classList.remove('translate-x-0')
            mobileMenu.classList.add('translate-x-full')

            menuIcon.classList.remove('fa-xmark')
            menuIcon.classList.add('fa-bars')

            const targetElement = document.querySelector(href)

            if (targetElement) {
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth' })
                }, 200)
            }
        })
    })

    document.getElementById('footer-year').textContent = new Date().getFullYear()
})

// Dashboard slider

document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('dashboard-slider')
    const dots = document.querySelectorAll('#slider-dots .dot')

    let autoplayInterval
    const autoplayDelay = 4000

    function updateDots(activeIndex) {
        dots.forEach((dot, idx) => {
            if (idx === activeIndex) {
                dot.classList.add('w-7', 'bg-primary')
                dot.classList.remove('w-2.5', 'bg-neutral-300')
            } else {
                dot.classList.remove('w-7', 'bg-primary')
                dot.classList.add('w-2.5', 'bg-neutral-300')
            }
        })
    }

    function startAutoplay() {
        autoplayInterval = setInterval(() => {
            const width = slider.clientWidth
            if (width === 0) return

            let currentIdx = Math.round(slider.scrollLeft / width)
            let nextIdx = currentIdx + 1

            if (nextIdx >= dots.length) {
                nextIdx = 0;
            }

            slider.scrollTo({
                left: nextIdx * width,
                behavior: 'smooth'
            });
        }, autoplayDelay)
    }

    function resetAutoplay() {
        clearInterval(autoplayInterval)
        startAutoplay()
    }

    slider.addEventListener('scroll', () => {
        const width = slider.clientWidth
        const activeIndex = Math.round(slider.scrollLeft / width)
        updateDots(activeIndex)
    })

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.getAttribute('data-index'))
            const width = slider.clientWidth

            slider.scrollTo({
                left: index * width,
                behavior: 'smooth'
            })

            resetAutoplay()
        })
    })

    slider.addEventListener('touchstart', () => clearInterval(autoplayInterval), { passive: true })
    slider.addEventListener('touchend', () => startAutoplay(), { passive: true })

    startAutoplay()
})

// Demo request form

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
            showStatus('Something went wrong. Please try again or email Admin@drevora.uk.', 'error')
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = defaultBtnText
        }
    })
})
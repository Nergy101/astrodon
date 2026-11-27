export const DEFAULT_SITE_TITLE = 'Astrodon';
export const DEFAULT_BRAND_NAME = 'Astrodon';
export const NAVBAR_COMPONENT_PLACEHOLDER = '{{component:navbar}}';

export const DEFAULT_NAVBAR_HTML = `<nav class="navbar">
        <div class="navbar-container">
            <a href="/" class="navbar-brand">{{brandLogo}}<span class="navbar-brand-text">{{brandName}}</span></a>
            <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle mobile menu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <ul class="navbar-nav" id="navbar-nav">
                {{navigation}}
            </ul>
            <button class="nav-link theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
                <svg class="sun-icon" viewBox="0 0 24 24" style="display: none;">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
                </svg>
                <svg class="moon-icon" viewBox="0 0 24 24">
                    <path d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"/>
                </svg>
            </button>
        </div>
    </nav>`;

export const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="icon" type="image/x-icon" href="/assets/favicon.ico">
    <link rel="shortcut icon" type="image/x-icon" href="/assets/favicon.ico">
    <link rel="stylesheet" href="/assets/styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- KaTeX for math rendering -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <style>
        .back-to-top {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 48px;
            height: 48px;
            background: #1a1a1a;
            color: #ffffff;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease, background-color 0.3s ease, color 0.3s ease;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .back-to-top:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .back-to-top:active {
            transform: translateY(0);
        }

        .back-to-top:focus {
            outline: 2px solid currentColor;
            outline-offset: 2px;
        }

        .back-to-top.visible {
            opacity: 1;
            visibility: visible;
        }

        .back-to-top svg {
            width: 24px;
            height: 24px;
            stroke: currentColor;
        }

        [data-theme="dark"] .back-to-top {
            background: #e5e5e5;
            color: #1a1a1a;
        }

        [data-theme="dark"] .back-to-top:hover {
            box-shadow: 0 6px 16px rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 768px) {
            .back-to-top {
                bottom: 1.5rem;
                right: 1.5rem;
                width: 44px;
                height: 44px;
            }

            .back-to-top svg {
                width: 20px;
                height: 20px;
            }
        }
    </style>
   </head>
<body>
    {{component:navbar}}

    <div class="page">
        <main class="main">
            <div class="container">
                {{content}}
            </div>
        </main>
    </div>
    <script>
        function initTheme() {
            const theme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', theme);
            updateThemeIcon(theme);
        }

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        }

        function updateThemeIcon(theme) {
            const sunIcon = document.querySelector('.sun-icon');
            const moonIcon = document.querySelector('.moon-icon');
            if (!sunIcon || !moonIcon) return;
            if (theme === 'dark') {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            } else {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            }
        }

        initTheme();
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const navbarNav = document.getElementById('navbar-nav');

        if (mobileMenuToggle && navbarNav) {
            mobileMenuToggle.addEventListener('click', function() {
                const isActive = navbarNav.classList.contains('active');
                if (isActive) {
                    navbarNav.classList.remove('active');
                    mobileMenuToggle.classList.remove('active');
                    document.body.classList.remove('mobile-menu-open');
                    navbarNav.querySelectorAll('.nav-dropdown').forEach(dd => dd.classList.remove('active'));
                } else {
                    navbarNav.classList.add('active');
                    mobileMenuToggle.classList.add('active');
                    document.body.classList.add('mobile-menu-open');
                }
            });

            document.addEventListener('click', function(e) {
                if (!navbarNav.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    navbarNav.classList.remove('active');
                    mobileMenuToggle.classList.remove('active');
                    document.body.classList.remove('mobile-menu-open');
                    navbarNav.querySelectorAll('.nav-dropdown').forEach(dd => dd.classList.remove('active'));
                }
            });

            const dropdownToggles = navbarNav.querySelectorAll('.nav-dropdown-toggle');
            dropdownToggles.forEach(toggle => {
                toggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const dropdown = this.closest('.nav-dropdown');
                    if (dropdown) dropdown.classList.toggle('active');
                });
            });

            const navLinks = navbarNav.querySelectorAll('.nav-link:not(.nav-dropdown-toggle)');
            navLinks.forEach(link => {
                link.addEventListener('click', function() {
                    navbarNav.classList.remove('active');
                    mobileMenuToggle.classList.remove('active');
                    document.body.classList.remove('mobile-menu-open');
                    navbarNav.querySelectorAll('.nav-dropdown').forEach(dd => dd.classList.remove('active'));
                });
            });
        }

        document.addEventListener('DOMContentLoaded', function() {
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
            }

            const codeBlocks = document.querySelectorAll('.code-block-container');
            codeBlocks.forEach((container) => {
                const codeElement = container.querySelector('code');
                const copyButton = container.querySelector('.copy-button');
                if (!codeElement || !copyButton) return;

                copyButton.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(codeElement.textContent || '');
                        copyButton.textContent = 'Copied!';
                        copyButton.classList.add('copied');
                        setTimeout(() => {
                            copyButton.textContent = 'Copy';
                            copyButton.classList.remove('copied');
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy code:', err);
                    }
                });
            });
        });

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('header-anchor') ||
                (e.target.tagName === 'A' && e.target.getAttribute('href') && e.target.getAttribute('href').startsWith('#'))) {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                if (!href) return;
                const targetElement = document.getElementById(href.substring(1));
                if (targetElement) {
                    const navbar = document.querySelector('.navbar');
                    const navbarHeight = navbar ? navbar.offsetHeight + 10 : 90;
                    window.scrollTo({
                        top: targetElement.offsetTop - navbarHeight,
                        behavior: 'smooth'
                    });
                    history.pushState(null, null, href);

                    if (e.target.classList.contains('header-anchor')) {
                        const url = window.location.origin + window.location.pathname + href;
                        navigator.clipboard.writeText(url).then(() => {
                            const originalText = e.target.textContent;
                            e.target.textContent = '✓ Copied!';
                            e.target.style.color = '#10b981';
                            setTimeout(() => {
                                e.target.textContent = originalText;
                                e.target.style.color = '';
                            }, 1500);
                        }).catch(() => {});
                    }
                }
            }
        });

        (function() {
            const button = document.createElement('button');
            button.className = 'back-to-top';
            button.setAttribute('aria-label', 'Back to top');
            button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
            document.body.appendChild(button);

            const scrollThreshold = 300;
            function checkScrollPosition() {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                button.classList.toggle('visible', scrollTop > scrollThreshold);
            }
            function scrollToTop() {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            window.addEventListener('scroll', checkScrollPosition, { passive: true });
            button.addEventListener('click', scrollToTop);
            button.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    scrollToTop();
                }
            });
            checkScrollPosition();
        })();
    </script>
</body>
</html>`;

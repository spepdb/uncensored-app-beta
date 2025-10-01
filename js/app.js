// Global App Functionality
class App {
    constructor() {
        this.setupEventListeners();
        this.checkAuthState();
    }

    setupEventListeners() {
        // Sidebar toggle
        const profileMenuBtn = document.getElementById('profileMenuBtn');
        const closeSidebar = document.getElementById('closeSidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (profileMenuBtn) {
            profileMenuBtn.addEventListener('click', this.toggleSidebar.bind(this));
        }

        if (closeSidebar) {
            closeSidebar.addEventListener('click', this.toggleSidebar.bind(this));
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', this.toggleSidebar.bind(this));
        }

        // Feeds toggle
        const feedsToggle = document.getElementById('feedsToggle');
        if (feedsToggle) {
            feedsToggle.addEventListener('click', this.toggleFeeds.bind(this));
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (sidebar && sidebarOverlay) {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('open');
        }
    }

    toggleFeeds(e) {
        e.preventDefault();
        const feedsToggle = document.getElementById('feedsToggle');
        if (feedsToggle) {
            const currentFeed = feedManager.currentFeed;
            const newFeed = currentFeed === 'for-you' ? 'following' : 'for-you';
            
            feedManager.currentFeed = newFeed;
            feedsToggle.innerHTML = `<span>📰</span> Feeds: ${newFeed === 'for-you' ? 'For You' : 'Following'}`;
            
            // Reload feed
            feedManager.loadInitialPosts();
        }
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to post
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const postInput = document.getElementById('postInput');
            if (postInput && document.activeElement === postInput) {
                feedManager.handlePostCreation();
            }
        }

        // Escape to close sidebar
        if (e.key === 'Escape') {
            this.toggleSidebar();
        }
    }

    checkAuthState() {
        const currentUser = getCurrentUser();
        const protectedPages = ['index.html', 'profile.html', 'dms.html'];
        const currentPage = window.location.pathname;

        // Redirect to login if not authenticated on protected pages
        if (!currentUser && protectedPages.some(page => currentPage.includes(page))) {
            window.location.href = 'login.html';
            return;
        }

        // Update UI based on auth state
        this.updateAuthUI();
    }

    updateAuthUI() {
        const currentUser = getCurrentUser();
        const authDependentElements = document.querySelectorAll('.auth-dependent');
        
        authDependentElements.forEach(element => {
            element.style.display = currentUser ? 'block' : 'none';
        });

        // Update profile images
        const profileImages = document.querySelectorAll('.profile-icon img, .post-avatar');
        profileImages.forEach(img => {
            if (currentUser?.avatar_url && img.id !== 'postUserAvatar') {
                img.src = currentUser.avatar_url;
            }
        });
    }
}

// Initialize app
const app = new App();

// Service worker registration for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Authentication System
const API_BASE_URL = 'http://localhost:3000/api';

class AuthSystem {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.token = this.getToken();
    }

    // ============ API METHODS ============

    async register(userData) {
        try {
            console.log('Registering user:', { 
                displayName: userData.displayName,
                username: userData.username,
                email: userData.email 
            });

            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    displayName: userData.displayName,
                    username: userData.username,
                    email: userData.email,
                    password: userData.password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            console.log('Registration successful:', data.user.username);
            return data;

        } catch (error) {
            console.error('Registration error:', error);
            throw new Error(error.message || 'Registration failed. Please try again.');
        }
    }

    async login(identifier, password) {
        try {
            console.log('Login attempt:', identifier);

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    identifier: identifier, 
                    password: password 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            console.log('Login successful:', data.user.username);
            return data;

        } catch (error) {
            console.error('Login error:', error);
            throw new Error(error.message || 'Login failed. Please check your credentials.');
        }
    }

    // ============ STORAGE METHODS ============

    setCurrentUser(user, token) {
        try {
            localStorage.setItem('social_currentUser', JSON.stringify(user));
            if (token) {
                localStorage.setItem('social_token', token);
            }
            this.currentUser = user;
            this.token = token;
            console.log('User set in storage:', user.username);
        } catch (error) {
            console.error('Error setting current user:', error);
        }
    }

    getCurrentUser() {
        try {
            const user = localStorage.getItem('social_currentUser');
            return user ? JSON.parse(user) : null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }

    getToken() {
        try {
            return localStorage.getItem('social_token');
        } catch (error) {
            console.error('Error getting token:', error);
            return null;
        }
    }

    logout() {
        try {
            localStorage.removeItem('social_currentUser');
            localStorage.removeItem('social_token');
            this.currentUser = null;
            this.token = null;
            console.log('User logged out');
            
            // Redirect to login page
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    // ============ VALIDATION METHODS ============

    validateRegistration(userData) {
        const errors = [];

        if (!userData.displayName?.trim()) {
            errors.push('Display name is required');
        }

        if (!userData.username?.trim()) {
            errors.push('Username is required');
        } else if (userData.username.length < 3) {
            errors.push('Username must be at least 3 characters');
        } else if (!/^[a-zA-Z0-9_]+$/.test(userData.username)) {
            errors.push('Username can only contain letters, numbers, and underscores');
        }

        if (!userData.email?.trim()) {
            errors.push('Email is required');
        } else if (!this.isValidEmail(userData.email)) {
            errors.push('Please enter a valid email address');
        }

        if (!userData.password) {
            errors.push('Password is required');
        } else if (userData.password.length < 6) {
            errors.push('Password must be at least 6 characters');
        }

        if (userData.password !== userData.confirmPassword) {
            errors.push('Passwords do not match');
        }

        if (!userData.privacyPolicy) {
            errors.push('You must agree to the Privacy Policy and Terms of Service');
        }

        return errors;
    }

    validateLogin(identifier, password) {
        const errors = [];

        if (!identifier?.trim()) {
            errors.push('Username or email is required');
        }

        if (!password) {
            errors.push('Password is required');
        }

        return errors;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // ============ UTILITY METHODS ============

    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    async checkAuthStatus() {
        if (!this.isAuthenticated()) {
            return false;
        }

        // You could add a token validation endpoint here later
        return true;
    }
}

// Initialize auth system
const auth = new AuthSystem();

// ============ FORM HANDLERS ============

document.addEventListener('DOMContentLoaded', function() {
    initializeAuthForms();
    checkAuthStatus();
});

function initializeAuthForms() {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');

    // Signup form
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
        
        // Real-time validation
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        
        if (password && confirmPassword) {
            confirmPassword.addEventListener('input', validatePasswordMatch);
        }
    }

    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        displayName: formData.get('displayName')?.trim(),
        username: formData.get('username')?.trim(),
        email: formData.get('email')?.trim(),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
        privacyPolicy: formData.get('privacyPolicy') === 'on'
    };

    const errorElement = document.getElementById('errorMessage');
    const successElement = document.getElementById('successMessage');
    const submitBtn = document.getElementById('signupBtn');

    try {
        // Clear previous messages
        clearMessages();
        
        // Show loading state
        setButtonLoading(submitBtn, true, 'Creating Account...');

        // Validate input
        const errors = auth.validateRegistration(userData);
        if (errors.length > 0) {
            throw new Error(errors[0]);
        }

        // Register user
        const result = await auth.register(userData);
        
        // Auto-login after successful registration
        auth.setCurrentUser(result.user, result.token);
        
        // Show success message
        showSuccess('Account created successfully! Redirecting...');
        
        // Redirect to home page after 2 seconds
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        console.error('Signup error:', error);
        showError(error.message);
        
        // Re-enable button
        setButtonLoading(submitBtn, false, 'Create Account');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const identifier = formData.get('loginIdentifier')?.trim();
    const password = formData.get('loginPassword');

    const errorElement = document.getElementById('errorMessage');
    const submitBtn = document.getElementById('loginBtn');

    try {
        // Clear previous messages
        clearMessages();
        
        // Show loading state
        setButtonLoading(submitBtn, true, 'Signing In...');

        // Validate input
        const errors = auth.validateLogin(identifier, password);
        if (errors.length > 0) {
            throw new Error(errors[0]);
        }

        // Login user
        const result = await auth.login(identifier, password);
        auth.setCurrentUser(result.user, result.token);
        
        // Redirect to home page
        window.location.href = 'index.html';

    } catch (error) {
        console.error('Login error:', error);
        showError(error.message);
        
        // Re-enable button
        setButtonLoading(submitBtn, false, 'Sign In');
    }
}

function validatePasswordMatch() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');

    if (!password || !confirmPassword) return;

    if (password.value !== confirmPassword.value && confirmPassword.value.length > 0) {
        confirmPassword.style.borderColor = '#ff4444';
    } else {
        confirmPassword.style.borderColor = '';
    }
}

function checkAuthStatus() {
    const currentUser = auth.getCurrentUser();
    const currentPage = window.location.pathname;
    
    console.log('Auth check - User:', currentUser?.username, 'Page:', currentPage);

    // If user is logged in and on auth pages, redirect to home
    if (currentUser && (currentPage.includes('login.html') || currentPage.includes('signup.html'))) {
        console.log('Redirecting to home - user already logged in');
        window.location.href = 'index.html';
        return;
    }
    
    // If user is not logged in and on protected pages, redirect to login
    // (We'll define protected pages later as we build them)
    const protectedPages = ['/profile.html', '/dms.html']; // Add more as we create them
    
    if (!currentUser && protectedPages.some(page => currentPage.includes(page))) {
        console.log('Redirecting to login - user not authenticated');
        window.location.href = 'login.html';
        return;
    }
}

// ============ UI HELPER FUNCTIONS ============

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

function showSuccess(message) {
    const successElement = document.getElementById('successMessage');
    if (successElement) {
        successElement.textContent = message;
        successElement.classList.remove('hidden');
    }
}

function clearMessages() {
    const errorElement = document.getElementById('errorMessage');
    const successElement = document.getElementById('successMessage');
    
    if (errorElement) errorElement.classList.add('hidden');
    if (successElement) successElement.classList.add('hidden');
}

function setButtonLoading(button, isLoading, originalText = 'Submit') {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner"></div> Loading...';
    } else {
        button.disabled = false;
        button.textContent = originalText;
    }
}

// ============ GLOBAL FUNCTIONS ============

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.logout();
    }
}

function getCurrentUser() {
    return auth.getCurrentUser();
}

function isUserLoggedIn() {
    return auth.isAuthenticated();
}

// Make functions available globally
window.auth = auth;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.isUserLoggedIn = isUserLoggedIn;

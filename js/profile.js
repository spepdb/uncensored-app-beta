// Profile Management System
class ProfileManager {
    constructor() {
        this.currentProfile = null;
        this.isOwnProfile = false;
        this.currentTab = 'posts';
        this.setupEventListeners();
        this.loadProfile();
    }

    // Load profile based on URL parameter
    async loadProfile() {
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('user') || 'me';
        
        if (username === 'me') {
            await this.loadOwnProfile();
        } else {
            await this.loadUserProfile(username);
        }
    }

    // Load current user's profile
    async loadOwnProfile() {
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        this.isOwnProfile = true;
        document.body.classList.add('own-profile');
        
        // Use current user data
        this.currentProfile = {
            ...currentUser,
            posts_count: 0,
            following_count: 0,
            followers_count: 0,
            created_at: currentUser.created_at || new Date().toISOString()
        };

        this.renderProfile();
        this.loadProfilePosts();
        this.updateProfileActions();
    }

    // Load another user's profile
    async loadUserProfile(username) {
        try {
            // TODO: Replace with actual API call
            // const response = await fetch(`${API_BASE_URL}/users/${username}`);
            // const profile = await response.json();
            
            // For now, use mock data
            const mockProfile = {
                id: 'user-' + username,
                username: username,
                display_name: username.charAt(0).toUpperCase() + username.slice(1),
                avatar_url: 'assets/icons/default-profile.png',
                banner_url: null,
                bio: `This is ${username}'s profile. Bio coming soon!`,
                website: null,
                location: null,
                is_verified: Math.random() > 0.7,
                is_premium: Math.random() > 0.8,
                posts_count: Math.floor(Math.random() * 50),
                following_count: Math.floor(Math.random() * 200),
                followers_count: Math.floor(Math.random() * 150),
                created_at: new Date(Date.now() - Math.random() * 31536000000).toISOString(), // Random date within last year
                is_following: false
            };

            this.currentProfile = mockProfile;
            this.renderProfile();
            this.loadProfilePosts();
            this.updateProfileActions();

        } catch (error) {
            console.error('Error loading profile:', error);
            this.showError('Failed to load profile');
        }
    }

    // Render profile information
    renderProfile() {
        if (!this.currentProfile) return;

        const {
            display_name,
            username,
            avatar_url,
            banner_url,
            bio,
            website,
            location,
            is_verified,
            is_premium,
            posts_count,
            following_count,
            followers_count,
            created_at
        } = this.currentProfile;

        // Update DOM elements
        this.updateElement('profileDisplayName', display_name);
        this.updateElement('profileUsername', `@${username}`);
        this.updateElement('profileHandle', `@${username}`);
        this.updateElement('profileBio', bio || 'No bio yet.');
        this.updateElement('joinDate', this.formatJoinDate(created_at));
        this.updateElement('followerCount', `${followers_count} followers`);
        this.updateElement('postsCount', posts_count);
        this.updateElement('followingCount', following_count);
        this.updateElement('followersCount', followers_count);

        // Update images
        this.updateImage('profileAvatar', avatar_url);
        if (banner_url) {
            this.updateImage('profileBanner', banner_url);
        }

        // Add badges
        this.addBadges(is_verified, is_premium);

        // Update page title
        document.title = `${display_name} (@${username}) - Social Platform`;
    }

    // Load profile posts
    async loadProfilePosts() {
        try {
            // TODO: Replace with actual API call
            // const response = await fetch(`${API_BASE_URL}/users/${this.currentProfile.username}/posts`);
            // const posts = await response.json();
            
            // For now, use mock posts
            const mockPosts = this.generateMockPosts();
            this.renderProfilePosts(mockPosts);

        } catch (error) {
            console.error('Error loading profile posts:', error);
            this.showError('Failed to load posts');
        }
    }

    // Generate mock posts for demo
    generateMockPosts() {
        const posts = [];
        const postCount = this.currentProfile.posts_count || 5;
        
        for (let i = 0; i < postCount; i++) {
            posts.push({
                id: `post-${i}`,
                content: `This is post ${i + 1} from ${this.currentProfile.display_name}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. #demo #post`,
                created_at: new Date(Date.now() - i * 3600000).toISOString(),
                likes_count: Math.floor(Math.random() * 50),
                comments_count: Math.floor(Math.random() * 10),
                user: {
                    display_name: this.currentProfile.display_name,
                    username: this.currentProfile.username,
                    avatar_url: this.currentProfile.avatar_url
                }
            });
        }
        
        return posts;
    }

    // Render profile posts
    renderProfilePosts(posts) {
        const postsContainer = document.getElementById('profilePosts');
        
        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No posts yet</h3>
                    <p>${this.isOwnProfile ? 'Share your first post!' : 'This user hasn\'t posted anything yet.'}</p>
                    ${this.isOwnProfile ? '<button class="btn btn-primary mt-3" onclick="window.location.href=\'index.html\'">Create Post</button>' : ''}
                </div>
            `;
            return;
        }

        postsContainer.innerHTML = posts.map(post => `
            <div class="profile-post" data-post-id="${post.id}">
                <div class="post-content">
                    <p>${this.formatPostContent(post.content)}</p>
                </div>
                <div class="post-stats">
                    <span>❤️ ${post.likes_count}</span>
                    <span>💬 ${post.comments_count}</span>
                    <span class="post-time">${this.formatTimestamp(post.created_at)}</span>
                </div>
            </div>
        `).join('');
    }

    // Update profile action buttons
    updateProfileActions() {
        const followButton = document.getElementById('followButton');
        const messageButton = document.getElementById('messageButton');
        const moreActionsBtn = document.getElementById('moreActionsBtn');

        if (this.isOwnProfile) {
            // Own profile - show edit button
            if (followButton) {
                followButton.textContent = 'Edit Profile';
                followButton.onclick = () => this.openEditModal();
            }
            if (messageButton) messageButton.style.display = 'none';
            if (moreActionsBtn) moreActionsBtn.style.display = 'none';
        } else {
            // Other user's profile
            if (followButton) {
                const isFollowing = this.currentProfile.is_following;
                followButton.textContent = isFollowing ? 'Following' : 'Follow';
                followButton.classList.toggle('following', isFollowing);
                followButton.onclick = () => this.toggleFollow();
            }
            
            if (messageButton) {
                messageButton.onclick = () => this.startConversation();
            }
            
            if (moreActionsBtn) {
                moreActionsBtn.onclick = (e) => this.toggleProfileDropdown(e);
            }
        }
    }

    // Toggle follow/unfollow
    async toggleFollow() {
        const followButton = document.getElementById('followButton');
        const isCurrentlyFollowing = this.currentProfile.is_following;
        
        try {
            // TODO: Implement actual API call
            // const response = await fetch(`${API_BASE_URL}/users/${this.currentProfile.username}/follow`, {
            //     method: isCurrentlyFollowing ? 'DELETE' : 'POST'
            // });
            
            // Update UI immediately
            this.currentProfile.is_following = !isCurrentlyFollowing;
            this.currentProfile.followers_count += isCurrentlyFollowing ? -1 : 1;
            
            this.updateProfileActions();
            this.updateElement('followersCount', `${this.currentProfile.followers_count} followers`);
            
            this.showSuccess(isCurrentlyFollowing ? 'Unfollowed' : 'Followed!');
            
        } catch (error) {
            console.error('Error toggling follow:', error);
            this.showError('Failed to update follow status');
        }
    }

    // Start conversation with user
    startConversation() {
        // TODO: Implement DM functionality
        this.showMessage('Direct messaging coming soon!');
    }

    // Open edit profile modal
    openEditModal() {
        const modal = document.getElementById('editProfileModal');
        const form = document.getElementById('editProfileForm');
        
        // Populate form with current data
        document.getElementById('editDisplayName').value = this.currentProfile.display_name || '';
        document.getElementById('editBio').value = this.currentProfile.bio || '';
        document.getElementById('editWebsite').value = this.currentProfile.website || '';
        document.getElementById('editLocation').value = this.currentProfile.location || '';
        
        this.updateBioCharCounter();
        modal.classList.add('open');
    }

    // Close edit profile modal
    closeEditModal() {
        const modal = document.getElementById('editProfileModal');
        modal.classList.remove('open');
    }

    // Save profile changes
    async saveProfile() {
        const formData = {
            display_name: document.getElementById('editDisplayName').value.trim(),
            bio: document.getElementById('editBio').value.trim(),
            website: document.getElementById('editWebsite').value.trim(),
            location: document.getElementById('editLocation').value.trim()
        };

        try {
            // TODO: Implement actual API call
            // const response = await fetch(`${API_BASE_URL}/users/profile`, {
            //     method: 'PUT',
            //     headers: auth.getAuthHeaders(),
            //     body: JSON.stringify(formData)
            // });
            
            // Update local profile data
            Object.assign(this.currentProfile, formData);
            
            // Update UI
            this.renderProfile();
            this.closeEditModal();
            
            // Update global user data
            const currentUser = getCurrentUser();
            if (currentUser) {
                Object.assign(currentUser, formData);
                auth.setCurrentUser(currentUser);
            }
            
            this.showSuccess('Profile updated!');
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showError('Failed to update profile');
        }
    }

    // Tab management
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}Tab`);
        });
        
        // Load tab content if needed
        if (tabName === 'posts') {
            this.loadProfilePosts();
        }
    }

    // Event listeners
    setupEventListeners() {
        // Tab clicks
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Edit modal
        document.getElementById('closeEditModal')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancelEditBtn')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('saveProfileBtn')?.addEventListener('click', () => this.saveProfile());

        // Bio character counter
        document.getElementById('editBio')?.addEventListener('input', () => this.updateBioCharCounter());

        // Profile dropdown
        document.getElementById('profileMenuBtn')?.addEventListener('click', (e) => this.toggleProfileDropdown(e));
        
        // Dropdown actions
        document.getElementById('shareProfileBtn')?.addEventListener('click', () => this.shareProfile());
        document.getElementById('reportProfileBtn')?.addEventListener('click', () => this.reportProfile());
        document.getElementById('blockUserBtn')?.addEventListener('click', () => this.blockUser());

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-menu') && !e.target.closest('#profileMenuBtn')) {
                this.closeProfileDropdown();
            }
        });

        // Stats clicks
        document.querySelectorAll('.stat').forEach(stat => {
            stat.addEventListener('click', () => {
                const statType = stat.querySelector('span').textContent.toLowerCase();
                this.showStatsModal(statType);
            });
        });
    }

    // Profile dropdown
    toggleProfileDropdown(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('profileDropdown');
        dropdown.classList.toggle('open');
    }

    closeProfileDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        dropdown.classList.remove('open');
    }

    // Profile actions
    shareProfile() {
        const profileUrl = window.location.href;
        if (navigator.share) {
            navigator.share({
                title: `${this.currentProfile.display_name} on Social Platform`,
                url: profileUrl
            });
        } else {
            navigator.clipboard.writeText(profileUrl).then(() => {
                this.showSuccess('Profile link copied!');
            });
        }
        this.closeProfileDropdown();
    }

    reportProfile() {
        if (confirm(`Report @${this.currentProfile.username} for violating community guidelines?`)) {
            // TODO: Implement reporting
            this.showMessage('Report submitted. Thank you for helping keep the community safe.');
        }
        this.closeProfileDropdown();
    }

    blockUser() {
        if (confirm(`Block @${this.currentProfile.username}? You won't see their posts and they won't be able to follow or message you.`)) {
            // TODO: Implement blocking
            this.showSuccess('User blocked');
            window.history.back();
        }
        this.closeProfileDropdown();
    }

    // Utility methods
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) element.textContent = content;
    }

    updateImage(id, src) {
        const element = document.getElementById(id);
        if (element && src) {
            element.src = src;
        }
    }

    addBadges(isVerified, isPremium) {
        const displayNameElement = document.getElementById('profileDisplayName');
        
        if (isVerified) {
            const verifiedBadge = document.createElement('span');
            verifiedBadge.className = 'verified-badge';
            verifiedBadge.textContent = '✓';
            verifiedBadge.title = 'Verified account';
            displayNameElement.appendChild(verifiedBadge);
        }
        
        if (isPremium) {
            const premiumBadge = document.createElement('span');
            premiumBadge.className = 'premium-badge';
            premiumBadge.textContent = 'PREMIUM';
            premiumBadge.title = 'Premium member';
            displayNameElement.appendChild(premiumBadge);
        }
    }

    formatJoinDate(dateString) {
        const date = new Date(dateString);
        return `Joined ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }

    formatTimestamp(timestamp) {
        // Reuse the same function from feed.js
        if (!timestamp) return 'just now';
        
        const postDate = new Date(timestamp);
        const now = new Date();
        const diffMs = now - postDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        
        return postDate.toLocaleDateString();
    }

    formatPostContent(content) {
        // Basic formatting similar to feed.js
        if (!content) return '';
        
        let formatted = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        
        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        formatted = formatted.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
        formatted = formatted.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
        
        return formatted;
    }

    updateBioCharCounter() {
        const bioInput = document.getElementById('editBio');
        const charCounter = document.getElementById('bioCharCounter');
        
        if (bioInput && charCounter) {
            const length = bioInput.value.length;
            charCounter.textContent = `${length}/160`;
            
            if (length > 160) {
                charCounter.classList.add('error');
            } else if (length > 140) {
                charCounter.classList.add('warning');
            } else {
                charCounter.classList.remove('error', 'warning');
            }
        }
    }

    showStatsModal(statType) {
        // TODO: Implement stats modal
        this.showMessage(`${statType.charAt(0).toUpperCase() + statType.slice(1)} list coming soon!`);
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `status-message status-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            max-width: 90%;
        `;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }
}

// Initialize profile manager
const profileManager = new ProfileManager();

// Feed Management System
class FeedManager {
    constructor() {
        this.posts = [];
        this.isLoading = false;
        this.hasMore = true;
        this.currentPage = 1;
        this.currentFeed = 'for-you';
    }

    // Initialize feed
    async initialize() {
        await this.loadInitialPosts();
        this.setupEventListeners();
        this.updateUI();
    }

    // Load initial posts
    async loadInitialPosts() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            const response = await fetch(`${API_BASE_URL}/posts`);
            
            if (!response.ok) {
                throw new Error('Failed to load posts');
            }
            
            const posts = await response.json();
            this.posts = posts || [];
            
            if (this.posts.length === 0) {
                this.showEmptyState();
            } else {
                this.renderPosts(this.posts);
            }
            
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showError('Failed to load posts. Please try again.');
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    // Create new post
    async createPost(content) {
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
            this.showError('Please log in to create posts');
            return null;
        }

        if (!content || content.trim().length === 0) {
            this.showError('Post content cannot be empty');
            return null;
        }

        if (content.length > 280) {
            this.showError('Post must be 280 characters or less');
            return null;
        }

        try {
            this.setPostButtonLoading(true);
            
            const response = await fetch(`${API_BASE_URL}/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: currentUser.id,
                    content: content.trim()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create post');
            }

            const newPost = await response.json();
            
            // Add to local array and render
            this.posts.unshift(newPost);
            this.prependPost(newPost);
            
            // Clear input
            document.getElementById('postInput').value = '';
            this.updateCharCounter();
            
            this.showSuccess('Post created!');
            return newPost;

        } catch (error) {
            console.error('Error creating post:', error);
            this.showError(error.message || 'Failed to create post');
            return null;
        } finally {
            this.setPostButtonLoading(false);
        }
    }

    // Add post to beginning of feed
    prependPost(post) {
        const feedContainer = document.getElementById('feedContainer');
        const loadingIndicator = document.getElementById('feedLoading');
        const emptyState = document.querySelector('.empty-state');
        
        if (emptyState) {
            emptyState.remove();
        }
        
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        const postElement = this.createPostElement(post);
        feedContainer.insertBefore(postElement, feedContainer.firstChild);
    }

    // Render posts to feed
    renderPosts(posts) {
        const feedContainer = document.getElementById('feedContainer');
        const loadingIndicator = document.getElementById('feedLoading');
        
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // Clear existing posts except post creation
        const existingPosts = feedContainer.querySelectorAll('.post');
        existingPosts.forEach(post => post.remove());
        
        if (posts.length === 0) {
            this.showEmptyState();
            return;
        }
        
        posts.forEach(post => {
            const postElement = this.createPostElement(post);
            feedContainer.appendChild(postElement);
        });
    }

    // Create post HTML element
    createPostElement(post) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post';
        postDiv.dataset.postId = post.id;
        
        const user = post.user || {};
        const displayName = user.display_name || 'Unknown User';
        const username = user.username || 'unknown';
        const avatar = user.avatar_url || 'assets/icons/default-profile.png';
        const timestamp = this.formatTimestamp(post.created_at);

        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${avatar}" alt="${displayName}" class="post-user-avatar"
                     onerror="this.src='assets/icons/default-profile.png'">
                <div class="post-user-info">
                    <div class="post-display-name">${this.escapeHtml(displayName)}</div>
                    <div class="post-username">@${username}</div>
                </div>
                <div class="post-time">${timestamp}</div>
            </div>
            <div class="post-content">
                <p>${this.formatPostContent(post.content)}</p>
            </div>
            <div class="post-actions">
                <button class="post-action like-btn" onclick="feedManager.handleLike('${post.id}')">
                    ❤️ <span class="like-count">0</span>
                </button>
                <button class="post-action comment-btn" onclick="feedManager.handleComment('${post.id}')">
                    💬 <span class="comment-count">0</span>
                </button>
                <button class="post-action repost-btn" onclick="feedManager.handleRepost('${post.id}')">
                    🔄
                </button>
                <button class="post-action save-btn" onclick="feedManager.handleSave('${post.id}')">
                    🔖
                </button>
            </div>
        `;

        return postDiv;
    }

    // Format post content (basic formatting)
    formatPostContent(content) {
        if (!content) return '';
        
        let formatted = this.escapeHtml(content);
        
        // Convert URLs to links
        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        
        // Convert hashtags
        formatted = formatted.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
        
        // Convert mentions
        formatted = formatted.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
        
        return formatted;
    }

    // Format timestamp
    formatTimestamp(timestamp) {
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

    // Post interaction handlers
    async handleLike(postId) {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            this.showError('Please log in to like posts');
            return;
        }

        try {
            const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
            const isLiked = likeBtn.classList.contains('liked');
            
            if (isLiked) {
                await this.unlikePost(postId);
            } else {
                await this.likePost(postId);
            }
        } catch (error) {
            console.error('Error handling like:', error);
            this.showError('Failed to like post');
        }
    }

    async likePost(postId) {
        // TODO: Implement API call
        const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
        likeBtn.classList.add('liked');
        likeBtn.innerHTML = '❤️ <span class="like-count">1</span>';
        
        this.showSuccess('Post liked!');
    }

    async unlikePost(postId) {
        // TODO: Implement API call
        const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
        likeBtn.classList.remove('liked');
        likeBtn.innerHTML = '❤️ <span class="like-count">0</span>';
        
        this.showSuccess('Post unliked!');
    }

    handleComment(postId) {
        // TODO: Implement comment functionality
        this.showMessage('Comment feature coming soon!');
    }

    handleRepost(postId) {
        // TODO: Implement repost functionality
        this.showMessage('Repost feature coming soon!');
    }

    handleSave(postId) {
        // TODO: Implement save functionality
        this.showMessage('Save feature coming soon!');
    }

    // Event listeners
    setupEventListeners() {
        const postInput = document.getElementById('postInput');
        const postButton = document.getElementById('postButton');
        const charCounter = document.getElementById('charCounter');

        if (postInput && postButton) {
            postInput.addEventListener('input', (e) => {
                this.updateCharCounter();
                this.updatePostButton();
            });

            postButton.addEventListener('click', () => {
                this.handlePostCreation();
            });

            postInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    this.handlePostCreation();
                }
            });
        }

        // Refresh on pull-to-refresh
        this.setupPullToRefresh();
    }

    // Update character counter
    updateCharCounter() {
        const postInput = document.getElementById('postInput');
        const charCounter = document.getElementById('charCounter');
        
        if (!postInput || !charCounter) return;

        const length = postInput.value.length;
        charCounter.textContent = `${length}/280`;
        
        if (length > 280) {
            charCounter.classList.add('error');
        } else if (length > 250) {
            charCounter.classList.add('warning');
        } else {
            charCounter.classList.remove('error', 'warning');
        }
    }

    // Update post button state
    updatePostButton() {
        const postInput = document.getElementById('postInput');
        const postButton = document.getElementById('postButton');
        
        if (!postInput || !postButton) return;

        const length = postInput.value.trim().length;
        postButton.disabled = length === 0 || length > 280;
    }

    // Handle post creation
    async handlePostCreation() {
        const postInput = document.getElementById('postInput');
        if (!postInput) return;

        const content = postInput.value.trim();
        if (!content) return;

        await this.createPost(content);
    }

    // Set post button loading state
    setPostButtonLoading(isLoading) {
        const postButton = document.getElementById('postButton');
        if (!postButton) return;
        
        if (isLoading) {
            postButton.disabled = true;
            postButton.innerHTML = '<div class="loading-spinner"></div> Posting...';
        } else {
            this.updatePostButton();
            postButton.textContent = 'Post';
        }
    }

    // Pull to refresh
    setupPullToRefresh() {
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });

        document.addEventListener('touchmove', (e) => {
            if (window.scrollY === 0 && e.touches[0].clientY - touchStartY > 100) {
                this.loadInitialPosts();
            }
        });
    }

    // UI helpers
    showLoading() {
        const feedContainer = document.getElementById('feedContainer');
        if (feedContainer) {
            feedContainer.innerHTML = '<div class="loading-indicator" id="feedLoading">Loading posts...</div>';
        }
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('feedLoading');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    showEmptyState() {
        const feedContainer = document.getElementById('feedContainer');
        if (feedContainer) {
            feedContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No posts yet</h3>
                    <p>Be the first to post something!</p>
                    <button class="btn btn-primary mt-3" onclick="document.getElementById('postInput').focus()">
                        Create First Post
                    </button>
                </div>
            `;
        }
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type = 'info') {
        // Remove existing message
        const existingMsg = document.querySelector('.status-message');
        if (existingMsg) existingMsg.remove();

        // Create new message
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

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    // Utility functions
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Update UI based on auth state
    updateUI() {
        const currentUser = getCurrentUser();
        const postCreation = document.getElementById('postCreation');
        const headerProfileImg = document.getElementById('headerProfileImg');
        const postUserAvatar = document.getElementById('postUserAvatar');

        if (postCreation) {
            postCreation.style.display = currentUser ? 'block' : 'none';
        }

        if (headerProfileImg && currentUser?.avatar_url) {
            headerProfileImg.src = currentUser.avatar_url;
        }

        if (postUserAvatar && currentUser?.avatar_url) {
            postUserAvatar.src = currentUser.avatar_url;
        }
    }
}

// Initialize feed manager
const feedManager = new FeedManager();

// Global refresh function
function refreshFeed() {
    feedManager.loadInitialPosts();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('feedContainer')) {
        feedManager.initialize();
    }
});

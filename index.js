/**
 * @name Indian discord larp hahah
 * @version 1.5.0
 * @description it just works yay woohoo
 * @author fixed by me happyflyingotter
 */

module.exports = class discordlarpusername {
    start() {
        this.targetUserId = "(put targets id here)";
        this.targetUsername = "(their username here)";
        
        // Add CSS to hide typing indicators
        this.addTypingCSS();
        
        this.startTimeout = setTimeout(async () => {
            try {
                await this.init();
                BdApi.showToast("Larp Started!", { type: "success" });
            } catch (err) {
                console.error("Plugin start error:", err);
            }
        }, 3000);
    }

    addTypingCSS() {
        const css = `
            div[class*="typingDots_"] {
                display: none !important;
            }
            /* Hide new messages divider */
            div[class*="divider"] {
                display: none !important;
            }
        `;
        BdApi.DOM.addStyle("larp-hide-typing", css);
    }

    async init() {
        // Get user stores
        const UserStore = BdApi.Webpack.getModule(m => m?.getUser && m?.getCurrentUser);
        if (!UserStore) {
            setTimeout(() => this.init(), 2000);
            return;
        }

        this.currentUser = UserStore.getCurrentUser();
        if (!this.currentUser) {
            setTimeout(() => this.init(), 1000);
            return;
        }

        // Fetch target user data
        this.targetUser = await UserStore.getUser(this.targetUserId);
        if (!this.targetUser) {
            console.error("Failed to fetch target user");
            return;
        }

        console.log("Current user:", this.currentUser);
        console.log("Target user:", this.targetUser);

        // Patch the user data
        this.patchData();
        
        // Start DOM replacement
        this.startReplacing();
    }

    patchData() {
        const userModule = BdApi.Webpack.getModule(m => m.getCurrentUser, { searchExports: true });
        if (!userModule) return;
        
        const targetAvatar = this.targetUser?.avatar;
        const targetId = this.targetUserId;
        const targetUsername = this.targetUsername;
        const originalUserId = this.currentUser.id;
        const originalUsername = this.currentUser.username;
        
        BdApi.Patcher.after("discordlarpusername", userModule, "getCurrentUser", (_, __, user) => {
            if (!user) return user;

            user.username = targetUsername;
            user.id = targetId;
            if (targetAvatar) {
                user.avatar = targetAvatar;
            }
            
            console.log("Patched user object:", user);
            return user;
        });
        
        // Patch UserStore.getUser to return original username for typing
        const UserStore = BdApi.Webpack.getModule(m => m?.getUser && m?.getCurrentUser);
        if (UserStore) {
            BdApi.Patcher.after("discordlarpusername-typing", UserStore, "getUser", (_, args, ret) => {
                // If someone is requesting the target user ID (which is now "us"), return with original username
                if (ret && ret.id === targetId) {
                    // Check if this is being called from typing context by checking call stack
                    const stack = new Error().stack;
                    if (stack && stack.includes('typing')) {
                        ret.username = originalUsername;
                    }
                }
                return ret;
            });
        }
    }

    startReplacing() {
        // Initial replacement
        this.replaceAvatars(document.body);
        this.addEditProfileButton();
        this.removeDuplicateMessages();

        // Watch for changes
        this.observer = new MutationObserver(() => {
            this.replaceAvatars(document.body);
            this.addEditProfileButton();
            this.removeDuplicateMessages();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    removeDuplicateMessages() {
        // Get all messages
        const allMessages = Array.from(document.querySelectorAll('[id^="message-content-"]'));
        
        // Group by content
        const contentMap = new Map();
        allMessages.forEach(msg => {
            const content = msg.textContent.trim();
            if (!contentMap.has(content)) {
                contentMap.set(content, []);
            }
            contentMap.get(content).push(msg);
        });
        
        // For each content group with duplicates
        contentMap.forEach(messages => {
            if (messages.length > 1) {
                // Find the one with isSending and one without
                const withSending = messages.filter(m => m.className.includes('isSending'));
                const withoutSending = messages.filter(m => !m.className.includes('isSending'));
                
                // If we have both types, hide the most recent withoutSending
                if (withSending.length > 0 && withoutSending.length > 0) {
                    const toHide = withoutSending[withoutSending.length - 1];
                    const li = toHide.closest('li');
                    if (li) li.style.display = 'none';
                    
                    // Remove isSending from the most recent withSending
                    withSending[withSending.length - 1].classList.remove('isSending_c19a55');
                }
            }
        });
    }

    replaceAvatars(root) {
        if (!this.currentUser || !this.targetUser) return;

        // Replace all avatar images (img tags)
        root.querySelectorAll('img').forEach(img => {
            if (img.src.includes('/avatars/' + this.currentUser.id + '/')) {
                const newSrc = img.src.replace(
                    '/avatars/' + this.currentUser.id + '/',
                    '/avatars/' + this.targetUserId + '/'
                );
                
                if (this.targetUser.avatar) {
                    const parts = newSrc.split('/');
                    const filename = parts[parts.length - 1];
                    const extension = filename.includes('.gif') ? '.gif' : '.png';
                    parts[parts.length - 1] = this.targetUser.avatar + extension;
                    img.src = parts.join('/');
                    console.log("Replaced avatar img:", img.src);
                } else {
                    img.src = newSrc;
                }
            }
        });

        // Replace background-image avatars
        root.querySelectorAll('[style*="background-image"]').forEach(el => {
            const style = el.style.backgroundImage;
            if (style.includes('/avatars/' + this.currentUser.id + '/')) {
                let newStyle = style.replace(
                    '/avatars/' + this.currentUser.id + '/',
                    '/avatars/' + this.targetUserId + '/'
                );
                
                if (this.targetUser.avatar) {
                    // Extract URL and replace avatar hash
                    const urlMatch = newStyle.match(/url\("?([^"]+)"?\)/);
                    if (urlMatch) {
                        const url = urlMatch[1];
                        const parts = url.split('/');
                        const filename = parts[parts.length - 1];
                        const extension = filename.includes('.gif') ? '.gif' : '.png';
                        parts[parts.length - 1] = this.targetUser.avatar + extension;
                        newStyle = 'url("' + parts.join('/') + '")';
                    }
                }
                
                el.style.backgroundImage = newStyle;
                console.log("Replaced avatar background:", newStyle);
            }
        });
    }

    addEditProfileButton() {
        if (!this.targetUser) return;

        // Find profile modals/popouts showing the spoofed username
        document.querySelectorAll('[class*="userProfile"], [class*="profileModal"], [class*="userPopout"], [class*="profile"], [class*="accountProfileCard"]').forEach(profile => {
            // Check if this profile shows the target username
            if (!profile.textContent.includes(this.targetUsername)) return;
            
            // Skip if button already exists
            if (profile.querySelector('.larp-edit-profile-btn')) return;

            // Hide mute and add friend buttons (the circular buttons at top right)
            const actionButtons = profile.querySelectorAll('[class*="bannerButton"]');
            actionButtons.forEach(btn => {
                btn.style.display = 'none';
            });

            // Check if this is the small popout (has the shop/more buttons but no Edit Profile)
            const hasShopButton = Array.from(profile.querySelectorAll('button')).some(btn => 
                btn.querySelector('svg') && btn.getAttribute('aria-label') !== 'Edit Profile'
            );
            
            if (hasShopButton) {
                // This is the popout view - add Edit Profile button
                const buttonContainer = profile.querySelector('[class*="profileButtons"]');
                if (buttonContainer && !buttonContainer.querySelector('.larp-edit-profile-btn')) {
                    const editBtn = document.createElement('button');
                    editBtn.setAttribute('data-mana-component', 'button');
                    editBtn.setAttribute('role', 'button');
                    editBtn.setAttribute('type', 'button');
                    editBtn.className = 'button_a22cb0 sm_a22cb0 primary_a22cb0 hasText_a22cb0 larp-edit-profile-btn';
                    editBtn.innerHTML = '<div class="buttonChildrenWrapper_a22cb0"><div class="buttonChildren_a22cb0"><svg class="icon_a22cb0" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z" class=""></path></svg><span class="lineClamp1__4bd52 text-sm/medium_cf4812" data-text-variant="text-sm/medium">Edit Profile</span></div></div>';
                    editBtn.style.backgroundColor = 'rgba(88, 101, 242, 1)';
                    
                    editBtn.addEventListener('click', () => {
                        try {
                            // Just open user settings without closing anything
                            const settingsButton = document.querySelector('[aria-label="User Settings"]');
                            if (settingsButton) {
                                settingsButton.click();
                            }
                        } catch (err) {
                            console.error("Failed to open settings:", err);
                        }
                    });
                    
                    // Insert at the beginning of the container
                    buttonContainer.insertBefore(editBtn, buttonContainer.firstChild);
                    console.log("Added Edit Profile button in popout");
                }
            }

            // Find the message input container by looking for the placeholder text
            const placeholders = profile.querySelectorAll('[class*="placeholder"]');
            let foundMessageInput = false;
            
            placeholders.forEach(placeholder => {
                if (placeholder.textContent.includes('Message @' + this.targetUsername)) {
                    // Find the scrollableContainer parent
                    let container = placeholder.closest('[class*="scrollableContainer"]');
                    if (container && !container.parentElement.querySelector('.larp-edit-profile-btn')) {
                        // Hide the message input container
                        container.style.display = 'none';
                        
                        // Create Edit Profile button
                        const editBtn = document.createElement('button');
                        editBtn.setAttribute('data-mana-component', 'button');
                        editBtn.setAttribute('role', 'button');
                        editBtn.setAttribute('type', 'button');
                        editBtn.setAttribute('aria-expanded', 'false');
                        editBtn.className = 'button_a22cb0 sm_a22cb0 primary_a22cb0 hasText_a22cb0 fullWidth_a22cb0 larp-edit-profile-btn';
                        editBtn.innerHTML = '<div class="buttonChildrenWrapper_a22cb0"><div class="buttonChildren_a22cb0"><svg class="icon_a22cb0" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z" class=""></path></svg><span class="lineClamp1__4bd52 text-sm/medium_cf4812" data-text-variant="text-sm/medium">Edit Profile</span></div></div>';
                        editBtn.style.backgroundColor = 'rgba(88, 101, 242, 1)';
                        
                        editBtn.addEventListener('click', () => {
                            try {
                                // Just open user settings without closing anything
                                const settingsButton = document.querySelector('[aria-label="User Settings"]');
                                if (settingsButton) {
                                    settingsButton.click();
                                }
                            } catch (err) {
                                console.error("Failed to open settings:", err);
                            }
                        });
                        
                        // Insert button after the hidden container
                        container.parentElement.insertBefore(editBtn, container.nextSibling);
                        foundMessageInput = true;
                        console.log("Added Edit Profile button, hidden message input");
                    }
                }
            });
        });
    }

    stop() {
        clearTimeout(this.startTimeout);
        BdApi.Patcher.unpatchAll("discordlarpusername");
        BdApi.Patcher.unpatchAll("discordlarpusername-typing");
        BdApi.DOM.removeStyle("larp-hide-typing");
        if (this.observer) this.observer.disconnect();
    }
};

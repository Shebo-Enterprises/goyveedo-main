import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase Configuration ---
// REPLACE WITH YOUR ACTUAL FIREBASE PROJECT CONFIG
const firebaseConfig = {
apiKey: "AIzaSyASp0AE4kv-I1B5ewdFdFYx35-8qgseUKA",
authDomain: "goyveedo.firebaseapp.com",
projectId: "goyveedo",
storageBucket: "goyveedo.firebasestorage.app",
messagingSenderId: "295699400071",
appId: "1:295699400071:web:df84c11b9e3dd7c2913f22"
};

// If you are using a custom initial authentication token for development/testing,
// you can place it here. Otherwise, leave it as null.
const initialAuthToken = null; // e.g., "YOUR_CUSTOM_AUTH_TOKEN_HERE"

// Your app ID for Firestore document paths (often same as firebaseConfig.appId)
// Make sure this matches the `appId` in your Firebase Security Rules.
const appId = firebaseConfig.appId;
// --- End Firebase Configuration ---

// Initialize Firebase
let firebaseApp;
let db;
let auth;
let currentUser = null; // Stores current authenticated user object
let currentUserId = null; // Stores current user's UID
let currentUserRole = 'guest'; // Default role
let isAuthReady = false; // Flag to ensure Firebase auth is initialized

// UI Elements
const loginModal = $('#login-modal');
const signupModal = $('#signup-modal');
const videoModal = $('#video-modal');
const userRoleModal = $('#user-role-modal');
const loginForm = $('#login-form');
const signupForm = $('#signup-form');
const videoForm = $('#video-form');
const userRoleForm = $('#user-role-form');
const homeSection = $('#home-section');
const videoPlayerSection = $('#video-player-section');
const adminSection = $('#admin-section');
const videoGrid = $('#video-grid');
const channelVideoContainer = $('#channel-video-container'); // New container for channel groups
const featuredVideoGrid = $('#featured-video-grid');
const videoChannelDropdown = $('#video-channel-dropdown'); // Admin modal dropdown
const videoIframePlayer = $('#video-iframe-player'); // Changed to iframe
const playerVideoTitle = $('#player-video-title');
const playerVideoDescription = $('#player-video-description');
const playerLockOverlay = $('#player-lock-overlay'); // Lock overlay for the player
const videoSearchInput = $('#video-search-input'); // Search bar
const channelViewSection = $('#channel-view-section'); // Dedicated channel view
const channelViewTitle = $('#channel-view-title');
const channelViewGrid = $('#channel-view-grid');
const backToHomeFromChannelBtn = $('#back-to-home-from-channel-btn');
const playerVideoUploader = $('#player-video-uploader');
const adminVideoList = $('#admin-video-list');
const adminUserList = $('#admin-user-list');
const userInfoDisplay = $('#user-info-display');
const currentUserEmailSpan = $('#current-user-email');
const currentUserRoleSpan = $('#current-user-role');
const adminLink = $('#admin-link');
const loginBtn = $('#login-btn');
const signupBtn = $('#signup-btn');
const logoutBtn = $('#logout-btn');
const messageBox = $('#message-box');
const loaderOverlay = $('#loader-overlay');
const noVideosMessage = $('#no-videos-message');
const noFeaturedVideosMessage = $('#no-featured-videos-message');
const noSearchResultsMessage = $('#no-search-results-message');
const noChannelVideosMessage = $('#no-channel-videos-message');
const noAdminVideosMessage = $('#no-admin-videos-message');
const noAdminUsersMessage = $('#no-admin-users-message');

let allVideos = [];

// --- Utility Functions ---

/**
 * Checks if the current user can watch videos
 * @returns {boolean} True if user can watch videos
 */
function canWatchVideos() {
    return currentUserRole === 'viewer' || currentUserRole === 'admin';
}

/**
 * Displays a message box with a given message and type (success/error).
 * @param {string} message - The message to display.
 * @param {string} type - 'success' or 'error'.
 */
function showMessage(message, type = 'success') {
    messageBox.text(message);
    messageBox.removeClass('success error').addClass(type);
    messageBox.addClass('show');
    setTimeout(() => {
        messageBox.removeClass('show');
    }, 3000); // Hide after 3 seconds
}

/**
 * Shows or hides the loading overlay.
 * @param {boolean} isLoading - True to show, false to hide.
 */
function showLoading(isLoading) {
    if (isLoading) {
        loaderOverlay.addClass('active');
    } else {
        loaderOverlay.removeClass('active');
    }
}

/**
 * Shows a specific content section and hides others.
 * @param {string} sectionId - The ID of the section to show (e.g., 'home-section').
 */
function showSection(sectionId) {
    homeSection.hide();
    videoPlayerSection.hide();
    adminSection.hide();
    channelViewSection.hide();
    $('#' + sectionId).show();
}

/**
 * Updates the header UI based on the current user's authentication status and role.
 * @param {object | null} user - The Firebase User object or null if logged out.
 */
function updateHeader(user) {
    if (user) {
        userInfoDisplay.show();
        currentUserEmailSpan.text(user.email);
        currentUserRoleSpan.text(currentUserRole);
        loginBtn.hide();
        signupBtn.hide();
        logoutBtn.show();
        if (currentUserRole === 'admin') {
            adminLink.show();
        } else {
            adminLink.hide();
        }
    } else {
        userInfoDisplay.hide();
        loginBtn.show();
        signupBtn.show();
        logoutBtn.hide();
        adminLink.hide();
    }
}

/**
 * Applies the selected theme (dark/light) to the application.
 * @param {string} theme - The theme to apply ('dark' or 'light').
 */
function applyTheme(theme) {
    const body = $('body');
    const themeIcon = $('#theme-icon');
    const dropdowns = $('.ui.dropdown');

    if (theme === 'light') {
        body.addClass('light-mode');
        themeIcon.removeClass('moon').addClass('sun');
        // Semantic UI dropdowns need to be re-initialized to pick up new theme styles
        dropdowns.removeClass('inverted');
        localStorage.setItem('theme', 'light');
    } else { // 'dark'
        body.removeClass('light-mode');
        themeIcon.removeClass('sun').addClass('moon');
        dropdowns.addClass('inverted');
        localStorage.setItem('theme', 'dark');
    }
    // Re-initialize dropdowns that might have been affected
    $('.ui.selection.dropdown').dropdown();
    $('#user-new-role').dropdown();
}

/**
 * Gets the thumbnail URL for a video.
 * If a custom thumbnail exists, it's used.
 * Otherwise, it generates one from the Google Drive video URL.
 * @param {object} video - The video object from Firestore.
 * @returns {string} The URL for the thumbnail image.
 */
function getVideoThumbnail(video) {
    if (video.thumbnailUrl) {
        return video.thumbnailUrl;
    }
    if (video.videoUrl && video.videoUrl.includes('drive.google.com')) {
        // Extracts file ID from URLs like: https://drive.google.com/file/d/FILE_ID/preview
        const match = video.videoUrl.match(/d\/(.*?)\//);
        if (match && match[1]) {
            const fileId = match[1];
            return `https://drive.google.com/thumbnail?id=${fileId}`;
        }
    }
    // Fallback if no custom URL and not a valid GDrive URL
    return 'https://placehold.co/600x400/333/fff?text=No+Preview';
}


// --- Firebase Initialization and Authentication ---

// Initialize Firebase services
try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
} catch (error) {
    console.error("Error initializing Firebase:", error);
    showMessage("Failed to initialize application. Please check console for details.", "error");
}

// Listen for authentication state changes
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        currentUserId = user.uid;
        const userParentDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}`);
        const userProfileDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/data`);

        try {
            const userParentDoc = await getDoc(userParentDocRef);

            // Check if user has been soft-deleted by an admin
            if (userParentDoc.exists() && userParentDoc.data().status === 'deleted') {
                showMessage("Your account has been disabled. Please contact an administrator.", "error");
                await signOut(auth); // Force logout
                return; // Stop further processing
            }

            const userProfileDoc = await getDoc(userProfileDocRef);
            if (userProfileDoc.exists()) {
                currentUserRole = userProfileDoc.data().role || 'user';
            } else {
                // If profile doesn't exist, create both parent and profile docs
                await setDoc(userParentDocRef, { status: 'active', createdAt: new Date() });
                await setDoc(userProfileDocRef, { email: user.email, role: 'user' });
                currentUserRole = 'user';
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            currentUserRole = 'user'; // Default to user role on error
        }
    } else {
        currentUserRole = 'guest';
        currentUserId = null;
    }
    isAuthReady = true;
    updateHeader(user);
    // Always load videos; rendering logic will handle locked/unlocked state
    showSection('home-section');
    loadVideos();
});

// Sign in with custom token if available, otherwise prompt for login
if (initialAuthToken) {
    signInWithCustomToken(auth, initialAuthToken)
        .then(() => {
            console.log("Signed in with custom token.");
        })
        .catch((error) => {
            console.error("Error signing in with custom token:", error);
            showMessage("Automatic login failed. Please login manually.", "error");
        });
} else {
    console.log("No initial auth token found. User needs to login or sign up.");
    // If no initial token, and anonymous users are disallowed, the user will see login/signup options.
}

// --- Authentication Functions ---

/**
 * Registers a new user with email and password.
 * @param {string} email
 * @param {string} password
 */
async function registerUser(email, password) {
    showLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;
        // Create both the parent user document and the profile subcollection document
        const userParentDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
        const userProfileDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);

        await setDoc(userParentDocRef, { status: 'active', createdAt: new Date() });
        await setDoc(userProfileDocRef, { email: email, role: 'user' }); // Default role is 'user'

        showMessage("Registration successful! You are now logged in.");
        signupModal.modal('hide');
    } catch (error) {
        console.error("Sign up error:", error);
        showMessage(`Sign up failed: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Logs in an existing user with email and password.
 * @param {string} email
 * @param {string} password
 */
async function loginUser(email, password) {
    showLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage("Login successful!");
        loginModal.modal('hide');
    } catch (error) {
        console.error("Login error:", error);
        showMessage(`Login failed: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Logs out the current user.
 */
async function logoutUser() {
    showLoading(true);
    try {
        await signOut(auth);
        showMessage("Logged out successfully.");
        showSection('home-section'); // Go back to home
        // onAuthStateChanged will handle re-rendering for the guest view
    } catch (error) {
        console.error("Logout error:", error);
        showMessage(`Logout failed: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

// --- Video Management (Firestore) ---

/**
 * Fetches and displays all videos. This runs for all users (guests included).
 */
async function loadVideos() {
    showLoading(true);
    try {
        const videosCollectionRef = collection(db, `artifacts/${appId}/public/data/videos`);
        // Using onSnapshot for real-time updates
        onSnapshot(videosCollectionRef, (snapshot) => {
            const videos = [];
            snapshot.forEach(doc => {
                videos.push({ id: doc.id, ...doc.data() });
            });
            allVideos = videos;
            videoSearchInput.val(''); // Reset search on new data load
            renderFeaturedVideos(videos.filter(video => video.featured));
            renderChannelGroups(videos); // New function to render videos grouped by channel
            populateAdminChannelDropdown(videos); // Populate the admin modal dropdown
            showLoading(false);
        }, (error) => {
            console.error("Error fetching videos:", error);
            showMessage("Failed to load videos.", "error");
            showLoading(false);
        });
    } catch (error) {
        console.error("Error setting up video listener:", error);
        showMessage("Failed to load videos.", "error");
        showLoading(false);
    }
}

/**
 * Renders featured video cards.
 * @param {Array<object>} videos - Array of featured video objects.
 */
function renderFeaturedVideos(videos) {
    featuredVideoGrid.empty();
    if (videos.length === 0) {
        noFeaturedVideosMessage.show();
    } else if (!canWatchVideos() && videos.length > 0) {
        noFeaturedVideosMessage.text("Please log in to view featured videos.").show();
    } else {
        noFeaturedVideosMessage.hide();
        videos.forEach(video => {
            const thumbnailUrl = getVideoThumbnail(video);
            const lockOverlay = !canWatchVideos() ? '<div class="video-lock-overlay"><i class="lock icon"></i></div>' : '';
            const featuredBadge = '<div class="featured-badge">Featured</div>';
            const card = `
                <div class="card" data-id="${video.id}">
                    <div class="image">
                        <img src="${thumbnailUrl}" alt="${video.title}">
                        ${lockOverlay}
                        ${featuredBadge}
                    </div>
                    <div class="content">
                        <div class="header">${video.title}</div>
                        <div class="description">${video.description || 'No description available.'}</div>
                        <div class="meta">Channel: ${video.channel || 'Unknown'}</div>
                    </div>
                </div>
            `;
            featuredVideoGrid.append(card);
        });

        // Attach click listener to each featured video card
        featuredVideoGrid.find('.card').on('click', function() {
            const videoId = $(this).data('id');
            if (canWatchVideos()) {
                playVideo(videoId);
            } else {
                showMessage("You do not have permission to view this video. Please log in.", "error");
            }
        });
    }
}

/**
 * Renders videos grouped by channel in the main library view.
 * @param {Array<object>} videosToRender - The array of videos to display.
 */
function renderChannelGroups(videosToRender) {
    channelVideoContainer.empty();
    noVideosMessage.hide();
    noSearchResultsMessage.hide();

    if (videosToRender.length === 0) {
        if (videoSearchInput.val()) {
            noSearchResultsMessage.show();
        } else {
            noVideosMessage.show();
        }
        return;
    }

    // Group videos by channel
    const channels = videosToRender.reduce((acc, video) => {
        const channelName = video.channel || 'Uncategorized';
        if (!acc[channelName]) {
            acc[channelName] = [];
        }
        acc[channelName].push(video);
        return acc;
    }, {});

    // Sort channels alphabetically
    const sortedChannelNames = Object.keys(channels).sort();

    sortedChannelNames.forEach(channelName => {
        const channelVideos = channels[channelName];
        const channelHeader = `
            <h3 class="ui header" style="color: var(--text-color); cursor: pointer; margin-top: 25px;" data-channel="${channelName}">
                ${channelName} <i class="angle right icon"></i>
            </h3>
        `;
        const channelGrid = $('<div class="ui three stackable cards"></div>');

        channelVideos.forEach(video => {
            const thumbnailUrl = getVideoThumbnail(video);
            const lockOverlay = !canWatchVideos() ? '<div class="video-lock-overlay"><i class="lock icon"></i></div>' : '';
            const card = `
                <div class="card" data-id="${video.id}">
                    <div class="image">
                        <img src="${thumbnailUrl}" alt="${video.title}">
                        ${lockOverlay}
                    </div>
                    <div class="content">
                        <div class="header">${video.title}</div>
                        <div class="description">${video.description || 'No description available.'}</div>
                    </div>
                </div>
            `;
            channelGrid.append(card);
        });

        channelVideoContainer.append(channelHeader).append(channelGrid);
    });

    // Attach click listeners
    channelVideoContainer.find('.card').on('click', function() {
        const videoId = $(this).data('id');
        playVideo(videoId); // playVideo will handle permissions
    });

    channelVideoContainer.find('h3.header').on('click', function() {
        const channelName = $(this).data('channel');
        renderSingleChannelView(channelName);
    });
}

/**
 * Renders the dedicated view for a single channel.
 * @param {string} channelName - The name of the channel to display.
 */
function renderSingleChannelView(channelName) {
    const channelVideos = allVideos.filter(video => (video.channel || 'Uncategorized') === channelName);
    channelViewTitle.text(channelName);
    channelViewGrid.empty();
    noChannelVideosMessage.hide();

    if (channelVideos.length === 0) {
        noChannelVideosMessage.show();
    } else {
        channelVideos.forEach(video => {
            const thumbnailUrl = getVideoThumbnail(video);
            const lockOverlay = !canWatchVideos() ? '<div class="video-lock-overlay"><i class="lock icon"></i></div>' : '';
            const card = `
                <div class="card" data-id="${video.id}">
                    <div class="image">
                        <img src="${thumbnailUrl}" alt="${video.title}">
                        ${lockOverlay}
                    </div>
                    <div class="content">
                        <div class="header">${video.title}</div>
                        <div class="description">${video.description || 'No description available.'}</div>
                    </div>
                </div>
            `;
            channelViewGrid.append(card);
        });
    }

    channelViewGrid.find('.card').on('click', function() {
        const videoId = $(this).data('id');
        playVideo(videoId);
    });

    showSection('channel-view-section');
}

/**
 * Populates the admin modal's channel dropdown.
 * @param {Array<object>} videos - Array of all video objects.
 */
function populateAdminChannelDropdown(videos) {
    const channels = [...new Set(videos.map(video => video.channel).filter(Boolean))];
    const menu = videoChannelDropdown.find('.menu');
    menu.empty();
    channels.forEach(channel => {
        menu.append(`<div class="item" data-value="${channel}">${channel}</div>`);
    });
    // Re-initialize the dropdown to register new items and settings
    videoChannelDropdown.dropdown({
        allowAdditions: true,
        hideAdditions: false
    });
}

/**
 * Plays a selected video using its Google Drive embed link.
 * @param {string} videoId - The ID of the video to play.
 */
async function playVideo(videoId) {
    // Permission check happens first
    if (!canWatchVideos()) {
        showMessage("You do not have permission to view this video. Please log in or contact an administrator.", "error");
        playerLockOverlay.show();
        videoIframePlayer.attr('src', '');
        playerVideoTitle.text("Access Denied");
        playerVideoDescription.text("You must have 'viewer' or 'admin' permissions to watch videos.");
        playerVideoUploader.text('System');
        showSection('video-player-section');
        return;
    }

    showLoading(true);
    playerLockOverlay.hide(); // Ensure lock is hidden for authorized users
    try {
        const videoDocRef = doc(db, `artifacts/${appId}/public/data/videos`, videoId);
        const videoDoc = await getDoc(videoDocRef);

        if (videoDoc.exists()) {
            const videoData = videoDoc.data();
            videoIframePlayer.attr('src', videoData.videoUrl);
            playerVideoTitle.text(videoData.title);
            playerVideoDescription.text(videoData.description || 'No description available.');
            playerVideoUploader.text(videoData.uploaderEmail || 'Unknown');
            showSection('video-player-section');
        } else {
            showMessage("Video not found.", "error");
        }
    } catch (error) {
        console.error("Error playing video:", error);
        showMessage(`Failed to play video: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Handles adding or updating a video.
 * @param {Event} event - The form submission event.
 */
async function handleVideoFormSubmit(event) {
    event.preventDefault();
    if (!currentUser || currentUserRole !== 'admin') {
        showMessage("You are not authorized to perform this action.", "error");
        return;
    }

    showLoading(true);
    const videoId = $('#video-id-input').val();
    const title = $('#video-title').val();
    const description = $('#video-description').val();
    const thumbnail = $('#video-thumbnail').val();
    const videoUrl = $('#video-url').val(); // Google Drive embed link
    const channel = videoChannelDropdown.dropdown('get value');
    const featured = $('#video-featured').is(':checked');

    try {
        if (videoId) { // Editing existing video
            await updateDoc(doc(db, `artifacts/${appId}/public/data/videos`, videoId), {
                title,
                description,
                thumbnailUrl: thumbnail,
                videoUrl, // Update video URL
                channel,
                featured,
                lastUpdated: new Date()
            });
            showMessage("Video updated successfully!");
        } else { // Adding new video
            // Auto-generate ID for new video document
            const newVideoRef = doc(collection(db, `artifacts/${appId}/public/data/videos`));
            await setDoc(newVideoRef, {
                title,
                description,
                thumbnailUrl: thumbnail, // Store empty string if no URL is provided
                videoUrl, // Store Google Drive embed link
                channel,
                featured,
                uploaderEmail: currentUser.email,
                uploadDate: new Date()
            });
            showMessage("Video added successfully!");
        }
        videoModal.modal('hide');
        loadAdminVideos(); // Refresh admin video list
    } catch (error) {
        console.error("Error adding/updating video:", error);
        showMessage(`Failed to save video: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Loads and displays videos in the admin dashboard table.
 */
async function loadAdminVideos() {
    if (!isAuthReady || currentUserRole !== 'admin') {
        adminVideoList.empty();
        noAdminVideosMessage.text("You are not authorized to view this section.").show();
        return;
    }

    showLoading(true);
    try {
        const videosCollectionRef = collection(db, `artifacts/${appId}/public/data/videos`);
        onSnapshot(videosCollectionRef, (snapshot) => {
            const videos = [];
            snapshot.forEach(doc => {
                videos.push({ id: doc.id, ...doc.data() });
            });
            renderAdminVideos(videos);
            showLoading(false);
        }, (error) => {
            console.error("Error fetching admin videos:", error);
            showMessage("Failed to load admin videos.", "error");
            showLoading(false);
        });
    } catch (error) {
        console.error("Error setting up admin video listener:", error);
        showMessage("Failed to load admin videos.", "error");
        showLoading(false);
    }
}

/**
 * Renders the video list in the admin dashboard.
 * @param {Array<object>} videos - Array of video objects.
 */
function renderAdminVideos(videos) {
    adminVideoList.empty();
    if (videos.length === 0) {
        noAdminVideosMessage.show();
    } else {
        noAdminVideosMessage.hide();
        videos.forEach(video => {
            const featuredIcon = video.featured ? '<i class="star icon" style="color: #ff6b35;"></i>' : '<i class="star outline icon"></i>';
            const row = `
                <tr>
                    <td>${video.title}</td>
                    <td>${video.channel || 'N/A'}</td>
                    <td>${featuredIcon}</td>
                    <td>${video.uploaderEmail || 'N/A'}</td>
                    <td>
                        <button class="ui mini primary button edit-video-btn" data-id="${video.id}">Edit</button>
                        <button class="ui mini negative button delete-video-btn" data-id="${video.id}">Delete</button>
                    </td>
                </tr>
            `;
            adminVideoList.append(row);
        });

        // Attach event listeners for edit/delete buttons
        adminVideoList.find('.edit-video-btn').on('click', async function() {
            const videoId = $(this).data('id');
            await populateVideoModal(videoId);
            videoModal.modal('show');
        });

        adminVideoList.find('.delete-video-btn').on('click', function() {
            const videoId = $(this).data('id');
            showConfirmModal("Delete Video", "Are you sure you want to delete this video? This action cannot be undone.", () => deleteVideo(videoId));
        });
    }
}

/**
 * Populates the video modal for editing an existing video.
 * @param {string} videoId - The ID of the video to edit.
 */
async function populateVideoModal(videoId) {
    showLoading(true);
    try {
        const videoDocRef = doc(db, `artifacts/${appId}/public/data/videos`, videoId);
        const videoDoc = await getDoc(videoDocRef);

        if (videoDoc.exists()) {
            const videoData = videoDoc.data();
            $('#video-modal-header').text('Edit Video');
            $('#video-form-submit-btn').text('Update Video');
            $('#video-id-input').val(videoId);
            $('#video-title').val(videoData.title);
            $('#video-description').val(videoData.description);
            $('#video-thumbnail').val(videoData.thumbnailUrl);
            $('#video-url').val(videoData.videoUrl); // Populate Google Drive URL
            videoChannelDropdown.dropdown('set selected', videoData.channel || '');
            $('#video-featured').prop('checked', videoData.featured || false);
        } else {
            showMessage("Video not found for editing.", "error");
        }
    } catch (error) {
        console.error("Error populating video modal:", error);
        showMessage("Failed to load video for editing.", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Deletes a video from Firestore. (No storage deletion since it's external)
 * @param {string} videoId - The ID of the video to delete.
 */
async function deleteVideo(videoId) {
    showLoading(true);
    try {
        // Delete video document from Firestore
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/videos`, videoId));
        showMessage("Video deleted successfully!");
    } catch (error) {
        console.error("Error deleting video:", error);
        showMessage(`Failed to delete video: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

// --- User Management (Firestore) ---

/**
 * Loads and displays all users in the admin dashboard table.
 */
async function loadAdminUsers() {
    if (!isAuthReady || currentUserRole !== 'admin') {
        adminUserList.empty();
        noAdminUsersMessage.text("You are not authorized to view this section.").show();
        return;
    }

    showLoading(true);
    try {
        // Query the parent user documents, filtering for active (not deleted) users
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);
        const q = query(usersCollectionRef, where("status", "==", "active"));

        const usersSnapshot = await getDocs(q);
        const users = [];

        // Use Promise.all for more efficient fetching of all profile data
        const profilePromises = usersSnapshot.docs.map(userDoc => {
            const profileDocRef = doc(db, `artifacts/${appId}/users/${userDoc.id}/profile/data`);
            return getDoc(profileDocRef);
        });

        const profileDocs = await Promise.all(profilePromises);

        profileDocs.forEach((profileDoc, index) => {
            if (profileDoc.exists()) {
                const parentDoc = usersSnapshot.docs[index];
                users.push({ id: parentDoc.id, ...profileDoc.data() });
            }
        });
        renderAdminUsers(users);
    } catch (error) {
        console.error("Error fetching admin users:", error);
        showMessage("Failed to load admin users.", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Renders the user list in the admin dashboard.
 * @param {Array<object>} users - Array of user objects.
 */
function renderAdminUsers(users) {
    adminUserList.empty();
    if (users.length === 0) {
        noAdminUsersMessage.show();
    } else {
        noAdminUsersMessage.hide();
        users.forEach(user => {
            const row = `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.email}</td>
                    <td>${user.role}</td>
                    <td>
                        <button class="ui mini primary button change-role-btn" data-id="${user.id}" data-email="${user.email}" data-role="${user.role}">Change Role</button>
                        <button class="ui mini negative button delete-user-btn" data-id="${user.id}">Delete</button>
                    </td>
                </tr>
            `;
            adminUserList.append(row);
        });

        // Attach event listeners for change role/delete user buttons
        adminUserList.find('.change-role-btn').on('click', function() {
            const userId = $(this).data('id');
            const userEmail = $(this).data('email');
            const userRole = $(this).data('role');
            $('#user-id-input').val(userId);
            $('#user-email-display').val(userEmail);
            $('#user-new-role').val(userRole);
            userRoleModal.modal('show');
        });

        adminUserList.find('.delete-user-btn').on('click', function() {
            const userId = $(this).data('id');
            showConfirmModal(
                "Disable User Account",
                "Are you sure you want to disable this user's account? They will no longer be able to log in.",
                () => deleteUser(userId)
            );
        });
    }
}

/**
 * Updates a user's role.
 * @param {Event} event - The form submission event.
 */
async function handleUserRoleFormSubmit(event) {
    event.preventDefault();
    if (!currentUser || currentUserRole !== 'admin') {
        showMessage("You are not authorized to perform this action.", "error");
        return;
    }

    showLoading(true);
    const userIdToUpdate = $('#user-id-input').val();
    const newRole = $('#user-new-role').val();

    try {
        const userDocRef = doc(db, `artifacts/${appId}/users/${userIdToUpdate}/profile/data`);
        await updateDoc(userDocRef, { role: newRole });
        showMessage("User role updated successfully!");
        userRoleModal.modal('hide');
        loadAdminUsers(); // Refresh user list
    } catch (error) {
        console.error("Error updating user role:", error);
        showMessage(`Failed to update user role: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Deletes a user from Firestore.
 * Note: This is a "soft delete". It updates the user's status to 'deleted'
 * so they can no longer log in, but their data is preserved.
 * @param {string} userId - The ID of the user to delete.
 */
async function deleteUser(userId) {
    showLoading(true);
    try {
        // This is a "soft delete". We update the parent document's status to 'deleted'.
        // The user's Auth record and profile data remain, but they cannot log in.
        const userParentDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
        await updateDoc(userParentDocRef, { status: 'deleted' });
        showMessage("User account has been disabled.");
        loadAdminUsers(); // Refresh user list
    } catch (error) {
        console.error("Error deleting user:", error);
        showMessage(`Failed to delete user: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Displays a custom confirmation modal.
 * @param {string} title - The title of the confirmation.
 * @param {string} message - The confirmation message.
 * @param {Function} onConfirm - Callback function to execute on confirmation.
 */
function showConfirmModal(title, message, onConfirm) {
    $('body').append(`
        <div class="ui basic modal" id="confirm-modal">
            <div class="ui icon header">
                <i class="exclamation triangle icon"></i>
                ${title}
            </div>
            <div class="content" style="text-align: center; color: var(--text-color);">
                <p>${message}</p>
            </div>
            <div class="actions">
                <div class="ui red basic cancel inverted button">
                    <i class="remove icon"></i>
                    No
                </div>
                <div class="ui green ok inverted button">
                    <i class="checkmark icon"></i>
                    Yes
                </div>
            </div>
        </div>
    `);
    $('#confirm-modal').modal({
        closable: false,
        onDeny: function() {
            $('#confirm-modal').remove();
        },
        onApprove: function() {
            onConfirm();
            $('#confirm-modal').remove();
        }
    }).modal('show');
}

// --- Event Listeners ---

$(document).ready(function() {
    // Initialize Semantic UI tabs and dropdowns
    $('.menu .item').tab();
    $('.ui.dropdown').dropdown();
    videoChannelDropdown.dropdown({
        allowAdditions: true,
        hideAdditions: false
    });

    // Search bar listener
    videoSearchInput.on('keyup', function() {
        const searchTerm = $(this).val().toLowerCase();
        const filteredVideos = allVideos.filter(video =>
            video.title.toLowerCase().includes(searchTerm) ||
            (video.description && video.description.toLowerCase().includes(searchTerm)) ||
            (video.channel && video.channel.toLowerCase().includes(searchTerm))
        );
        renderChannelGroups(filteredVideos);
    });

    // Theme toggle
    $('#theme-toggle-btn').on('click', function() {
        // Toggle theme based on current state
        const isCurrentlyLight = $('body').hasClass('light-mode');
        applyTheme(isCurrentlyLight ? 'dark' : 'light');
    });

    // Apply saved theme on page load
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark
    applyTheme(savedTheme);

    // Navigation links
    $('#home-link').on('click', () => {
        showSection('home-section');
        videoSearchInput.val(''); // Clear search
        renderChannelGroups(allVideos); // Re-render all videos without reloading
    });
    $('#back-to-home-btn').on('click', () => {
        showSection('home-section');
        videoIframePlayer.attr('src', ''); // Stop video playback
    });
    $('#back-to-home-from-channel-btn').on('click', () => {
        showSection('home-section');
        // No need to re-render, main view is already there
    });
    $('#admin-link').on('click', () => {
        if (currentUserRole === 'admin') {
            showSection('admin-section');
            loadAdminVideos();
            loadAdminUsers();
        } else {
            showMessage("You do not have administrative privileges.", "error");
        }
    });

    // Auth buttons
    $('#login-btn').on('click', () => loginModal.modal('show'));
    $('#signup-btn').on('click', () => signupModal.modal('show'));
    $('#logout-btn').on('click', logoutUser);

    // Auth forms
    loginForm.on('submit', function(event) {
        event.preventDefault(); // Prevent default form submission
        const email = $(this).find('input[name="email"]').val();
        const password = $(this).find('input[name="password"]').val();
        loginUser(email, password);
    });

    signupForm.on('submit', function(event) {
        event.preventDefault(); // Prevent default form submission
        const email = $(this).find('input[name="email"]').val();
        const password = $(this).find('input[name="password"]').val();
        registerUser(email, password);
    });

    // Admin video management
    $('#add-video-btn').on('click', () => {
        $('#video-modal-header').text('Add New Video');
        $('#video-form-submit-btn').text('Add Video');
        $('#video-id-input').val('');
        videoForm[0].reset(); // Clear form fields
        $('#video-featured').prop('checked', false); // Ensure checkbox is unchecked
        videoChannelDropdown.dropdown('clear');
        videoModal.modal('show');
    });

    videoForm.on('submit', handleVideoFormSubmit);

    // Admin user management
    userRoleForm.on('submit', handleUserRoleFormSubmit);

    // Initial content load after document is ready and auth is checked
    loginModal.modal();
    signupModal.modal();
    videoModal.modal();
    userRoleModal.modal();
});

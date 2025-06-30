import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Import Firebase config
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

//Firebase functions available globally
window.firebase = {
   db,
   collection,
   addDoc,
   getDocs,
   doc,
   updateDoc,
   deleteDoc,
   query,
   orderBy
};

// Trigger initial load after Firebase is ready
window.dispatchEvent(new Event('firebase-ready'));

// Global variables
let posts = [];
let currentEditId = null;
let currentTab = 'posts';

// Initialize app - wait for Firebase to be ready
function initApp() {
   loadPosts();
   setupEventListeners();
   updateStats();
}

document.addEventListener('DOMContentLoaded', function () {
   if (window.firebase) {
      initApp();
   } else {
      window.addEventListener('firebase-ready', initApp);
   }
});

function setupEventListeners() {
   const searchInput = document.getElementById('searchInput');
   if (searchInput) {
      searchInput.addEventListener('input', handleSearch);
   }

   const postForm = document.getElementById('postForm');
   if (postForm) {
      postForm.addEventListener('submit', handleFormSubmit);
   }
}

window.switchTab = function (tabName) {
   document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
   const activeBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
   if (activeBtn) {
      activeBtn.classList.add('active');
   }

   document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
   const activeSection = document.getElementById(tabName + '-section');
   if (activeSection) {
      activeSection.classList.add('active');
   }

   currentTab = tabName;

   if (tabName === 'analytics') {
      updateAnalytics();
   }
}

window.cancelForm = function () {
   const form = document.getElementById('postForm');
   if (form) {
      form.reset();
   }

   const formTitle = document.getElementById('formTitle');
   if (formTitle) {
      formTitle.textContent = 'create_new_post.js';
   }

   const submitText = document.getElementById('submitText');
   if (submitText) {
      submitText.textContent = 'Publish Post';
   }

   currentEditId = null;
}

// Firebase Storage Functions
async function savePost(postData) {
   try {
      const { db, collection, addDoc, doc, updateDoc } = window.firebase;

      if (!postData.id) {
         // Creating new post 
         const { id, ...dataToSave } = postData;
         const docRef = await addDoc(collection(db, 'posts'), dataToSave);
         console.log('New post created with ID:', docRef.id);
         return { ...dataToSave, id: docRef.id };
      } else {
         // Updating existing post 
         const { id, ...dataToUpdate } = postData;
         const postRef = doc(db, 'posts', id);
         await updateDoc(postRef, dataToUpdate);
         console.log('Post updated successfully:', id);
         return postData;
      }
   } catch (error) {
      console.error('Error saving post:', error);
      console.error('Post data:', postData);
      throw error;
   }
}

async function loadPosts() {
   try {
      const { db, collection, getDocs, query, orderBy } = window.firebase;
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      posts = [];
      querySnapshot.forEach((doc) => {
         posts.push({ id: doc.id, ...doc.data() });
      });

      renderPosts();
      updateStats();
      showNotification('Posts loaded from Firebase!', 'success');
   } catch (error) {
      console.error('Error loading posts:', error);
      showNotification('Error loading posts from Firebase', 'error');
      posts = [];
   }
}

async function deletePost(postId) {
   try {
      const { db, doc, deleteDoc } = window.firebase;
      await deleteDoc(doc(db, 'posts', postId));
   } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
   }
}

// CRUD Operations
async function handleFormSubmit(e) {
   e.preventDefault();

   const submitBtn = document.getElementById('submitBtn');
   const submitText = document.getElementById('submitText');
   const submitLoading = document.getElementById('submitLoading');

   if (!submitBtn || !submitText || !submitLoading) {
      console.error('Form elements not found');
      return;
   }

   // Show loading state
   submitText.style.display = 'none';
   submitLoading.style.display = 'inline-block';
   submitBtn.disabled = true;

   try {
      const titleEl = document.getElementById('title');
      const authorEl = document.getElementById('author');
      const contentEl = document.getElementById('content');
      const tagsEl = document.getElementById('tags');

      if (!titleEl || !authorEl || !contentEl) {
         throw new Error('Required form fields not found');
      }

      const postData = {
         title: titleEl.value.trim(),
         author: authorEl.value.trim(),
         content: contentEl.value.trim(),
         tags: tagsEl ? tagsEl.value.trim().split(',').map(tag => tag.trim()).filter(tag => tag) : [],
         createdAt: currentEditId ? posts.find(p => p.id === currentEditId)?.createdAt : new Date().toISOString(),
         updatedAt: new Date().toISOString()
      };

      if (currentEditId) {
         postData.id = currentEditId;
      }

      await savePost(postData);

      showNotification(currentEditId ? 'Post updated successfully!' : 'Post published successfully!', 'success');

      // Reload posts and switch to posts tab
      await loadPosts();
      switchTab('posts');
      cancelForm();

   } catch (error) {
      console.error('Error saving post:', error);
      showNotification('Error saving post. Please try again.', 'error');
   } finally {
      // Reset button state
      submitText.style.display = 'inline';
      submitLoading.style.display = 'none';
      submitBtn.disabled = false;
   }
}

function editPost(postId) {
   const post = posts.find(p => p.id === postId);
   if (!post) return;

   currentEditId = postId;

   // Fill form with post data
   const titleEl = document.getElementById('title');
   const authorEl = document.getElementById('author');
   const contentEl = document.getElementById('content');
   const tagsEl = document.getElementById('tags');
   const formTitle = document.getElementById('formTitle');
   const submitText = document.getElementById('submitText');

   if (titleEl) titleEl.value = post.title;
   if (authorEl) authorEl.value = post.author;
   if (contentEl) contentEl.value = post.content;
   if (tagsEl) tagsEl.value = post.tags ? post.tags.join(', ') : '';

   // Update form title and button
   if (formTitle) formTitle.textContent = 'edit_post.js';
   if (submitText) submitText.textContent = 'Update Post';

   // Switch to write tab
   switchTab('write');
}

async function handleDeletePost(postId) {
   const post = posts.find(p => p.id === postId);
   if (!post) return;

   if (!confirm(`Are you sure you want to delete "${post.title}"?`)) return;

   try {
      await deletePost(postId);
      showNotification('Post deleted successfully!', 'success');
      await loadPosts();
   } catch (error) {
      console.error('Error deleting post:', error);
      showNotification('Error deleting post. Please try again.', 'error');
   }
}

// Render Functions
function createPostElement(post) {
   const template = document.getElementById('blog-card-template');
   if (!template) {
      console.error('Blog card template not found');
      return document.createElement('div');
   }

   const element = template.content.cloneNode(true);

   // Populate the template fields
   const titleEl = element.querySelector('[data-field="title"]');
   const authorEl = element.querySelector('[data-field="author"]');
   const timeAgoEl = element.querySelector('[data-field="timeAgo"]');
   const contentEl = element.querySelector('[data-field="content"]');
   const dateEl = element.querySelector('[data-field="date"]');
   const tagsContainer = element.querySelector('[data-field="tags"]');

   if (titleEl) titleEl.textContent = post.title;
   if (authorEl) authorEl.textContent = `👤 ${post.author}`;
   if (timeAgoEl) timeAgoEl.textContent = `📅 ${getTimeAgo(new Date(post.createdAt))}`;
   if (contentEl) contentEl.textContent = post.content;
   if (dateEl) dateEl.textContent = new Date(post.createdAt).toLocaleDateString();

   // Handle tags
   if (tagsContainer) {
      if (post.tags && post.tags.length > 0) {
         const tagsHTML = post.tags.map(tag =>
            `<span style="background: rgba(0,212,255,0.2); color: var(--primary); padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">${tag}</span>`
         ).join(' ');
         tagsContainer.innerHTML = tagsHTML;
         tagsContainer.style.marginTop = '15px';
      } else {
         tagsContainer.style.display = 'none';
      }
   }

   // Add event listeners to buttons
   const editBtn = element.querySelector('.edit-btn');
   const deleteBtn = element.querySelector('.delete-btn');

   if (editBtn) editBtn.addEventListener('click', () => editPost(post.id));
   if (deleteBtn) deleteBtn.addEventListener('click', () => handleDeletePost(post.id));

   return element;
}

function renderPosts(postsToRender = posts) {
   const blogGrid = document.getElementById('blogGrid');
   const emptyState = document.getElementById('emptyState');

   if (!blogGrid || !emptyState) {
      console.error('Blog grid or empty state elements not found');
      return;
   }

   if (postsToRender.length === 0) {
      blogGrid.style.display = 'none';
      emptyState.style.display = 'block';
      return;
   }

   blogGrid.style.display = 'grid';
   emptyState.style.display = 'none';

   // Clear existing content
   blogGrid.innerHTML = '';

   // Create and append each post card
   postsToRender.forEach(post => {
      const postCard = createPostElement(post);
      blogGrid.appendChild(postCard);
   });
}

// Stats Update
function updateStats() {
   const uniqueAuthors = new Set(posts.map(p => p.author));
   const postCountEl = document.getElementById('postCount');
   const authorCountEl = document.getElementById('authorCount');

   if (postCountEl) postCountEl.textContent = posts.length;
   if (authorCountEl) authorCountEl.textContent = uniqueAuthors.size;
}

// Analytics
function updateAnalytics() {
   const totalViews = posts.length * 10 + 100;
   const avgReadTime = posts.length ? `${Math.ceil(posts.reduce((acc, p) => acc + p.content.length, 0) / posts.length / 200)}min` : '0min';

   const tagCount = {};
   posts.forEach(post => {
      (post.tags || []).forEach(tag => {
         tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
   });

   const popularTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

   const totalViewsEl = document.getElementById('totalViews');
   const avgReadTimeEl = document.getElementById('avgReadTime');
   const popularTagEl = document.getElementById('popularTag');

   if (totalViewsEl) totalViewsEl.textContent = totalViews;
   if (avgReadTimeEl) avgReadTimeEl.textContent = avgReadTime;
   if (popularTagEl) popularTagEl.textContent = popularTag;
}

// Notification
function showNotification(message, type = 'success') {
   const container = document.getElementById('notificationContainer');
   if (!container) {
      console.error('Notification container not found');
      return;
   }

   const notification = document.createElement('div');
   notification.className = `notification show ${type}`;
   notification.textContent = message;
   notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success' ? 'background: #28a745;' : ''}
        ${type === 'error' ? 'background: #dc3545;' : ''}
        ${type === 'warning' ? 'background: #ffc107; color: #000;' : ''}
    `;

   container.appendChild(notification);

   // Trigger animation
   setTimeout(() => {
      notification.style.transform = 'translateX(0)';
   }, 100);

   setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
   }, 3000);
}

// Search
function handleSearch(e) {
   const term = e.target.value.toLowerCase();
   const filtered = posts.filter(post =>
      post.title.toLowerCase().includes(term) ||
      post.author.toLowerCase().includes(term) ||
      (post.tags || []).some(tag => tag.toLowerCase().includes(term))
   );
   renderPosts(filtered);
}

// Time Ago Helper
function getTimeAgo(date) {
   const totalSeconds = Math.floor((new Date() - date) / 1000);
   const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
      { label: 'second', seconds: 1 }
   ];

   for (const interval of intervals) {
      const count = Math.floor(totalSeconds / interval.seconds);
      if (count >= 1) {
         return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
      }
   }
   return 'just now';
}
/* ============================================================
   CourseDashboard – Application Logic
   ============================================================
   Parsing · Data Model · Rendering · Search · Sort · Theme

   Architecture Notes (Extension Points):
   ─────────────────────────────────────
   1. DATA MODEL – Each course is a plain object. Add fields like
      `filePath`, `thumbnail`, `tags`, `completed` without
      touching the renderer.
   2. PARSER – `parseCatalog()` is isolated. Swap it with a JSON
      loader by replacing only that function.
   3. RENDERER – `renderCards()` builds all UI. Add click handlers,
      thumbnails, or progress bars inside this function.
   4. FILTER PIPELINE – `getFilteredCourses()` chains category
      filter → search filter → sort. Extend with duration filter,
      tag filter, etc. by adding stages.
   ============================================================ */

// ── Application State ───────────────────────────────────────
const state = {
    /** @type {{ name: string, courses: Course[] }[]} */
    categories: [],

    /** Currently selected category name, or 'all' */
    activeCategory: 'all',

    /** Current search query (lowercase, trimmed) */
    searchQuery: '',

    /** Sort direction: 'asc' | 'desc' */
    sortDir: 'asc',

    /** Total number of courses across all categories */
    totalCourses: 0,
};

// ── Course Data Model ───────────────────────────────────────
/**
 * @typedef {Object} Course
 * @property {string}  title        – Course title without leading number
 * @property {string}  duration     – e.g. "6h 58m", or '' if not available
 * @property {string}  lessons      – e.g. "54 Lessons + Exam", or ''
 * @property {boolean} hasExam      – true if course includes an exam
 * @property {number}  lessonCount  – numeric count of lessons (0 if unknown)
 * @property {string}  category     – parent category name
 * @property {number}  index        – 1-based index within category
 *
 * ── Future extension fields (add as needed): ──
 * @property {string}  [filePath]   – local path to course files
 * @property {string}  [thumbnail]  – URL or path to thumbnail image
 * @property {string[]} [tags]      – searchable tags
 * @property {boolean} [completed]  – completion state (persist in localStorage)
 * @property {number}  [progress]   – 0-100 progress percentage
 */

// ── DOM References ──────────────────────────────────────────
const DOM = {
    sidebarNav: () => document.getElementById('sidebar-nav'),
    cardGrid: () => document.getElementById('card-grid'),
    searchInput: () => document.getElementById('search-input'),
    searchClear: () => document.getElementById('search-clear'),
    sortBtn: () => document.getElementById('sort-btn'),
    categoryTitle: () => document.getElementById('category-title'),
    categoryDesc: () => document.getElementById('category-desc'),
    resultsCount: () => document.getElementById('results-count'),
    themeToggle: () => document.getElementById('theme-toggle'),
    sidebar: () => document.getElementById('sidebar'),
    sidebarOverlay: () => document.getElementById('sidebar-overlay'),
    mobileMenuBtn: () => document.getElementById('mobile-menu-btn'),
    statsTotal: () => document.getElementById('stats-total'),
    statsCats: () => document.getElementById('stats-cats'),
};

// ============================================================
// PARSER – Converts raw TXT catalog into structured data
// ============================================================

/**
 * Parses the raw course catalog text into categories and courses.
 *
 * Format expectations:
 *   CATEGORY NAME          ← all-caps line (category header)
 *   (blank line)
 *   1.  Course Title | Duration | Lessons
 *   2.  Another Course | Duration | Lessons
 *   (blank line)
 *   NEXT CATEGORY
 *
 * Multi-line entries are NOT expected in the cleaned file.
 * Courses may omit duration and/or lessons.
 *
 * @param {string} raw – raw text content of courses.txt
 * @returns {{ name: string, courses: Course[] }[]}
 */
function parseCatalog(raw) {
    const lines = raw.split('\n');
    const categories = [];
    let currentCategory = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip blank lines
        if (!line) continue;

        // ── Detect category header ──
        // A line is a category header if it is ALL CAPS (letters, digits,
        // spaces, ampersands, and punctuation — but no lowercase letters)
        // and does NOT start with a digit (which would be a course line).
        if (isCategoryHeader(line)) {
            currentCategory = { name: formatCategoryName(line), courses: [] };
            categories.push(currentCategory);
            continue;
        }

        // ── Parse course line ──
        if (currentCategory) {
            const course = parseCourseLine(line, currentCategory.name, currentCategory.courses.length + 1);
            if (course) {
                currentCategory.courses.push(course);
            }
        }
    }

    return categories;
}

/**
 * Checks if a line is a category header.
 * Category headers are ALL-CAPS with no leading digit.
 */
function isCategoryHeader(line) {
    // Must not start with a digit (course lines start with numbers)
    if (/^\d/.test(line)) return false;
    // Must contain at least 2 alphabetic characters
    if ((line.match(/[A-Za-z]/g) || []).length < 2) return false;
    // Must not contain any lowercase letters
    if (/[a-z]/.test(line)) return false;
    return true;
}

/**
 * Formats a category name from ALL CAPS to Title Case.
 * Preserves special tokens like "FP&A", "AI", etc.
 */
function formatCategoryName(raw) {
    // Keep the original casing for the category name as-is (already all-caps in source)
    // We'll display it with proper casing
    const specialTokens = {
        'FP&A': 'FP&A',
        'AI': 'AI',
        'EXCEL AND POWERPOINT': 'Excel & PowerPoint',
        'DATA ANALYSIS & AI': 'Data Analysis & AI',
        'MERGERS & ACQUISITIONS': 'Mergers & Acquisitions',
    };

    if (specialTokens[raw]) return specialTokens[raw];

    // General Title Case conversion
    return raw.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
        .replace(/\bAnd\b/g, '&');
}

/**
 * Parses a single course line.
 *
 * Expected formats:
 *   "1.  Course Title | 6h 58m | 54 Lessons + Exam"
 *   "8.  IB Soft Skills: Tools for Becoming an Amazing Junior Banker"
 *   "1.  Bank and FIG Modeling | n/a | 0 Lessons"
 *
 * @param {string} line
 * @param {string} categoryName
 * @param {number} fallbackIndex
 * @returns {Course|null}
 */
function parseCourseLine(line, categoryName, fallbackIndex) {
    // Remove leading number + dot: "1.  " or "10. "
    const numberMatch = line.match(/^(\d+)\.\s+/);
    if (!numberMatch) return null; // Not a course line

    const index = parseInt(numberMatch[1], 10);
    const rest = line.slice(numberMatch[0].length);

    // Split by pipe
    const parts = rest.split('|').map(s => s.trim());

    const title = parts[0] || '';
    let duration = parts[1] || '';
    let lessonsRaw = parts[2] || '';

    // Clean up duration
    if (duration.toLowerCase() === 'n/a' || duration === '0' || duration === '') {
        duration = '';
    }

    // Parse lesson count and exam flag
    let lessonCount = 0;
    let hasExam = false;
    if (lessonsRaw) {
        const lessonMatch = lessonsRaw.match(/(\d+)\s*Lessons?/i);
        if (lessonMatch) {
            lessonCount = parseInt(lessonMatch[1], 10);
        }
        hasExam = /exam/i.test(lessonsRaw);
    }

    // Build formatted lessons string
    let lessons = '';
    if (lessonCount > 0) {
        lessons = `${lessonCount} Lesson${lessonCount !== 1 ? 's' : ''}`;
    }

    return {
        title,
        duration,
        lessons,
        hasExam,
        lessonCount,
        category: categoryName,
        index,
    };
}

// ============================================================
// FILTER PIPELINE
// ============================================================

/**
 * Returns filtered and sorted courses based on current state.
 * This is the single pipeline that drives all rendering.
 *
 * Extension point: add more filter stages here (e.g., duration range,
 * tags, completion status).
 *
 * @returns {Course[]}
 */
function getFilteredCourses() {
    let courses = [];

    // Stage 1: Category filter
    if (state.activeCategory === 'all') {
        state.categories.forEach(cat => {
            courses = courses.concat(cat.courses);
        });
    } else {
        const cat = state.categories.find(c => c.name === state.activeCategory);
        if (cat) courses = [...cat.courses];
    }

    // Stage 2: Search filter
    if (state.searchQuery) {
        const q = state.searchQuery;
        courses = courses.filter(c =>
            c.title.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q)
        );
    }

    // Stage 3: Sort
    courses.sort((a, b) => {
        const cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        return state.sortDir === 'asc' ? cmp : -cmp;
    });

    return courses;
}

// ============================================================
// RENDERER – Builds all UI from state
// ============================================================

/**
 * Renders the sidebar category navigation.
 */
function renderSidebar() {
    const nav = DOM.sidebarNav();
    if (!nav) return;

    // Count total courses
    const totalCount = state.categories.reduce((sum, cat) => sum + cat.courses.length, 0);

    let html = '';

    // "All Courses" item
    html += `
    <button class="sidebar-item${state.activeCategory === 'all' ? ' active' : ''}"
            data-category="all"
            aria-current="${state.activeCategory === 'all' ? 'true' : 'false'}">
      <span class="sidebar-item-name">All Courses</span>
      <span class="sidebar-item-count">${totalCount}</span>
    </button>
  `;

    // Category items
    state.categories.forEach(cat => {
        const isActive = state.activeCategory === cat.name;
        html += `
      <button class="sidebar-item${isActive ? ' active' : ''}"
              data-category="${escapeAttr(cat.name)}"
              aria-current="${isActive ? 'true' : 'false'}">
        <span class="sidebar-item-name">${escapeHtml(cat.name)}</span>
        <span class="sidebar-item-count">${cat.courses.length}</span>
      </button>
    `;
    });

    nav.innerHTML = html;

    // Update stats
    const statsTotal = DOM.statsTotal();
    const statsCats = DOM.statsCats();
    if (statsTotal) statsTotal.textContent = totalCount;
    if (statsCats) statsCats.textContent = state.categories.length;
}

/**
 * Renders course cards into the grid.
 */
function renderCards() {
    const grid = DOM.cardGrid();
    if (!grid) return;

    const courses = getFilteredCourses();

    // Update results count
    const resultsEl = DOM.resultsCount();
    if (resultsEl) {
        resultsEl.textContent = `${courses.length} course${courses.length !== 1 ? 's' : ''}`;
    }

    // Update category banner
    const titleEl = DOM.categoryTitle();
    const descEl = DOM.categoryDesc();
    if (titleEl) {
        titleEl.textContent = state.activeCategory === 'all' ? 'All Courses' : state.activeCategory;
    }
    if (descEl) {
        if (state.searchQuery) {
            descEl.textContent = `Showing results for "${state.searchQuery}"`;
        } else if (state.activeCategory === 'all') {
            descEl.textContent = `Browse the complete catalog across ${state.categories.length} categories`;
        } else {
            const cat = state.categories.find(c => c.name === state.activeCategory);
            descEl.textContent = cat ? `${cat.courses.length} courses in this category` : '';
        }
    }

    // Empty state
    if (courses.length === 0) {
        grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h2>No courses found</h2>
        <p>${state.searchQuery
                ? 'Try adjusting your search terms or selecting a different category.'
                : 'This category doesn\'t have any courses yet.'
            }</p>
      </div>
    `;
        return;
    }

    // Build cards
    let html = '';
    courses.forEach((course, i) => {
        const showCategory = state.activeCategory === 'all' || !!state.searchQuery;
        html += buildCardHTML(course, showCategory);
    });

    grid.innerHTML = html;
}

/**
 * Builds the HTML string for a single course card.
 *
 * Extension point: Add thumbnail, click handler, progress bar,
 * tags, or completion checkbox here.
 *
 * @param {Course} course
 * @param {boolean} showCategory – whether to show the category label
 * @returns {string}
 */
function buildCardHTML(course, showCategory) {
    const titleHTML = state.searchQuery
        ? highlightMatch(escapeHtml(course.title), state.searchQuery)
        : escapeHtml(course.title);

    let metaChips = '';

    // Duration chip (hidden if blank or n/a)
    if (course.duration) {
        metaChips += `
      <span class="chip chip-duration">
        <span class="chip-icon">⏱</span>
        ${escapeHtml(course.duration)}
      </span>
    `;
    }

    // Lessons chip (hidden if 0 or blank)
    if (course.lessons) {
        metaChips += `
      <span class="chip chip-lessons">
        <span class="chip-icon">📚</span>
        ${escapeHtml(course.lessons)}
      </span>
    `;
    }

    // Exam chip
    if (course.hasExam) {
        metaChips += `
      <span class="chip chip-exam">
        <span class="chip-icon">✎</span>
        Exam
      </span>
    `;
    }

    return `
    <article class="course-card" data-title="${escapeAttr(course.title)}">
      <span class="course-card-number">${course.index}</span>
      ${showCategory ? `<div class="course-card-category">${escapeHtml(course.category)}</div>` : ''}
      <h3 class="course-card-title">${titleHTML}</h3>
      ${metaChips ? `<div class="course-card-meta">${metaChips}</div>` : ''}
    </article>
  `;
}

/**
 * Highlights occurrences of `query` in `text` using <mark> tags.
 * @param {string} text – already HTML-escaped text
 * @param {string} query – lowercase search query
 * @returns {string}
 */
function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * Initializes all event listeners.
 */
function initEvents() {
    // ── Sidebar category click ──
    DOM.sidebarNav()?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sidebar-item');
        if (!btn) return;
        const category = btn.dataset.category;
        state.activeCategory = category;
        renderSidebar();
        renderCards();
        closeMobileSidebar();
    });

    // ── Search input ──
    const searchInput = DOM.searchInput();
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                state.searchQuery = searchInput.value.trim().toLowerCase();

                // Show/hide clear button
                const clearBtn = DOM.searchClear();
                if (clearBtn) {
                    clearBtn.classList.toggle('visible', searchInput.value.length > 0);
                }

                // When searching, show results across all categories
                if (state.searchQuery && state.activeCategory !== 'all') {
                    state.activeCategory = 'all';
                    renderSidebar();
                }

                renderCards();
            }, 120); // Debounce for smooth feel
        });
    }

    // ── Search clear ──
    DOM.searchClear()?.addEventListener('click', () => {
        const searchInput = DOM.searchInput();
        if (searchInput) {
            searchInput.value = '';
            state.searchQuery = '';
            DOM.searchClear()?.classList.remove('visible');
            renderCards();
            searchInput.focus();
        }
    });

    // ── Sort toggle ──
    DOM.sortBtn()?.addEventListener('click', () => {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        const btn = DOM.sortBtn();
        if (btn) {
            btn.dataset.dir = state.sortDir;
            btn.querySelector('span:not(.sort-icon)').textContent =
                state.sortDir === 'asc' ? 'A → Z' : 'Z → A';
        }
        renderCards();
    });

    // ── Theme toggle ──
    DOM.themeToggle()?.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeToggleLabel(newTheme);
    });

    // ── Mobile menu ──
    DOM.mobileMenuBtn()?.addEventListener('click', openMobileSidebar);
    DOM.sidebarOverlay()?.addEventListener('click', closeMobileSidebar);

    // ── Keyboard shortcut: Cmd/Ctrl + K to focus search ──
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            DOM.searchInput()?.focus();
        }
        // Escape to close sidebar or clear search
        if (e.key === 'Escape') {
            closeMobileSidebar();
            const searchInput = DOM.searchInput();
            if (searchInput && document.activeElement === searchInput && searchInput.value) {
                searchInput.value = '';
                state.searchQuery = '';
                DOM.searchClear()?.classList.remove('visible');
                renderCards();
            }
        }
    });
}

function openMobileSidebar() {
    DOM.sidebar()?.classList.add('open');
    DOM.sidebarOverlay()?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    DOM.sidebar()?.classList.remove('open');
    DOM.sidebarOverlay()?.classList.remove('open');
    document.body.style.overflow = '';
}

function updateThemeToggleLabel(theme) {
    const label = document.querySelector('.theme-toggle-label span:last-child');
    if (label) {
        label.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
    const icon = document.querySelector('.theme-toggle-label span:first-child');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// AUTHENTICATION – Client-side password gate
// ============================================================

/**
 * SHA-256 hash of the access password.
 *
 * ── HOW TO CHANGE THE PASSWORD ──
 * 1. Open browser console
 * 2. Run: crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_NEW_PASSWORD')).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
 * 3. Copy the hash output and replace the PASSWORD_HASH string below
 *
 * Current password: "coursedashboard"
 */
const PASSWORD_HASH = '05a181f00c157f70413d33701778a6ee7d2747ac18b9c0fbb8bd71a62dd7a223';

/**
 * Computes the SHA-256 hex digest of a string.
 * @param {string} str
 * @returns {Promise<string>}
 */
async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if the user is already authenticated in this session.
 */
function isAuthenticated() {
    return sessionStorage.getItem('cd_auth') === '1';
}

/**
 * Marks the user as authenticated for this session.
 */
function setAuthenticated() {
    sessionStorage.setItem('cd_auth', '1');
}

/**
 * Validates the entered password against the stored hash.
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function validatePassword(password) {
    const hash = await sha256(password);
    return hash === PASSWORD_HASH;
}

/**
 * Initializes the auth gate listeners.
 */
function initAuth() {
    const overlay = document.getElementById('auth-overlay');
    const form = document.getElementById('auth-form');
    const input = document.getElementById('auth-password');
    const errorEl = document.getElementById('auth-error');
    const toggleVis = document.getElementById('auth-toggle-vis');
    const app = document.getElementById('app');

    // Toggle password visibility
    toggleVis?.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggleVis.textContent = isPassword ? '🙈' : '👁';
        input.focus();
    });

    // Form submit
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = input.value;
        if (!password) return;

        const valid = await validatePassword(password);
        if (valid) {
            setAuthenticated();
            overlay.classList.add('hidden');
            app.style.display = '';
            // Now load the dashboard
            await loadDashboard();
        } else {
            errorEl.textContent = 'Incorrect password. Try again.';
            input.classList.add('error');
            input.value = '';
            input.focus();
            setTimeout(() => {
                input.classList.remove('error');
            }, 600);
        }
    });

    // Clear error on new input
    input?.addEventListener('input', () => {
        errorEl.textContent = '';
        input.classList.remove('error');
    });
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Loads and renders the course catalog.
 * Separated from init() so it can be called after authentication.
 */
async function loadDashboard() {
    try {
        const response = await fetch('./courses.txt');
        if (!response.ok) throw new Error(`Failed to load courses.txt (${response.status})`);
        const raw = await response.text();

        state.categories = parseCatalog(raw);
        state.totalCourses = state.categories.reduce((sum, cat) => sum + cat.courses.length, 0);

        renderSidebar();
        renderCards();
        initEvents();
    } catch (err) {
        console.error('CourseDashboard init error:', err);
        const grid = DOM.cardGrid();
        if (grid) {
            grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">⚠️</div>
          <h2>Unable to load courses</h2>
          <p>Make sure <code>courses.txt</code> is in the same folder as <code>index.html</code> and you're serving the site via a local server or a static host.</p>
        </div>
      `;
        }
    }
}

/**
 * Application entry point.
 * Checks auth state, shows login gate or loads dashboard.
 */
async function init() {
    // ── Restore saved theme ──
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeToggleLabel(savedTheme);
    } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
            updateThemeToggleLabel('dark');
        }
    }

    const overlay = document.getElementById('auth-overlay');
    const app = document.getElementById('app');

    if (isAuthenticated()) {
        // Already authenticated — skip login, show dashboard
        overlay.classList.add('hidden');
        app.style.display = '';
        await loadDashboard();
    } else {
        // Show login gate
        initAuth();
    }
}

// Boot!
document.addEventListener('DOMContentLoaded', init);


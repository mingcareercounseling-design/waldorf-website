import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Configuration
const PROJECT_DIR = process.cwd();
const CONTENT_DIR = path.join(PROJECT_DIR, 'src', 'content');
const PUBLIC_DIR = path.join(PROJECT_DIR, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(PUBLIC_DIR));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(IMAGES_DIR, req.body.category || 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${timestamp}${ext}`);
  }
});

const upload = multer({ storage });

// API Routes

// Get content file
app.get('/api/content/:file', (req, res) => {
  try {
    const file = req.params.file;

    // Prevent directory traversal
    if (file.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    let filePath;
    if (file === 'home') {
      filePath = path.join(CONTENT_DIR, 'home.json');
    } else {
      // For calendar and newsletters, need to find the file
      const baseFile = path.basename(file);
      filePath = path.join(CONTENT_DIR, file.endsWith('.json') ? file : file + '.json');
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found', path: filePath });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    res.json(data);
  } catch (error) {
    console.error('Error reading content:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of calendar events
app.get('/api/calendar/list', (req, res) => {
  try {
    const calendarDir = path.join(CONTENT_DIR, 'calendar');
    const files = fs.readdirSync(calendarDir).filter(f => f.endsWith('.json') && f !== '.gitkeep');
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of newsletters
app.get('/api/newsletters/list', (req, res) => {
  try {
    const newsletterDir = path.join(CONTENT_DIR, 'newsletters');
    const files = fs.readdirSync(newsletterDir).filter(f => f.endsWith('.json') && f !== '.gitkeep');
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save content file
app.post('/api/content/:file', (req, res) => {
  try {
    const file = req.params.file;

    if (file.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    let filePath;
    if (file === 'home') {
      filePath = path.join(CONTENT_DIR, 'home.json');
    } else {
      filePath = path.join(CONTENT_DIR, file.endsWith('.json') ? file : file + '.json');
    }

    // Ensure the file is within the content directory
    if (!filePath.startsWith(CONTENT_DIR)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = req.body;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, message: 'Content saved successfully' });
  } catch (error) {
    console.error('Error saving content:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload image
app.post('/api/upload-image', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const relativePath = `/images/${req.body.category || 'uploads'}/${req.file.filename}`;
    res.json({
      success: true,
      path: relativePath,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Publish (git add, commit, push)
app.post('/api/publish', (req, res) => {
  try {
    const timestamp = new Date().toLocaleString('zh-TW');
    const commands = [
      `git -C "${PROJECT_DIR}" add -A`,
      `git -C "${PROJECT_DIR}" commit -m "content: 更新內容 ${timestamp}"`,
      `git -C "${PROJECT_DIR}" push`
    ];

    let output = '';
    for (const cmd of commands) {
      try {
        output += execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
      } catch (err) {
        output += err.stdout || '';
        // Don't throw on commit if nothing to commit
        if (err.message && err.message.includes('nothing to commit')) {
          output += 'Nothing to commit\n';
          continue;
        }
        throw err;
      }
    }

    res.json({
      success: true,
      message: '已成功發布到前台',
      timestamp
    });
  } catch (error) {
    console.error('Error publishing:', error);
    res.status(500).json({
      error: error.message || 'Publishing failed',
      success: false
    });
  }
});

// Serve admin UI
app.get('/', (req, res) => {
  res.send(HTML_TEMPLATE);
});

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>光禾華德福 - 後台管理系統</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary-green: #2d6a4f;
      --accent-tan: #c9a572;
      --light-bg: #f5f3f0;
      --white: #ffffff;
      --text-dark: #2c2c2c;
      --text-light: #666666;
      --border: #e0d5cc;
      --success: #4a934a;
      --warning: #d97706;
      --error: #dc2626;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft JhengHei', sans-serif;
      background: var(--light-bg);
      color: var(--text-dark);
      line-height: 1.6;
    }

    .container {
      display: flex;
      height: 100vh;
      background: var(--white);
    }

    /* Sidebar */
    .sidebar {
      width: 280px;
      background: var(--primary-green);
      padding: 30px 0;
      overflow-y: auto;
      color: white;
      box-shadow: 2px 0 8px rgba(0,0,0,0.1);
    }

    .sidebar-header {
      padding: 0 20px 30px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 20px;
    }

    .sidebar-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .sidebar-subtitle {
      font-size: 12px;
      opacity: 0.8;
    }

    .nav-section {
      margin-bottom: 10px;
    }

    .nav-label {
      padding: 12px 20px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.6;
      font-weight: 600;
    }

    .nav-item {
      padding: 12px 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 3px solid transparent;
      margin: 2px 0;
    }

    .nav-item:hover {
      background: rgba(255,255,255,0.1);
      border-left-color: var(--accent-tan);
    }

    .nav-item.active {
      background: rgba(255,255,255,0.15);
      border-left-color: var(--accent-tan);
      font-weight: 500;
    }

    .nav-item-icon {
      margin-right: 10px;
      font-size: 16px;
    }

    /* Main Content */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--light-bg);
      overflow: hidden;
    }

    .header {
      background: var(--white);
      padding: 20px 40px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .header-title {
      font-size: 24px;
      font-weight: 600;
      color: var(--primary-green);
    }

    .publish-button {
      background: var(--accent-tan);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .publish-button:hover:not(:disabled) {
      background: #b8944a;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .publish-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-badge.published {
      background: #dcfce7;
      color: var(--success);
    }

    .status-badge.publishing {
      background: #fef3c7;
      color: var(--warning);
    }

    .status-badge.error {
      background: #fee2e2;
      color: var(--error);
    }

    /* Content Area */
    .content-area {
      flex: 1;
      overflow-y: auto;
      padding: 40px;
    }

    .form-section {
      display: none;
    }

    .form-section.active {
      display: block;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .form-group {
      margin-bottom: 24px;
      background: var(--white);
      padding: 24px;
      border-radius: 8px;
      border: 1px solid var(--border);
      transition: all 0.3s ease;
    }

    .form-group:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .form-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: var(--primary-green);
      font-size: 14px;
    }

    .form-input,
    .form-textarea,
    .form-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.3s ease;
    }

    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
      outline: none;
      border-color: var(--primary-green);
      box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.1);
      background: rgba(45, 106, 79, 0.02);
    }

    .form-textarea {
      min-height: 120px;
      resize: vertical;
    }

    .image-upload {
      position: relative;
      border: 2px dashed var(--border);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(45, 106, 79, 0.02);
    }

    .image-upload:hover {
      border-color: var(--primary-green);
      background: rgba(45, 106, 79, 0.05);
    }

    .image-upload input[type="file"] {
      display: none;
    }

    .image-preview {
      max-width: 100%;
      max-height: 300px;
      margin-top: 16px;
      border-radius: 6px;
      border: 1px solid var(--border);
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      flex: 1;
    }

    .btn-primary {
      background: var(--primary-green);
      color: white;
    }

    .btn-primary:hover {
      background: #1f4a38;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(45, 106, 79, 0.3);
    }

    .btn-secondary {
      background: transparent;
      color: var(--primary-green);
      border: 1px solid var(--primary-green);
    }

    .btn-secondary:hover {
      background: rgba(45, 106, 79, 0.05);
    }

    .btn-danger {
      background: var(--error);
      color: white;
    }

    .btn-danger:hover {
      background: #b91c1c;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* List Items */
    .list-container {
      display: grid;
      gap: 16px;
    }

    .list-item {
      background: var(--white);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .list-item:hover {
      border-color: var(--primary-green);
      box-shadow: 0 4px 12px rgba(45, 106, 79, 0.1);
      transform: translateX(4px);
    }

    .list-item-info h3 {
      font-size: 16px;
      margin-bottom: 4px;
    }

    .list-item-info p {
      font-size: 12px;
      color: var(--text-light);
    }

    .list-item-arrow {
      color: var(--primary-green);
      font-size: 20px;
    }

    /* Success/Error Messages */
    .alert {
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 14px;
      animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .alert-success {
      background: #dcfce7;
      color: var(--success);
      border: 1px solid #86efac;
    }

    .alert-error {
      background: #fee2e2;
      color: var(--error);
      border: 1px solid #fca5a5;
    }

    /* Item Form */
    .item-form {
      display: grid;
      gap: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .form-row.full {
      grid-template-columns: 1fr;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-light);
    }

    /* Loading */
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .container {
        flex-direction: column;
      }

      .sidebar {
        width: 100%;
        padding: 20px;
        height: auto;
        display: flex;
        overflow-x: auto;
      }

      .nav-section {
        display: flex;
        gap: 8px;
        margin: 0;
      }

      .content-area {
        padding: 20px;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">光禾華德福</div>
        <div class="sidebar-subtitle">後台管理系統</div>
      </div>

      <div class="nav-section">
        <div class="nav-label">內容管理</div>
        <div class="nav-item active" data-section="home">
          <span class="nav-item-icon">🏠</span>首頁內容
        </div>
        <div class="nav-item" data-section="calendar">
          <span class="nav-item-icon">📅</span>行事曆
        </div>
        <div class="nav-item" data-section="newsletters">
          <span class="nav-item-icon">📰</span>學刊
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-label">其他</div>
        <div class="nav-item" data-section="contact">
          <span class="nav-item-icon">📞</span>聯絡資訊
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main">
      <!-- Header -->
      <div class="header">
        <div class="header-title" id="pageTitle">首頁內容</div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <div class="status-badge published" id="statusBadge">已發布</div>
          <button class="publish-button" id="publishBtn" onclick="publishChanges()">
            <span>📤</span>
            <span>發布到前台</span>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="content-area">
        <!-- Home Section -->
        <div class="form-section active" id="home-section">
          <div id="carousel-container"></div>
          <div id="highlights-container"></div>
        </div>

        <!-- Calendar Section -->
        <div class="form-section" id="calendar-section">
          <div id="calendar-list"></div>
          <div id="calendar-form" style="display: none;"></div>
        </div>

        <!-- Newsletters Section -->
        <div class="form-section" id="newsletters-section">
          <div id="newsletters-list"></div>
          <div id="newsletter-form" style="display: none;"></div>
        </div>

        <!-- Contact Section -->
        <div class="form-section" id="contact-section">
          <div id="contact-form"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentSection = 'home';
    let currentEditingFile = null;

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        currentSection = item.dataset.section;
        switchSection(currentSection);
      });
    });

    function switchSection(section) {
      document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
      document.getElementById(section + '-section').classList.add('active');

      const titles = {
        'home': '首頁內容',
        'calendar': '行事曆',
        'newsletters': '學刊',
        'contact': '聯絡資訊'
      };
      document.getElementById('pageTitle').textContent = titles[section];

      if (section === 'home') loadHomeContent();
      else if (section === 'calendar') loadCalendarList();
      else if (section === 'newsletters') loadNewslettersList();
      else if (section === 'contact') loadContactContent();
    }

    // Load home content
    async function loadHomeContent() {
      try {
        const response = await fetch('/api/content/home');
        const data = await response.json();

        let html = '';

        // Carousel
        html += '<h3 style="margin-bottom: 16px; color: var(--primary-green); font-size: 18px;">輪播</h3>';
        data.carousel.forEach((item, idx) => {
          html += \`
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4>輪播項目 \${idx + 1}</h4>
                <button class="btn btn-danger" onclick="removeCarouselItem(\${idx})">刪除</button>
              </div>
              <div class="item-form">
                <div>
                  <label class="form-label">標題</label>
                  <input type="text" class="form-input carousel-title" value="\${item.title}" data-idx="\${idx}">
                </div>
                <div>
                  <label class="form-label">副標題</label>
                  <input type="text" class="form-input carousel-subtitle" value="\${item.subtitle}" data-idx="\${idx}">
                </div>
                <div>
                  <label class="form-label">圖片路徑</label>
                  <input type="text" class="form-input carousel-image" value="\${item.image}" data-idx="\${idx}">
                </div>
                <div>
                  <label class="form-label">連結</label>
                  <input type="text" class="form-input carousel-link" value="\${item.link}" data-idx="\${idx}">
                </div>
              </div>
            </div>
          \`;
        });
        html += '<button class="btn btn-primary" onclick="addCarouselItem()" style="margin-bottom: 32px;">+ 新增輪播項目</button>';

        // Highlights
        html += '<h3 style="margin-bottom: 16px; color: var(--primary-green); font-size: 18px;">焦點新聞</h3>';
        data.highlights.forEach((item, idx) => {
          html += \`
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4>焦點 \${idx + 1}</h4>
                <button class="btn btn-danger" onclick="removeHighlightItem(\${idx})">刪除</button>
              </div>
              <div class="item-form">
                <div>
                  <label class="form-label">標題</label>
                  <input type="text" class="form-input highlight-title" value="\${item.title}" data-idx="\${idx}">
                </div>
                <div>
                  <label class="form-label">日期</label>
                  <input type="text" class="form-input highlight-date" value="\${item.date}" data-idx="\${idx}">
                </div>
                <div class="form-row full">
                  <div>
                    <label class="form-label">內容</label>
                    <textarea class="form-textarea highlight-content" data-idx="\${idx}">\${item.content}</textarea>
                  </div>
                </div>
                <div>
                  <label class="form-label">連結</label>
                  <input type="text" class="form-input highlight-link" value="\${item.link}" data-idx="\${idx}">
                </div>
              </div>
            </div>
          \`;
        });
        html += '<button class="btn btn-primary" onclick="addHighlightItem()" style="margin-bottom: 32px;">+ 新增焦點</button>';

        document.getElementById('carousel-container').innerHTML = html;
      } catch (error) {
        showError('無法載入首頁內容: ' + error.message);
      }
    }

    function addCarouselItem() {
      fetch('/api/content/home')
        .then(r => r.json())
        .then(data => {
          const newId = Math.max(...data.carousel.map(i => i.id), 0) + 1;
          data.carousel.push({
            id: newId,
            title: '新輪播項目',
            subtitle: '',
            image: '/images/carousel/new.jpg',
            link: '/'
          });
          saveContent('home', data);
        });
    }

    function removeCarouselItem(idx) {
      fetch('/api/content/home')
        .then(r => r.json())
        .then(data => {
          data.carousel.splice(idx, 1);
          saveContent('home', data);
        });
    }

    function addHighlightItem() {
      fetch('/api/content/home')
        .then(r => r.json())
        .then(data => {
          const newId = Math.max(...data.highlights.map(i => i.id), 0) + 1;
          data.highlights.push({
            id: newId,
            title: '新焦點',
            date: new Date().toISOString().split('T')[0],
            content: '',
            link: '/'
          });
          saveContent('home', data);
        });
    }

    function removeHighlightItem(idx) {
      fetch('/api/content/home')
        .then(r => r.json())
        .then(data => {
          data.highlights.splice(idx, 1);
          saveContent('home', data);
        });
    }

    // Save home content
    document.addEventListener('input', function(e) {
      if (currentSection !== 'home') return;

      if (e.target.classList.contains('carousel-title') ||
          e.target.classList.contains('carousel-subtitle') ||
          e.target.classList.contains('carousel-image') ||
          e.target.classList.contains('carousel-link')) {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.classList[1].replace('carousel-', '');

        fetch('/api/content/home')
          .then(r => r.json())
          .then(data => {
            data.carousel[idx][field] = e.target.value;
            saveContent('home', data);
          });
      }

      if (e.target.classList.contains('highlight-title') ||
          e.target.classList.contains('highlight-date') ||
          e.target.classList.contains('highlight-content') ||
          e.target.classList.contains('highlight-link')) {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.classList[1].replace('highlight-', '');

        fetch('/api/content/home')
          .then(r => r.json())
          .then(data => {
            data.highlights[idx][field] = e.target.value;
            saveContent('home', data);
          });
      }
    });

    // Load calendar list
    async function loadCalendarList() {
      try {
        const response = await fetch('/api/calendar/list');
        const { files } = await response.json();

        if (files.length === 0) {
          document.getElementById('calendar-list').innerHTML = '<div class="alert alert-error">暫無行事曆項目</div>';
          return;
        }

        let html = '<div class="list-container">';
        for (const file of files) {
          const fileResponse = await fetch(\`/api/content/calendar/\${file}\`);
          const data = await fileResponse.json();
          html += \`
            <div class="list-item" onclick="editCalendarEvent('\${file}')">
              <div class="list-item-info">
                <h3>\${data.title}</h3>
                <p>\${data.date}\${data.end_date && data.end_date !== data.date ? ' 至 ' + data.end_date : ''}</p>
              </div>
              <div class="list-item-arrow">→</div>
            </div>
          \`;
        }
        html += '</div>';
        html += '<button class="btn btn-primary" onclick="createCalendarEvent()" style="margin-top: 16px;">+ 新增行事</button>';
        document.getElementById('calendar-list').innerHTML = html;
      } catch (error) {
        showError('無法載入行事曆: ' + error.message);
      }
    }

    function editCalendarEvent(filename) {
      currentEditingFile = filename;
      fetch(\`/api/content/calendar/\${filename}\`)
        .then(r => r.json())
        .then(data => {
          const html = \`
            <button class="btn btn-secondary" onclick="loadCalendarList()" style="margin-bottom: 16px;">← 返回列表</button>
            <div class="form-group">
              <div class="item-form">
                <div>
                  <label class="form-label">標題</label>
                  <input type="text" id="cal-title" class="form-input" value="\${data.title}">
                </div>
                <div class="form-row">
                  <div>
                    <label class="form-label">開始日期</label>
                    <input type="date" id="cal-start" class="form-input" value="\${data.date}">
                  </div>
                  <div>
                    <label class="form-label">結束日期</label>
                    <input type="date" id="cal-end" class="form-input" value="\${data.end_date}">
                  </div>
                </div>
                <div>
                  <label class="form-label">分類</label>
                  <input type="text" id="cal-category" class="form-input" value="\${data.category}">
                </div>
                <div class="form-row full">
                  <div>
                    <label class="form-label">描述</label>
                    <textarea id="cal-desc" class="form-textarea">\${data.description}</textarea>
                  </div>
                </div>
                <div class="button-group">
                  <button class="btn btn-primary" onclick="saveCalendarEvent()">儲存</button>
                  <button class="btn btn-danger" onclick="deleteCalendarEvent()">刪除</button>
                </div>
              </div>
            </div>
          \`;
          document.getElementById('calendar-form').innerHTML = html;
          document.getElementById('calendar-list').style.display = 'none';
          document.getElementById('calendar-form').style.display = 'block';
        });
    }

    function createCalendarEvent() {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      currentEditingFile = \`\${dateStr}-新增項目.json\`;
      const html = \`
        <button class="btn btn-secondary" onclick="loadCalendarList()" style="margin-bottom: 16px;">← 返回列表</button>
        <div class="form-group">
          <div class="item-form">
            <div>
              <label class="form-label">標題</label>
              <input type="text" id="cal-title" class="form-input" value="">
            </div>
            <div class="form-row">
              <div>
                <label class="form-label">開始日期</label>
                <input type="date" id="cal-start" class="form-input" value="\${dateStr}">
              </div>
              <div>
                <label class="form-label">結束日期</label>
                <input type="date" id="cal-end" class="form-input" value="\${dateStr}">
              </div>
            </div>
            <div>
              <label class="form-label">分類</label>
              <input type="text" id="cal-category" class="form-input" value="">
            </div>
            <div class="form-row full">
              <div>
                <label class="form-label">描述</label>
                <textarea id="cal-desc" class="form-textarea"></textarea>
              </div>
            </div>
            <div class="button-group">
              <button class="btn btn-primary" onclick="saveCalendarEvent()">建立</button>
            </div>
          </div>
        </div>
      \`;
      document.getElementById('calendar-form').innerHTML = html;
      document.getElementById('calendar-list').style.display = 'none';
      document.getElementById('calendar-form').style.display = 'block';
    }

    function saveCalendarEvent() {
      const data = {
        title: document.getElementById('cal-title').value,
        date: document.getElementById('cal-start').value,
        end_date: document.getElementById('cal-end').value,
        category: document.getElementById('cal-category').value,
        description: document.getElementById('cal-desc').value
      };
      saveContent('calendar/' + currentEditingFile, data).then(() => {
        loadCalendarList();
      });
    }

    function deleteCalendarEvent() {
      if (confirm('確定要刪除此項目嗎?')) {
        // For this, we'd need a delete endpoint - for now just clear and reload
        loadCalendarList();
      }
    }

    // Load newsletters list
    async function loadNewslettersList() {
      try {
        const response = await fetch('/api/newsletters/list');
        const { files } = await response.json();

        if (files.length === 0) {
          document.getElementById('newsletters-list').innerHTML = '<div class="alert alert-error">暫無學刊項目</div>';
          return;
        }

        let html = '<div class="list-container">';
        for (const file of files) {
          const fileResponse = await fetch(\`/api/content/newsletters/\${file}\`);
          const data = await fileResponse.json();
          html += \`
            <div class="list-item" onclick="editNewsletter('\${file}')">
              <div class="list-item-info">
                <h3>\${data.title}</h3>
                <p>\${data.semester} • \${data.pageCount}頁</p>
              </div>
              <div class="list-item-arrow">→</div>
            </div>
          \`;
        }
        html += '</div>';
        html += '<button class="btn btn-primary" onclick="createNewsletter()" style="margin-top: 16px;">+ 新增學刊</button>';
        document.getElementById('newsletters-list').innerHTML = html;
      } catch (error) {
        showError('無法載入學刊: ' + error.message);
      }
    }

    function editNewsletter(filename) {
      currentEditingFile = filename;
      fetch(\`/api/content/newsletters/\${filename}\`)
        .then(r => r.json())
        .then(data => {
          const html = \`
            <button class="btn btn-secondary" onclick="loadNewslettersList()" style="margin-bottom: 16px;">← 返回列表</button>
            <div class="form-group">
              <div class="item-form">
                <div>
                  <label class="form-label">期數</label>
                  <input type="text" id="nl-issue" class="form-input" value="\${data.issue}">
                </div>
                <div>
                  <label class="form-label">標題</label>
                  <input type="text" id="nl-title" class="form-input" value="\${data.title}">
                </div>
                <div>
                  <label class="form-label">學期</label>
                  <input type="text" id="nl-semester" class="form-input" value="\${data.semester}">
                </div>
                <div>
                  <label class="form-label">封面圖片路徑</label>
                  <input type="text" id="nl-cover" class="form-input" value="\${data.cover}">
                </div>
                <div>
                  <label class="form-label">圖片前綴URL</label>
                  <input type="text" id="nl-prefix" class="form-input" value="\${data.imagePrefix}">
                </div>
                <div class="form-row">
                  <div>
                    <label class="form-label">頁數</label>
                    <input type="number" id="nl-pages" class="form-input" value="\${data.pageCount}">
                  </div>
                  <div>
                    <label class="form-label">頁碼位數</label>
                    <input type="number" id="nl-digits" class="form-input" value="\${data.pageDigits}">
                  </div>
                </div>
                <div>
                  <label class="form-label">圖片格式</label>
                  <input type="text" id="nl-format" class="form-input" value="\${data.pageFormat}">
                </div>
                <div>
                  <label class="form-label">發布日期</label>
                  <input type="date" id="nl-date" class="form-input" value="\${data.date}">
                </div>
                <div class="button-group">
                  <button class="btn btn-primary" onclick="saveNewsletter()">儲存</button>
                  <button class="btn btn-danger" onclick="deleteNewsletter()">刪除</button>
                </div>
              </div>
            </div>
          \`;
          document.getElementById('newsletter-form').innerHTML = html;
          document.getElementById('newsletters-list').style.display = 'none';
          document.getElementById('newsletter-form').style.display = 'block';
        });
    }

    function createNewsletter() {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      currentEditingFile = 'NO0.json';
      const html = \`
        <button class="btn btn-secondary" onclick="loadNewslettersList()" style="margin-bottom: 16px;">← 返回列表</button>
        <div class="form-group">
          <div class="item-form">
            <div>
              <label class="form-label">期數</label>
              <input type="text" id="nl-issue" class="form-input" value="">
            </div>
            <div>
              <label class="form-label">標題</label>
              <input type="text" id="nl-title" class="form-input" value="">
            </div>
            <div>
              <label class="form-label">學期</label>
              <input type="text" id="nl-semester" class="form-input" value="">
            </div>
            <div>
              <label class="form-label">封面圖片路徑</label>
              <input type="text" id="nl-cover" class="form-input" value="/newsletter-covers/NO0-01.jpg">
            </div>
            <div>
              <label class="form-label">圖片前綴URL</label>
              <input type="text" id="nl-prefix" class="form-input" value="">
            </div>
            <div class="form-row">
              <div>
                <label class="form-label">頁數</label>
                <input type="number" id="nl-pages" class="form-input" value="24">
              </div>
              <div>
                <label class="form-label">頁碼位數</label>
                <input type="number" id="nl-digits" class="form-input" value="2">
              </div>
            </div>
            <div>
              <label class="form-label">圖片格式</label>
              <input type="text" id="nl-format" class="form-input" value="jpg">
            </div>
            <div>
              <label class="form-label">發布日期</label>
              <input type="date" id="nl-date" class="form-input" value="\${dateStr}">
            </div>
            <div class="button-group">
              <button class="btn btn-primary" onclick="saveNewsletter()">建立</button>
            </div>
          </div>
        </div>
      \`;
      document.getElementById('newsletter-form').innerHTML = html;
      document.getElementById('newsletters-list').style.display = 'none';
      document.getElementById('newsletter-form').style.display = 'block';
    }

    function saveNewsletter() {
      const data = {
        issue: document.getElementById('nl-issue').value,
        title: document.getElementById('nl-title').value,
        semester: document.getElementById('nl-semester').value,
        cover: document.getElementById('nl-cover').value,
        imagePrefix: document.getElementById('nl-prefix').value,
        pageCount: parseInt(document.getElementById('nl-pages').value),
        pageDigits: parseInt(document.getElementById('nl-digits').value),
        pageFormat: document.getElementById('nl-format').value,
        date: document.getElementById('nl-date').value
      };
      saveContent('newsletters/' + currentEditingFile, data).then(() => {
        loadNewslettersList();
      });
    }

    function deleteNewsletter() {
      if (confirm('確定要刪除此學刊嗎?')) {
        loadNewslettersList();
      }
    }

    // Load contact content
    async function loadContactContent() {
      try {
        const response = await fetch('/api/content/home');
        const data = await response.json();
        const contact = data.contact;

        const html = \`
          <div class="form-group">
            <h3 style="margin-bottom: 16px; color: var(--primary-green);">聯絡資訊</h3>
            <div class="item-form">
              <div class="form-row full">
                <div>
                  <label class="form-label">地址</label>
                  <input type="text" id="contact-address" class="form-input" value="\${contact.address}">
                </div>
              </div>
              <div>
                <label class="form-label">電話</label>
                <input type="text" id="contact-phone" class="form-input" value="\${contact.phone}">
              </div>
              <div>
                <label class="form-label">信箱</label>
                <input type="email" id="contact-email" class="form-input" value="\${contact.email}">
              </div>
              <div>
                <label class="form-label">Facebook</label>
                <input type="text" id="contact-facebook" class="form-input" value="\${contact.facebook}">
              </div>
              <div>
                <label class="form-label">Instagram</label>
                <input type="text" id="contact-instagram" class="form-input" value="\${contact.instagram}">
              </div>
              <div>
                <label class="form-label">Threads</label>
                <input type="text" id="contact-threads" class="form-input" value="\${contact.threads}">
              </div>
              <div>
                <label class="form-label">YouTube</label>
                <input type="text" id="contact-youtube" class="form-input" value="\${contact.youtube}">
              </div>
              <div class="button-group">
                <button class="btn btn-primary" onclick="saveContactInfo()">儲存</button>
              </div>
            </div>
          </div>
        \`;
        document.getElementById('contact-form').innerHTML = html;
      } catch (error) {
        showError('無法載入聯絡資訊: ' + error.message);
      }
    }

    function saveContactInfo() {
      fetch('/api/content/home')
        .then(r => r.json())
        .then(data => {
          data.contact = {
            address: document.getElementById('contact-address').value,
            phone: document.getElementById('contact-phone').value,
            email: document.getElementById('contact-email').value,
            facebook: document.getElementById('contact-facebook').value,
            instagram: document.getElementById('contact-instagram').value,
            threads: document.getElementById('contact-threads').value,
            youtube: document.getElementById('contact-youtube').value
          };
          saveContent('home', data);
        });
    }

    // General save content function
    async function saveContent(file, data) {
      try {
        const response = await fetch(\`/api/content/\${file}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error('Save failed');
        }

        showSuccess('內容已儲存');
        return await response.json();
      } catch (error) {
        showError('儲存失敗: ' + error.message);
      }
    }

    // Publish function
    async function publishChanges() {
      const btn = document.getElementById('publishBtn');
      const badge = document.getElementById('statusBadge');

      btn.disabled = true;
      badge.className = 'status-badge publishing';
      badge.textContent = '發布中...';

      try {
        const response = await fetch('/api/publish', { method: 'POST' });
        const result = await response.json();

        if (result.success) {
          badge.className = 'status-badge published';
          badge.textContent = '已發布';
          showSuccess('已成功發布到前台');
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        badge.className = 'status-badge error';
        badge.textContent = '發布失敗';
        showError('發布失敗: ' + error.message);
      } finally {
        btn.disabled = false;
      }
    }

    // Show messages
    function showSuccess(message) {
      const alert = document.createElement('div');
      alert.className = 'alert alert-success';
      alert.textContent = '✓ ' + message;
      document.querySelector('.content-area').prepend(alert);
      setTimeout(() => alert.remove(), 3000);
    }

    function showError(message) {
      const alert = document.createElement('div');
      alert.className = 'alert alert-error';
      alert.textContent = '✗ ' + message;
      document.querySelector('.content-area').prepend(alert);
      setTimeout(() => alert.remove(), 5000);
    }

    // Load initial section
    loadHomeContent();
  </script>
</body>
</html>`;

// Start server
app.listen(PORT, () => {
  console.log(`\n📚 光禾華德福 後台管理系統`);
  console.log(`🌐 Admin panel running at http://localhost:${PORT}`);
  console.log(`📁 Project directory: ${PROJECT_DIR}`);
  console.log(`✅ Ready for editing!\n`);
});

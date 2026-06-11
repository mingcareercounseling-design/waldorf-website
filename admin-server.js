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
  <title>光禾華德福 ✦ 內容管理</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --brown: #8B4513;
      --brown-light: #A0522D;
      --orange: #FF8C00;
      --green: #228B22;
      --green-deep: #2d6a4f;
      --cream: #fdf6e3;
      --cream2: #fff8dc;
      --warm-white: #fffef9;
      --text: #333;
      --text-light: #666;
      --card-shadow: 0 10px 40px rgba(139,69,19,0.10);
      --card-radius: 20px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft JhengHei', '微軟正黑體', sans-serif;
      background: var(--cream);
      color: var(--text);
      line-height: 1.7;
    }

    /* ── TOP NAV ── */
    .top-nav {
      position: sticky; top: 0; z-index: 100;
      background: linear-gradient(135deg, #fff8dc 0%, #fdf6e3 100%);
      border-bottom: 2px solid rgba(139,69,19,0.12);
      padding: 0 2rem;
      display: flex; align-items: center; gap: 1.5rem;
      height: 64px;
      box-shadow: 0 4px 20px rgba(139,69,19,0.08);
    }
    .nav-logo { font-size: 1.3rem; font-weight: 700; color: var(--brown); white-space: nowrap; }
    .nav-logo span { color: var(--green); }
    .nav-tabs { display: flex; gap: 0.25rem; flex: 1; }
    .nav-tab {
      padding: 0.4rem 1rem; border-radius: 20px; border: none;
      background: transparent; color: var(--text-light);
      font-size: 0.95rem; cursor: pointer; transition: all 0.2s;
      font-family: inherit;
    }
    .nav-tab:hover { background: rgba(139,69,19,0.08); color: var(--brown); }
    .nav-tab.active { background: var(--brown); color: white; }
    .publish-btn {
      padding: 0.5rem 1.5rem; border-radius: 30px; border: none;
      background: linear-gradient(135deg, var(--brown), var(--orange));
      color: white; font-weight: 600; font-size: 0.95rem;
      cursor: pointer; transition: all 0.3s; white-space: nowrap;
      font-family: inherit; box-shadow: 0 4px 15px rgba(139,69,19,0.3);
    }
    .publish-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(139,69,19,0.4); }
    .publish-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .publish-status {
      font-size: 0.85rem; padding: 0.3rem 0.8rem; border-radius: 20px;
      white-space: nowrap;
    }
    .status-ok   { background: #d4edda; color: #155724; }
    .status-busy { background: #fff3cd; color: #856404; }
    .status-err  { background: #f8d7da; color: #721c24; }

    /* ── MAIN ── */
    .main { max-width: 900px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }

    .page-section { display: none; }
    .page-section.active { display: block; }

    /* ── SECTION CARD ── */
    .section-card {
      background: white; border-radius: var(--card-radius);
      box-shadow: var(--card-shadow); margin-bottom: 2rem; overflow: hidden;
      transition: box-shadow 0.3s;
    }
    .section-card:hover { box-shadow: 0 15px 50px rgba(139,69,19,0.15); }

    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.75rem;
      background: linear-gradient(135deg, #fff8dc 0%, #fdf6e3 100%);
      border-bottom: 1px solid rgba(139,69,19,0.08);
    }
    .card-header h3 { color: var(--brown); font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; }
    .edit-btn {
      padding: 0.35rem 1rem; border-radius: 20px;
      border: 2px solid var(--brown); background: transparent;
      color: var(--brown); font-size: 0.85rem; cursor: pointer;
      transition: all 0.2s; font-family: inherit; font-weight: 500;
    }
    .edit-btn:hover, .edit-btn.active { background: var(--brown); color: white; }

    .card-body { padding: 1.75rem; }

    /* ── VIEW MODE: styled like front-end ── */
    .view-mode { display: block; }
    .edit-mode { display: none; }
    .editing .view-mode { display: none; }
    .editing .edit-mode { display: block; }

    /* News card preview */
    .preview-news-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(240px,1fr)); gap: 1.25rem; }
    .preview-news-card {
      background: var(--cream); padding: 1.25rem; border-radius: 15px;
      border-left: 4px solid var(--green);
    }
    .preview-date { color: var(--green); font-size: 0.85rem; font-weight: 600; }
    .preview-title { color: var(--text); font-weight: 700; margin: 0.35rem 0 0.5rem; }
    .preview-body { color: var(--text-light); font-size: 0.9rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

    /* Carousel preview */
    .preview-carousel { display: flex; flex-direction: column; gap: 0.75rem; }
    .preview-carousel-item {
      display: flex; align-items: center; gap: 1rem;
      background: var(--cream); padding: 1rem 1.25rem; border-radius: 12px;
    }
    .preview-carousel-num {
      background: var(--brown); color: white; width: 28px; height: 28px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-weight: 700; flex-shrink: 0;
    }
    .preview-carousel-info { flex: 1; }
    .preview-carousel-title { font-weight: 700; color: var(--text); }
    .preview-carousel-sub { color: var(--text-light); font-size: 0.88rem; }

    /* Contact preview */
    .preview-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .preview-contact-item {
      background: var(--cream); padding: 1rem; border-radius: 12px;
    }
    .preview-contact-label { font-size: 0.8rem; color: var(--text-light); margin-bottom: 0.2rem; }
    .preview-contact-value { color: var(--text); font-weight: 600; font-size: 0.95rem; word-break: break-all; }

    /* Calendar preview */
    .preview-calendar { display: flex; flex-direction: column; gap: 0.6rem; }
    .preview-event {
      display: flex; align-items: center; gap: 1rem;
      background: var(--cream); padding: 0.85rem 1.25rem; border-radius: 12px;
    }
    .event-date-badge {
      background: var(--green-deep); color: white; padding: 0.3rem 0.7rem;
      border-radius: 8px; font-size: 0.8rem; font-weight: 700; white-space: nowrap;
    }
    .event-title { font-weight: 600; color: var(--text); flex: 1; }
    .event-cat { font-size: 0.8rem; color: var(--text-light); background: rgba(34,139,34,0.1); padding: 0.2rem 0.6rem; border-radius: 20px; }

    /* Newsletter preview */
    .preview-newsletters { display: grid; grid-template-columns: repeat(auto-fill,minmax(160px,1fr)); gap: 1rem; }
    .preview-nl {
      background: var(--cream); border-radius: 15px; overflow: hidden;
      text-align: center;
    }
    .preview-nl-cover {
      width: 100%; height: 100px; object-fit: cover; background: #e8d5c4;
      display: flex; align-items: center; justify-content: center; font-size: 2rem;
    }
    .preview-nl-cover img { width: 100%; height: 100%; object-fit: cover; }
    .preview-nl-info { padding: 0.75rem; }
    .preview-nl-issue { color: var(--brown); font-weight: 700; }
    .preview-nl-sem { color: var(--text-light); font-size: 0.8rem; }

    /* ── EDIT FORMS ── */
    .form-group { margin-bottom: 1.25rem; }
    .form-label {
      display: block; font-size: 0.85rem; font-weight: 600;
      color: var(--brown); margin-bottom: 0.4rem;
    }
    .form-input, .form-textarea, .form-select {
      width: 100%; padding: 0.65rem 0.9rem; border-radius: 10px;
      border: 2px solid rgba(139,69,19,0.15); background: var(--warm-white);
      font-size: 0.95rem; color: var(--text); font-family: inherit;
      transition: border-color 0.2s; outline: none;
    }
    .form-input:focus, .form-textarea:focus {
      border-color: var(--brown); background: white;
    }
    .form-textarea { min-height: 80px; resize: vertical; }

    /* Repeatable item */
    .repeat-item {
      background: var(--cream); border-radius: 15px; padding: 1.25rem;
      margin-bottom: 1rem; position: relative;
    }
    .repeat-item-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;
    }
    .repeat-item-title { font-weight: 700; color: var(--brown); font-size: 0.9rem; }
    .remove-btn {
      background: none; border: none; color: #dc2626; cursor: pointer;
      font-size: 1.1rem; padding: 0.2rem 0.5rem; border-radius: 6px;
      transition: background 0.2s;
    }
    .remove-btn:hover { background: #fee2e2; }
    .add-btn {
      width: 100%; padding: 0.65rem; border-radius: 12px;
      border: 2px dashed rgba(139,69,19,0.3); background: transparent;
      color: var(--brown); font-size: 0.9rem; cursor: pointer;
      transition: all 0.2s; font-family: inherit; font-weight: 600;
      margin-top: 0.5rem;
    }
    .add-btn:hover { background: rgba(139,69,19,0.06); border-color: var(--brown); }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }

    /* Image upload */
    .img-upload-area {
      border: 2px dashed rgba(139,69,19,0.25); border-radius: 12px;
      padding: 1.25rem; text-align: center; cursor: pointer;
      transition: all 0.2s; background: var(--warm-white);
    }
    .img-upload-area:hover { border-color: var(--brown); background: var(--cream); }
    .img-upload-area input { display: none; }
    .img-preview { max-width: 100%; max-height: 120px; border-radius: 8px; margin-top: 0.5rem; }
    .img-path { font-size: 0.8rem; color: var(--text-light); margin-top: 0.4rem; word-break: break-all; }

    /* Save row */
    .save-row { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
    .cancel-btn {
      padding: 0.5rem 1.25rem; border-radius: 20px;
      border: 2px solid rgba(139,69,19,0.25); background: white;
      color: var(--text-light); cursor: pointer; font-family: inherit;
      transition: all 0.2s;
    }
    .cancel-btn:hover { border-color: var(--brown); color: var(--brown); }
    .save-btn {
      padding: 0.5rem 1.5rem; border-radius: 20px;
      background: var(--green-deep); color: white; border: none;
      font-weight: 600; cursor: pointer; font-family: inherit;
      transition: all 0.2s; box-shadow: 0 4px 15px rgba(45,106,79,0.3);
    }
    .save-btn:hover { background: #1e5035; transform: translateY(-1px); }

    /* Section headings */
    .section-heading {
      font-size: 2rem; color: var(--brown); font-weight: 800;
      margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;
    }

    /* Toast */
    #toast {
      position: fixed; bottom: 2rem; right: 2rem; z-index: 999;
      padding: 0.85rem 1.5rem; border-radius: 12px;
      font-weight: 600; font-size: 0.95rem;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      transform: translateY(100px); opacity: 0;
      transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
      pointer-events: none;
    }
    #toast.show { transform: translateY(0); opacity: 1; }
    #toast.success { background: #d4edda; color: #155724; }
    #toast.error   { background: #f8d7da; color: #721c24; }

    /* Empty state */
    .empty-state {
      text-align: center; padding: 3rem; color: var(--text-light);
      font-size: 1rem;
    }
    .empty-state-icon { font-size: 3rem; margin-bottom: 0.75rem; }

    /* Divider */
    .divider { height: 1px; background: rgba(139,69,19,0.08); margin: 1.5rem 0; }

    /* Responsive */
    @media (max-width: 768px) {
      .top-nav { flex-wrap: wrap; height: auto; padding: 0.75rem 1rem; gap: 0.75rem; }
      .nav-tabs { overflow-x: auto; }
      .preview-contact { grid-template-columns: 1fr; }
    }
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
  <!-- TOP NAV -->
  <nav class="top-nav">
    <div class="nav-logo">🌿 光禾 <span>華德福</span> 後台</div>
    <div class="nav-tabs">
      <button class="nav-tab active" onclick="showPage('news')">📰 最新消息</button>
      <button class="nav-tab" onclick="showPage('carousel')">🖼 輪播圖</button>
      <button class="nav-tab" onclick="showPage('calendar')">📅 行事曆</button>
      <button class="nav-tab" onclick="showPage('newsletters')">📚 學刊</button>
      <button class="nav-tab" onclick="showPage('contact')">📞 聯絡資訊</button>
    </div>
    <span id="publishStatus" class="publish-status status-ok">✓ 已同步</span>
    <button class="publish-btn" id="publishBtn" onclick="publish()">🚀 發布到前台</button>
  </nav>

  <div class="main">

    <!-- ── 最新消息 ── -->
    <div class="page-section active" id="page-news">
      <div class="section-heading">📰 最新消息</div>

      <div class="section-card" id="card-highlights">
        <div class="card-header">
          <h3>🗞 消息列表</h3>
          <button class="edit-btn" onclick="toggleEdit('highlights')">編輯</button>
        </div>
        <div class="card-body">
          <div class="view-mode" id="view-highlights">
            <div class="preview-news-grid" id="preview-highlights">
              <div class="empty-state"><div class="empty-state-icon">⏳</div>載入中…</div>
            </div>
          </div>
          <div class="edit-mode" id="edit-highlights">
            <div id="highlights-items"></div>
            <button class="add-btn" onclick="addHighlight()">＋ 新增一則消息</button>
            <div class="save-row">
              <button class="cancel-btn" onclick="toggleEdit('highlights')">取消</button>
              <button class="save-btn" onclick="saveHighlights()">💾 儲存</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 輪播圖 ── -->
    <div class="page-section" id="page-carousel">
      <div class="section-heading">🖼 首頁輪播圖</div>

      <div class="section-card" id="card-carousel">
        <div class="card-header">
          <h3>🎠 輪播圖設定</h3>
          <button class="edit-btn" onclick="toggleEdit('carousel')">編輯</button>
        </div>
        <div class="card-body">
          <div class="view-mode" id="view-carousel">
            <div class="preview-carousel" id="preview-carousel">
              <div class="empty-state"><div class="empty-state-icon">⏳</div>載入中…</div>
            </div>
          </div>
          <div class="edit-mode" id="edit-carousel">
            <div id="carousel-items"></div>
            <button class="add-btn" onclick="addCarouselItem()">＋ 新增輪播圖</button>
            <div class="save-row">
              <button class="cancel-btn" onclick="toggleEdit('carousel')">取消</button>
              <button class="save-btn" onclick="saveCarousel()">💾 儲存</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 行事曆 ── -->
    <div class="page-section" id="page-calendar">
      <div class="section-heading">📅 行事曆</div>

      <div class="section-card">
        <div class="card-header">
          <h3>🗓 活動列表</h3>
          <button class="edit-btn" onclick="showNewEventForm()">＋ 新增活動</button>
        </div>
        <div class="card-body">
          <div class="preview-calendar" id="preview-calendar">
            <div class="empty-state"><div class="empty-state-icon">⏳</div>載入中…</div>
          </div>
          <!-- new event form -->
          <div id="new-event-form" style="display:none; margin-top:1.5rem;">
            <div class="divider"></div>
            <div style="font-weight:700;color:var(--brown);margin-bottom:1rem;">新增活動</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">活動名稱</label>
                <input class="form-input" id="ev-title" placeholder="例：家長說明會">
              </div>
              <div class="form-group">
                <label class="form-label">類別</label>
                <input class="form-input" id="ev-category" placeholder="例：說明會">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">開始日期</label>
                <input class="form-input" type="date" id="ev-date">
              </div>
              <div class="form-group">
                <label class="form-label">結束日期</label>
                <input class="form-input" type="date" id="ev-end-date">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">說明</label>
              <textarea class="form-textarea" id="ev-desc" placeholder="活動說明…"></textarea>
            </div>
            <div class="save-row">
              <button class="cancel-btn" onclick="document.getElementById('new-event-form').style.display='none'">取消</button>
              <button class="save-btn" onclick="saveNewEvent()">💾 儲存活動</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 學刊 ── -->
    <div class="page-section" id="page-newsletters">
      <div class="section-heading">📚 學刊管理</div>

      <div class="section-card">
        <div class="card-header">
          <h3>📖 學刊列表</h3>
          <button class="edit-btn" onclick="showNewNewsletterForm()">＋ 新增學刊</button>
        </div>
        <div class="card-body">
          <div class="preview-newsletters" id="preview-newsletters">
            <div class="empty-state"><div class="empty-state-icon">⏳</div>載入中…</div>
          </div>
          <div id="new-nl-form" style="display:none; margin-top:1.5rem;">
            <div class="divider"></div>
            <div style="font-weight:700;color:var(--brown);margin-bottom:1rem;">新增學刊</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">期數（純數字）</label>
                <input class="form-input" id="nl-issue" placeholder="例：34">
              </div>
              <div class="form-group">
                <label class="form-label">標題</label>
                <input class="form-input" id="nl-title" placeholder="例：第34期">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">學期</label>
                <input class="form-input" id="nl-semester" placeholder="例：113學年度 秋學季刊">
              </div>
              <div class="form-group">
                <label class="form-label">日期</label>
                <input class="form-input" type="date" id="nl-date">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">封面圖片路徑</label>
              <input class="form-input" id="nl-cover" placeholder="例：/newsletter-covers/NO34-01.jpg">
            </div>
            <div class="save-row">
              <button class="cancel-btn" onclick="document.getElementById('new-nl-form').style.display='none'">取消</button>
              <button class="save-btn" onclick="saveNewNewsletter()">💾 儲存學刊</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 聯絡資訊 ── -->
    <div class="page-section" id="page-contact">
      <div class="section-heading">📞 聯絡資訊</div>

      <div class="section-card" id="card-contact">
        <div class="card-header">
          <h3>🏫 學校聯絡資訊</h3>
          <button class="edit-btn" onclick="toggleEdit('contact')">編輯</button>
        </div>
        <div class="card-body">
          <div class="view-mode" id="view-contact">
            <div class="preview-contact" id="preview-contact">
              <div class="empty-state"><div class="empty-state-icon">⏳</div>載入中…</div>
            </div>
          </div>
          <div class="edit-mode" id="edit-contact">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">地址</label>
                <input class="form-input" id="c-address">
              </div>
              <div class="form-group">
                <label class="form-label">電話</label>
                <input class="form-input" id="c-phone">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-input" id="c-email">
              </div>
              <div class="form-group">
                <label class="form-label">Facebook</label>
                <input class="form-input" id="c-facebook">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Instagram</label>
                <input class="form-input" id="c-instagram">
              </div>
              <div class="form-group">
                <label class="form-label">YouTube</label>
                <input class="form-input" id="c-youtube">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Threads</label>
              <input class="form-input" id="c-threads">
            </div>
            <div class="save-row">
              <button class="cancel-btn" onclick="toggleEdit('contact')">取消</button>
              <button class="save-btn" onclick="saveContact()">💾 儲存</button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div><!-- /main -->

  <div id="toast"></div>

  <script>
    let homeData = null;

    // ── Page nav ──
    function showPage(name) {
      document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('page-' + name).classList.add('active');
      event.currentTarget.classList.add('active');
    }

    // ── Toggle edit/view ──
    function toggleEdit(key) {
      const card = document.getElementById('card-' + key);
      const btn  = card.querySelector('.edit-btn');
      const isEditing = card.classList.toggle('editing');
      btn.textContent = isEditing ? '取消' : '編輯';
      btn.classList.toggle('active', isEditing);
      if (isEditing) populateEditForm(key);
    }

    function populateEditForm(key) {
      if (key === 'highlights') renderHighlightsEdit();
      if (key === 'carousel')   renderCarouselEdit();
      if (key === 'contact')    renderContactEdit();
    }

    // ── Toast ──
    function toast(msg, type='success') {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = 'show ' + type;
      clearTimeout(el._t);
      el._t = setTimeout(() => el.className = '', 3000);
    }

    // ── Publish ──
    async function publish() {
      const btn = document.getElementById('publishBtn');
      const status = document.getElementById('publishStatus');
      btn.disabled = true;
      status.textContent = '⏳ 發布中…';
      status.className = 'publish-status status-busy';
      try {
        const r = await fetch('/api/publish', { method: 'POST' });
        const d = await r.json();
        if (d.success) {
          status.textContent = '✓ 已發布 ' + new Date().toLocaleTimeString('zh-TW');
          status.className = 'publish-status status-ok';
          toast('🎉 已成功發布到前台！Vercel 約 1-2 分鐘後更新');
        } else throw new Error(d.error);
      } catch(e) {
        status.textContent = '✗ 發布失敗';
        status.className = 'publish-status status-err';
        toast('❌ 發布失敗：' + e.message, 'error');
      }
      btn.disabled = false;
    }

    // ── Load home data ──
    async function loadHome() {
      try {
        homeData = await fetch('/api/content/home').then(r => r.json());
        renderHighlightsView();
        renderCarouselView();
        renderContactView();
      } catch(e) { console.error(e); }
    }

    // ── HIGHLIGHTS ──
    function renderHighlightsView() {
      const items = homeData?.highlights || [];
      const el = document.getElementById('preview-highlights');
      if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div>尚無消息</div>'; return; }
      el.innerHTML = items.map(n => \`
        <div class="preview-news-card">
          <div class="preview-date">\${n.date || ''}</div>
          <div class="preview-title">\${n.title || ''}</div>
          <div class="preview-body">\${n.content || ''}</div>
        </div>
      \`).join('');
    }

    function renderHighlightsEdit() {
      const items = homeData?.highlights || [];
      document.getElementById('highlights-items').innerHTML = items.map((n, i) => \`
        <div class="repeat-item" id="hl-item-\${i}">
          <div class="repeat-item-header">
            <span class="repeat-item-title">消息 \${i+1}</span>
            <button class="remove-btn" onclick="removeHighlight(\${i})">✕</button>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">標題</label>
              <input class="form-input" id="hl-title-\${i}" value="\${n.title||''}">
            </div>
            <div class="form-group">
              <label class="form-label">日期</label>
              <input class="form-input" id="hl-date-\${i}" value="\${n.date||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">內容</label>
            <textarea class="form-textarea" id="hl-content-\${i}">\${n.content||''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">連結</label>
            <input class="form-input" id="hl-link-\${i}" value="\${n.link||''}">
          </div>
        </div>
      \`).join('');
    }

    function addHighlight() {
      if (!homeData.highlights) homeData.highlights = [];
      homeData.highlights.push({ title:'', date:'', content:'', link:'' });
      renderHighlightsEdit();
    }

    function removeHighlight(i) {
      homeData.highlights.splice(i, 1);
      renderHighlightsEdit();
    }

    async function saveHighlights() {
      const items = homeData.highlights || [];
      const newItems = items.map((_, i) => ({
        id: i + 1,
        title:   document.getElementById('hl-title-'+i)?.value || '',
        date:    document.getElementById('hl-date-'+i)?.value || '',
        content: document.getElementById('hl-content-'+i)?.value || '',
        link:    document.getElementById('hl-link-'+i)?.value || '',
      }));
      homeData.highlights = newItems;
      await saveHome();
      renderHighlightsView();
      toggleEdit('highlights');
      toast('✅ 最新消息已儲存');
    }

    // ── CAROUSEL ──
    function renderCarouselView() {
      const items = homeData?.carousel || [];
      const el = document.getElementById('preview-carousel');
      if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🖼</div>尚無輪播圖</div>'; return; }
      el.innerHTML = items.map((c, i) => \`
        <div class="preview-carousel-item">
          <div class="preview-carousel-num">\${i+1}</div>
          <div class="preview-carousel-info">
            <div class="preview-carousel-title">\${c.title||''}</div>
            <div class="preview-carousel-sub">\${c.subtitle||''}</div>
          </div>
          \${c.image ? \`<img src="\${c.image}" style="height:50px;width:80px;object-fit:cover;border-radius:8px;">\` : ''}
        </div>
      \`).join('');
    }

    function renderCarouselEdit() {
      const items = homeData?.carousel || [];
      document.getElementById('carousel-items').innerHTML = items.map((c, i) => \`
        <div class="repeat-item">
          <div class="repeat-item-header">
            <span class="repeat-item-title">輪播 \${i+1}</span>
            <button class="remove-btn" onclick="removeCarousel(\${i})">✕</button>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">標題</label>
              <input class="form-input" id="cr-title-\${i}" value="\${c.title||''}">
            </div>
            <div class="form-group">
              <label class="form-label">副標題</label>
              <input class="form-input" id="cr-sub-\${i}" value="\${c.subtitle||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">圖片路徑</label>
              <input class="form-input" id="cr-img-\${i}" value="\${c.image||''}" placeholder="/images/carousel/xxx.jpg">
            </div>
            <div class="form-group">
              <label class="form-label">連結</label>
              <input class="form-input" id="cr-link-\${i}" value="\${c.link||''}">
            </div>
          </div>
        </div>
      \`).join('');
    }

    function addCarouselItem() {
      if (!homeData.carousel) homeData.carousel = [];
      homeData.carousel.push({ id: Date.now(), title:'', subtitle:'', image:'', link:'' });
      renderCarouselEdit();
    }

    function removeCarousel(i) {
      homeData.carousel.splice(i, 1);
      renderCarouselEdit();
    }

    async function saveCarousel() {
      const items = homeData.carousel || [];
      homeData.carousel = items.map((_, i) => ({
        id: i + 1,
        title:    document.getElementById('cr-title-'+i)?.value || '',
        subtitle: document.getElementById('cr-sub-'+i)?.value || '',
        image:    document.getElementById('cr-img-'+i)?.value || '',
        link:     document.getElementById('cr-link-'+i)?.value || '',
      }));
      await saveHome();
      renderCarouselView();
      toggleEdit('carousel');
      toast('✅ 輪播圖已儲存');
    }

    // ── CONTACT ──
    function renderContactView() {
      const c = homeData?.contact || {};
      const fields = [
        { label:'地址', val: c.address },
        { label:'電話', val: c.phone },
        { label:'Email', val: c.email },
        { label:'Facebook', val: c.facebook },
        { label:'Instagram', val: c.instagram },
        { label:'YouTube', val: c.youtube },
      ].filter(f => f.val);
      document.getElementById('preview-contact').innerHTML = fields.map(f => \`
        <div class="preview-contact-item">
          <div class="preview-contact-label">\${f.label}</div>
          <div class="preview-contact-value">\${f.val}</div>
        </div>
      \`).join('');
    }

    function renderContactEdit() {
      const c = homeData?.contact || {};
      ['address','phone','email','facebook','instagram','youtube','threads'].forEach(k => {
        const el = document.getElementById('c-'+k);
        if (el) el.value = c[k] || '';
      });
    }

    async function saveContact() {
      homeData.contact = {
        address:   document.getElementById('c-address')?.value || '',
        phone:     document.getElementById('c-phone')?.value || '',
        email:     document.getElementById('c-email')?.value || '',
        facebook:  document.getElementById('c-facebook')?.value || '',
        instagram: document.getElementById('c-instagram')?.value || '',
        youtube:   document.getElementById('c-youtube')?.value || '',
        threads:   document.getElementById('c-threads')?.value || '',
      };
      await saveHome();
      renderContactView();
      toggleEdit('contact');
      toast('✅ 聯絡資訊已儲存');
    }

    // ── Save home.json ──
    async function saveHome() {
      const r = await fetch('/api/content/home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(homeData)
      });
      if (!r.ok) throw new Error('儲存失敗');
    }

    // ── CALENDAR ──
    async function loadCalendar() {
      try {
        const { files } = await fetch('/api/calendar/list').then(r => r.json());
        const events = await Promise.all(files.map(f =>
          fetch('/api/content/calendar/' + f).then(r => r.json()).then(d => ({ ...d, _file: f }))
        ));
        events.sort((a,b) => (a.date||'').localeCompare(b.date||''));
        const el = document.getElementById('preview-calendar');
        if (!events.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div>尚無活動</div>'; return; }
        el.innerHTML = events.map(e => \`
          <div class="preview-event">
            <span class="event-date-badge">\${(e.date||'').slice(0,10)}</span>
            <span class="event-title">\${e.title||''}</span>
            <span class="event-cat">\${e.category||''}</span>
          </div>
        \`).join('');
      } catch(err) { console.error(err); }
    }

    function showNewEventForm() {
      const f = document.getElementById('new-event-form');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
    }

    async function saveNewEvent() {
      const title = document.getElementById('ev-title').value.trim();
      const date  = document.getElementById('ev-date').value;
      if (!title || !date) { toast('請填寫活動名稱和開始日期', 'error'); return; }
      const data = {
        title,
        date,
        end_date:    document.getElementById('ev-end-date').value || date,
        description: document.getElementById('ev-desc').value,
        category:    document.getElementById('ev-category').value || '活動',
      };
      const filename = 'calendar/' + date + '-' + title + '.json';
      await fetch('/api/content/' + encodeURIComponent(filename), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      toast('✅ 活動已新增');
      document.getElementById('new-event-form').style.display = 'none';
      ['ev-title','ev-date','ev-end-date','ev-desc','ev-category'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      loadCalendar();
    }

    // ── NEWSLETTERS ──
    async function loadNewsletters() {
      try {
        const { files } = await fetch('/api/newsletters/list').then(r => r.json());
        const nls = await Promise.all(files.map(f =>
          fetch('/api/content/newsletters/' + f).then(r => r.json())
        ));
        nls.sort((a,b) => parseInt(b.issue||0) - parseInt(a.issue||0));
        const el = document.getElementById('preview-newsletters');
        if (!nls.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div>尚無學刊</div>'; return; }
        el.innerHTML = nls.map(n => \`
          <div class="preview-nl">
            <div class="preview-nl-cover">
              \${n.cover ? \`<img src="\${n.cover}" onerror="this.style.display='none'">\` : '📖'}
            </div>
            <div class="preview-nl-info">
              <div class="preview-nl-issue">第\${n.issue}期</div>
              <div class="preview-nl-sem">\${n.semester||''}</div>
            </div>
          </div>
        \`).join('');
      } catch(err) { console.error(err); }
    }

    function showNewNewsletterForm() {
      const f = document.getElementById('new-nl-form');
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
    }

    async function saveNewNewsletter() {
      const issue = document.getElementById('nl-issue').value.trim();
      if (!issue) { toast('請填寫期數', 'error'); return; }
      const data = {
        issue,
        title:    document.getElementById('nl-title').value || '第'+issue+'期',
        semester: document.getElementById('nl-semester').value,
        cover:    document.getElementById('nl-cover').value,
        imagePrefix: 'https://raw.githubusercontent.com/mingcareercounseling-design/waldorf-newsletter-images/main/NO'+issue+'-',
        pageCount: 20, pageDigits: 2, pageFormat: 'jpg',
        date:     document.getElementById('nl-date').value,
      };
      await fetch('/api/content/newsletters/NO' + issue + '.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      toast('✅ 學刊已新增');
      document.getElementById('new-nl-form').style.display = 'none';
      loadNewsletters();
    }

    // ── Init ──
    loadHome();
    loadCalendar();
    loadNewsletters();
  </script>
</body>
</html>`;

// Start server
app.listen(PORT, () => {
  console.log(`\n🌿 光禾華德福 後台管理系統`);
  console.log(`🌐 Admin panel: http://localhost:${PORT}`);
  console.log(`📁 Project: ${PROJECT_DIR}`);
  console.log(`✅ Ready!\n`);
});

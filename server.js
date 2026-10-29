const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const os = require('os');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'shetuandabao-secret-key-2024';
const SERVER_STARTED_AT = new Date().toISOString();
// 前后端同源版本号：改代码时同步更新，/api/health、/api/system/info、页面页脚均可核对
const SERVER_VERSION = '2026-10-29c';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
// HTML 页面禁止缓存：防止浏览器拿着旧版前端（旧逻辑/旧弹窗）访问新服务端
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  },
}));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const configPath = path.join(dataDir, 'config.json');
const defaultConfig = {
  api_key: '',
  base_url: 'https://api.deepseek.com/v1',
  model_name: 'deepseek-chat',
  temperature: 0.7,
  max_tokens: 2000,
};

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('加载配置失败:', e.message);
  }
  return { ...defaultConfig };
}

// 原子写 JSON：先写临时文件再 rename，避免写一半被读到或进程中断留下残缺文件
function atomicWriteJson(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, content, 'utf8');
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // 个别挂载方式（网络盘/特殊卷）不支持覆盖式 rename：回退为直接写
    fs.writeFileSync(filePath, content, 'utf8');
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

function saveConfig(config) {
  atomicWriteJson(configPath, config);
}

if (!fs.existsSync(configPath)) {
  saveConfig(defaultConfig);
}

const bcrypt = require('bcryptjs');

const usersPath = path.join(dataDir, 'users.json');
const historyPath = path.join(dataDir, 'history.json');
const exportsDir = path.join(dataDir, 'exports');

if (!fs.existsSync(usersPath)) {
  fs.writeFileSync(usersPath, '[]', 'utf8');
}
if (!fs.existsSync(historyPath)) {
  fs.writeFileSync(historyPath, '[]', 'utf8');
}
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  atomicWriteJson(usersPath, users);
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  atomicWriteJson(historyPath, history);
}

// ====== 教学过程"图文并茂"标记处理 ======
// 文本中的照片占位标记统一为 [图N]（N=1..照片数），docx 导出/前端预览/打印均按此解析
const PHOTO_MARKER_RE = /\[图(\d+)\]/g;
const PHOTO_MARKER_VARIANT_RE = /[【\[]\s*(?:图|图片|照片)\s*(\d+)\s*[】\]]/g;

function normalizePhotoMarkers(text, photoCount) {
  if (!text) return '';
  let out = text.replace(PHOTO_MARKER_VARIANT_RE, (m, n) => `[图${n}]`);
  // 越界标记（超出照片数量）直接移除
  out = out.replace(PHOTO_MARKER_RE, (m, n) => (Number(n) >= 1 && Number(n) <= photoCount) ? m : '');
  return out;
}

// 把教学过程文本解析为顺序块：{type:'text',text} 与 {type:'image',n}
function parseProcessBlocks(text) {
  const blocks = [];
  const paragraphs = String(text || '').split(/\n\s*\n/);
  for (const para of paragraphs) {
    const parts = para.split(PHOTO_MARKER_RE);
    // split 带捕获组时，奇数下标是标记的数字
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        const t = parts[i].replace(/\s*\n\s*/g, ' ').trim();
        if (t) blocks.push({ type: 'text', text: t });
      } else {
        blocks.push({ type: 'image', n: Number(parts[i]) });
      }
    }
  }
  return blocks;
}

// 补上文本中没引用到的照片，保证所有上传照片都出现在排版里
function appendUnreferencedPhotos(blocks, photoCount) {
  const used = new Set(blocks.filter(b => b.type === 'image').map(b => b.n));
  const extra = [];
  for (let n = 1; n <= photoCount; n++) {
    if (!used.has(n)) extra.push({ type: 'image', n });
  }
  return extra;
}

// 从 PNG/JPEG 二进制头解析原始尺寸（docx 嵌入需要保持宽高比）
function getImageSize(buf, mime) {
  try {
    if (mime === 'image/png' && buf.length > 24) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg') {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const m = buf[off + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
        }
        off += 2 + buf.readUInt16BE(off + 2);
      }
    }
  } catch {}
  return null;
}

// docx 内图片显示尺寸：等比缩放到不超 maxWidth/maxHeight（单位为 docx 像素 ≈ 96dpi）
function fitImageSize(width, height, maxWidth = 440, maxHeight = 400) {
  if (!width || !height) return { width: maxWidth, height: Math.round(maxWidth * 0.75) };
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// 整页容纳图片的等比缩放（允许放大，用于签到表铺满 A4）。
// A4≈794x1123px@96dpi，取略小值防止舍入把图片挤到第二页
function fitPageImageSize(width, height, maxWidth = 780, maxHeight = 1100) {
  if (!width || !height) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// ====== 历史记录排序键：sortOrder(手动拖动排序)优先，否则按时间倒序派生 ======
// 显示时间(createdAt)与卡片位置(sortOrder)解耦：改时间不移动卡片，拖动不改显示时间。
// 派生键取 -时间戳：时间越新键越小，列表升序排列时越靠前（顶部）。
function sortKeyOf(r) {
  if (typeof r.sortOrder === 'number' && isFinite(r.sortOrder)) return r.sortOrder;
  const t = new Date(r.createdAt).getTime();
  return -(isNaN(t) ? 0 : t);
}

// ====== 数据写互斥：串行化所有「读-改-写」操作 ======
// POST /api/export 的 读history → 生成docx/zip(有await) → 写history 之间，
// 事件循环会放行其他请求；若两个请求同时处于该窗口，后写者会用旧快照覆盖
// 先写者的数据（表现为"导入/提交显示成功，刷新后记录消失"）。
// 所有会修改 history/users 的端点都必须通过 runExclusive 执行。
let dataQueue = Promise.resolve();
function runExclusive(fn) {
  const run = dataQueue.then(fn, fn);
  // 队列自身不携带错误状态，错误由各请求自己的 try/catch 处理
  dataQueue = run.then(() => {}, () => {});
  return run;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未提供认证令牌' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '令牌无效或已过期' });
    req.user = user;
    next();
  });
}

function authenticateUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ error: '请先登录' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded.userId) return res.status(403).json({ error: '登录已过期' });
    req.user = decoded;
    next();
  });
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请提供用户名和密码' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6个字符' });
  }

  try {
    const result = await runExclusive(async () => {
      const users = loadUsers();
      if (users.find(u => u.username === username)) {
        return { conflict: true };
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = {
        id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        username,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      saveUsers(users);
      return { newUser };
    });

    if (result.conflict) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    const token = jwt.sign({ userId: result.newUser.id, username: result.newUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, userId: result.newUser.id, username: result.newUser.username });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ error: '注册失败: ' + error.message });
  }
});

app.post('/api/user/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请提供用户名和密码' });
  }

  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, userId: user.id, username: user.username });
});

app.post('/api/export', authenticateUser, async (req, res) => {
  try {
    const { recordId: existingRecordId, topic, summary, teachingProcess, photos, signPhoto, createdAt: clientCreatedAt, sortOrder: clientSortOrder, importMode } = req.body;
    if (!topic || !summary) {
      return res.status(400).json({ error: '请提供课题名称和总结' });
    }
    // 正常提交流程必须带教学过程；合集包导入(importMode)放行——老版本系统的记录可能没有该字段
    if (!teachingProcess && !importMode) {
      return res.status(400).json({ error: '请提供教学过程描述' });
    }

    // 整段「读history → 生成docx/zip → 写history」必须持有数据锁串行执行，
    // 防止并发请求（多人同时提交/导入）用旧快照互相覆盖记录
    const locked = await runExclusive(async () => {
    const history = loadHistory();
    let record = null;
    let isEdit = false;

    if (existingRecordId) {
      record = history.find(h => h.id === existingRecordId && h.userId === req.user.userId);
      if (record) {
        isEdit = true;
      }
    }

    // 批量导入/编辑可传入 createdAt：新建用于还原原始时间；编辑用于显式改时间
    let providedDate = clientCreatedAt ? new Date(clientCreatedAt) : null;
    if (providedDate && isNaN(providedDate.getTime())) providedDate = null;
    // 编辑模式默认保留记录原时间（不再重置为当前时间，否则会打乱手动排好的顺序）
    let baseDate = providedDate;
    if (!baseDate && isEdit && record && record.createdAt) {
      const orig = new Date(record.createdAt);
      if (!isNaN(orig.getTime())) baseDate = orig;
    }
    if (!baseDate) baseDate = new Date();
    const date = baseDate.toISOString().slice(0, 10).replace(/-/g, '');
    const recordId = isEdit ? existingRecordId : ('h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const zipFileName = `${topic}_${date}_${recordId}.zip`;
    const userExportDir = path.join(exportsDir, req.user.userId);
    if (!fs.existsSync(userExportDir)) {
      fs.mkdirSync(userExportDir, { recursive: true });
    }

    // 如果是编辑模式，删除旧的 ZIP 文件
    if (isEdit && record.zipFileName) {
      const oldZipPath = path.join(userExportDir, record.zipFileName);
      if (fs.existsSync(oldZipPath)) {
        try {
          fs.unlinkSync(oldZipPath);
        } catch (err) {
          console.error('删除旧 ZIP 失败:', err.message);
        }
      }
    }

    const JSZip = require('jszip');
    const { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun } = require('docx');
    const zip = new JSZip();
    const folder = zip.folder(`${topic}_${date}`);

    const cleanedSummary = summary.replace(/\*\*(.+?)\*\*/g, '$1').replace(/##+\s*/g, '').trim();
    const paragraphs = cleanedSummary.split(/\n\s*\n/).filter(p => p.trim());

    const docChildren = [
      new Paragraph({
        children: [new TextRun({ text: topic, bold: true, size: 32, font: '黑体' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({
          text: baseDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
          size: 24, font: '宋体', color: '888888',
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    ];

    for (const para of paragraphs) {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 28, font: '宋体' })],
        spacing: { after: 0, line: 360 },
        indent: { firstLine: 480 },
      }));
    }

    const doc = new Document({
      sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 } } }, children: docChildren }],
    });

    const docxBuffer = await Packer.toBuffer(doc);
    folder.file('学习成果总结.docx', docxBuffer);

    // 导入的老记录若连内层 docx 都没有教学过程文本，落库时给占位说明，避免空 docx
    const processText = (teachingProcess && String(teachingProcess).trim())
      ? teachingProcess
      : '（导入的原始记录未包含教学过程描述）';

    const cleanedProcess = normalizePhotoMarkers(
      processText.replace(/\*\*(.+?)\*\*/g, '$1').replace(/##+\s*/g, '').trim(),
      (photos ? photos.length : 0)
    );

    // 构建教学过程图文段落的闭包：教学过程设计.docx 与 本节材料.docx 各需独立构建
    // （docx 的 Paragraph/ImageRun 对象不可跨 Document 复用）
    const makeProcessDocChildren = () => {
    const processDocChildren = [
      new Paragraph({
        children: [new TextRun({ text: topic + ' - 教学过程设计', bold: true, size: 32, font: '黑体' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({
          text: baseDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
          size: 24, font: '宋体', color: '888888',
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    ];

    // 图文排版：文本块正常成段；[图N] 标记替换为居中图片 + 图注；未引用的照片补在文末
    const docPhotos = [];
    if (photos && photos.length) {
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const dataUrl = String(p.data || '');
        const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const isPng = /^iVBOR/.test(b64) || /\.png$/i.test(p.name || '');
        docPhotos.push({
          buffer: Buffer.from(b64, 'base64'),
          mime: isPng ? 'image/png' : 'image/jpeg',
          caption: p.caption || '',
        });
      }
    }
    const processBlocksBase = parseProcessBlocks(cleanedProcess);
    const processBlocks = processBlocksBase.concat(appendUnreferencedPhotos(processBlocksBase, docPhotos.length));

    for (const block of processBlocks) {
      if (block.type === 'text') {
        processDocChildren.push(new Paragraph({
          children: [new TextRun({ text: block.text, size: 28, font: '宋体' })],
          spacing: { after: 0, line: 360 },
          indent: { firstLine: 480 },
        }));
      } else {
        const photo = docPhotos[block.n - 1];
        if (!photo) continue;
        const natural = getImageSize(photo.buffer, photo.mime);
        const size = fitImageSize(natural?.width, natural?.height);
        processDocChildren.push(new Paragraph({
          children: [new ImageRun({
            type: photo.mime === 'image/png' ? 'png' : 'jpg',
            data: photo.buffer,
            transformation: size,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: photo.caption ? 40 : 120 },
        }));
        if (photo.caption) {
          processDocChildren.push(new Paragraph({
            children: [new TextRun({
              text: `图${block.n}：${photo.caption}`,
              size: 21, font: '宋体', color: '595959',
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }));
        }
      }
    }
    return processDocChildren;
    };

    const processDoc = new Document({
      sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 } } }, children: makeProcessDocChildren() }],
    });

    const processDocxBuffer = await Packer.toBuffer(processDoc);
    folder.file('教学过程设计.docx', processDocxBuffer);

    // ====== “教学过程/本节材料.docx”：与“一键打印本节材料”内容一致（图文教学过程 + 签到表独占整页 A4） ======
    const materialSections = [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 } } },
      children: makeProcessDocChildren(),
    }];
    if (signPhoto) {
      const signRaw = String(signPhoto.data || '');
      const signB64 = signRaw.includes(',') ? signRaw.split(',')[1] : signRaw;
      const signBuf = Buffer.from(signB64, 'base64');
      const signIsPng = /^iVBOR/.test(signB64) || /\.png$/i.test(signPhoto.name || '');
      const signNat = getImageSize(signBuf, signIsPng ? 'image/png' : 'image/jpeg');
      const signSize = fitPageImageSize(signNat && signNat.width, signNat && signNat.height);
      materialSections.push({
        // A4 = 11906 x 16838 twips，零边距让签到表铺满整页
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
        children: [new Paragraph({
          children: [new ImageRun({
            type: signIsPng ? 'png' : 'jpg',
            data: signBuf,
            transformation: signSize,
          })],
          alignment: AlignmentType.CENTER,
        })],
      });
    }
    const materialDoc = new Document({ sections: materialSections });
    folder.folder('教学过程').file('本节材料.docx', await Packer.toBuffer(materialDoc));

    if (photos && photos.length > 0) {
      const photoFolder = folder.folder('场景照片');
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const imgBuffer = Buffer.from(photo.data.split(',')[1], 'base64');
        const ext = photo.name.endsWith('.png') ? 'png' : 'jpg';
        photoFolder.file(`照片${i + 1}.${ext}`, imgBuffer);
        if (photo.caption) {
          photoFolder.file(`照片${i + 1}_说明.txt`, photo.caption);
        }
      }
    }

    if (signPhoto) {
      const signFolder = folder.folder('签到表');
      const signBuffer = Buffer.from(signPhoto.data.split(',')[1], 'base64');
      const signExt = signPhoto.name.endsWith('.png') ? 'png' : 'jpg';
      signFolder.file(`签到表.${signExt}`, signBuffer);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = path.join(userExportDir, zipFileName);
    fs.writeFileSync(zipPath, zipBuffer);

    if (isEdit) {
      record.topic = topic;
      record.summary = summary;
      record.teachingProcess = processText;
      record.photoCount = photos ? photos.length : 0;
      record.hasSignPhoto = !!signPhoto;
      record.zipFileName = zipFileName;
      record.createdAt = baseDate.toISOString(); // 编辑默认保留原时间（除非请求显式传入新时间）
      // 注意：record.sortOrder 不动，编辑不会改变卡片位置
    } else {
      const newRecord = {
        id: recordId,
        userId: req.user.userId,
        topic,
        summary,
        teachingProcess: processText,
        photoCount: photos ? photos.length : 0,
        hasSignPhoto: !!signPhoto,
        createdAt: baseDate.toISOString(),
        zipFileName,
      };
      // 合集包导入时可带 sortOrder，迁移后保持源端的卡片顺序
      if (typeof clientSortOrder === 'number' && isFinite(clientSortOrder)) {
        newRecord.sortOrder = clientSortOrder;
      }
      history.push(newRecord);
    }
    saveHistory(history);

    // 返回实际落库的记录，前端导入后可据此核对持久化结果
    const savedRecord = isEdit ? record : history[history.length - 1];
    return { isEdit, recordId, savedRecord };
    }); // end runExclusive

    res.json({
      message: locked.isEdit ? '更新成功' : '导出成功',
      recordId: locked.recordId,
      record: locked.savedRecord,
      downloadUrl: `/api/export/${locked.recordId}/download`,
    });
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ error: '导出失败: ' + error.message });
  }
});

// 一键下载所有 ZIP 包：把当前用户全部导出记录打成一个合集 ZIP（内含各记录原始 ZIP + 导入清单.json）
app.get('/api/export/download-all', authenticateUser, async (req, res) => {
  try {
    const history = loadHistory();
    const userRecords = history
      .filter(h => h.userId === req.user.userId)
      .sort((a, b) => (sortKeyOf(a) - sortKeyOf(b)) || (new Date(a.createdAt) - new Date(b.createdAt))); // 按用户排列的卡片顺序打包，导入后顺序一致

    if (userRecords.length === 0) {
      return res.status(404).json({ error: '暂无导出记录，无法打包下载' });
    }

    const JSZip = require('jszip');
    const outerZip = new JSZip();
    const manifestRecords = [];
    let missingCount = 0;

    for (const record of userRecords) {
      const zipPath = path.join(exportsDir, req.user.userId, record.zipFileName);
      if (!fs.existsSync(zipPath)) {
        missingCount++;
        continue;
      }
      // 原样嵌入原始 ZIP（逐字节一致，导入时可完整还原）
      outerZip.file(record.zipFileName, fs.readFileSync(zipPath));
      manifestRecords.push({
        zipFileName: record.zipFileName,
        recordId: record.id,
        topic: record.topic,
        summary: record.summary,
        teachingProcess: record.teachingProcess || '', // 老版本记录可能没有该字段
        photoCount: record.photoCount,
        hasSignPhoto: record.hasSignPhoto,
        createdAt: record.createdAt,
        sortOrder: typeof record.sortOrder === 'number' ? record.sortOrder : undefined, // 手动排序信息，导入后还原位置
      });
    }

    if (manifestRecords.length === 0) {
      return res.status(404).json({ error: 'ZIP 文件均已丢失，无法打包下载' });
    }

    outerZip.file('导入清单.json', JSON.stringify({
      app: 'shetuandabao',
      manifestVersion: 1,
      exportedAt: new Date().toISOString(),
      totalRecords: manifestRecords.length,
      missingZipCount: missingCount,
      records: manifestRecords,
    }, null, 2));

    // 内层 ZIP 已经是压缩格式，外层用 STORE 避免重复压缩耗时
    const bundleBuffer = await outerZip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.set('Content-Type', 'application/zip');
    res.attachment(`全部导出记录_${date}.zip`);
    res.send(bundleBuffer);
  } catch (error) {
    console.error('Download-all error:', error.message);
    res.status(500).json({ error: '打包下载失败: ' + error.message });
  }
});

app.get('/api/export/:recordId/download', authenticateUser, (req, res) => {
  const history = loadHistory();
  const record = history.find(h => h.id === req.params.recordId && h.userId === req.user.userId);
  if (!record) return res.status(404).json({ error: '记录不存在' });

  const zipPath = path.join(exportsDir, req.user.userId, record.zipFileName);
  if (!fs.existsSync(zipPath)) return res.status(404).json({ error: 'ZIP 文件已丢失' });

  res.download(zipPath, record.zipFileName);
});

app.get('/api/history', authenticateUser, (req, res) => {
  const history = loadHistory();
  const userHistory = history
    .filter(h => h.userId === req.user.userId)
    .sort((a, b) => (sortKeyOf(a) - sortKeyOf(b)) || (new Date(b.createdAt) - new Date(a.createdAt)));
  res.json(userHistory);
});

app.delete('/api/history/:recordId', authenticateUser, (req, res) => {
  runExclusive(() => {
    const history = loadHistory();
    const index = history.findIndex(h => h.id === req.params.recordId && h.userId === req.user.userId);
    if (index === -1) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }

    const record = history[index];
    const zipPath = path.join(exportsDir, req.user.userId, record.zipFileName);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    history.splice(index, 1);
    saveHistory(history);
    res.json({ message: '已删除' });
  }).catch(error => {
    console.error('Delete history error:', error.message);
    res.status(500).json({ error: '删除失败: ' + error.message });
  });
});

// 修改记录显示时间（只改显示，不移动卡片位置——位置由拖动排序决定）
app.put('/api/history/:recordId/date', authenticateUser, (req, res) => {
  const d = (req.body && req.body.createdAt) ? new Date(req.body.createdAt) : null;
  if (!d || isNaN(d.getTime())) return res.status(400).json({ error: '无效的时间' });

  runExclusive(() => {
    const history = loadHistory();
    const record = history.find(h => h.id === req.params.recordId && h.userId === req.user.userId);
    if (!record) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    // 若该记录还没有固定位置（sortOrder），先冻结当前位置，保证改时间后卡片不动
    if (typeof record.sortOrder !== 'number') {
      record.sortOrder = sortKeyOf(record);
    }
    record.createdAt = d.toISOString();
    saveHistory(history);
    res.json({ message: '时间已更新', record });
  }).catch(error => {
    console.error('Update date error:', error.message);
    res.status(500).json({ error: '修改时间失败: ' + error.message });
  });
});

// 卡片拖动排序：order 为自上而下的记录 id 序列，服务端按此顺序分配严格递增的排序键
app.post('/api/history/reorder', authenticateUser, (req, res) => {
  const raw = (req.body && Array.isArray(req.body.order)) ? req.body.order : null;
  if (!raw || raw.length === 0) return res.status(400).json({ error: '请提供记录顺序' });

  runExclusive(() => {
    const history = loadHistory();
    const mine = history.filter(h => h.userId === req.user.userId);
    const byId = new Map(mine.map(h => [h.id, h]));
    const seq = [];
    const seen = new Set();
    for (const id of raw.map(String)) {
      if (byId.has(id) && !seen.has(id)) { seen.add(id); seq.push(byId.get(id)); }
    }
    if (seq.length === 0) {
      res.status(400).json({ error: '没有可排序的记录' });
      return;
    }
    // 保证排序键自上而下严格递增：只调整违反顺序的记录，改动最小化
    let changed = 0;
    let prev = -Infinity;
    for (const rec of seq) {
      let k = sortKeyOf(rec);
      if (k <= prev) { k = prev + 1; rec.sortOrder = k; changed++; }
      prev = k;
    }
    if (changed > 0) saveHistory(history);
    res.json({ message: '顺序已保存', updated: changed });
  }).catch(error => {
    console.error('Reorder error:', error.message);
    res.status(500).json({ error: '保存顺序失败: ' + error.message });
  });
});

// 实例信息：用于诊断「导入时显示成功、刷新后消失」类问题。
// 若导入前后 hostname/pid/启动时间发生变化，说明浏览器连到了不同的服务实例
// （例如 3000 端口本地实例与 7794 端口 Docker 实例混用，两者数据目录不同）。
app.get('/api/system/info', authenticateUser, (req, res) => {
  const history = loadHistory();
  res.json({
    version: SERVER_VERSION,
    hostname: os.hostname(),
    pid: process.pid,
    serverStartedAt: SERVER_STARTED_AT,
    uptimeSec: Math.floor(process.uptime()),
    dataDir,
    historyTotalCount: history.length,
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign({ username: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

app.get('/api/config', authenticateToken, (req, res) => {
  const config = loadConfig();
  res.json(config);
});

app.put('/api/config', authenticateToken, (req, res) => {
  const { api_key, base_url, model_name, temperature, max_tokens } = req.body;
  const config = {
    // trim 防止复制粘贴带入的首尾空格/换行导致大模型 401
    api_key: typeof api_key === 'string' ? api_key.trim() : api_key,
    base_url: (base_url || defaultConfig.base_url).trim(),
    model_name: (model_name || defaultConfig.model_name).trim(),
    temperature: temperature ?? defaultConfig.temperature,
    max_tokens: max_tokens ?? defaultConfig.max_tokens,
  };
  saveConfig(config);
  res.json({ message: '配置已保存' });
});

app.post('/api/llm/summarize', authenticateToken, async (req, res) => {
  try {
    const { topic, draft } = req.body;
    if (!topic) return res.status(400).json({ error: '请提供课题内容' });

    const config = loadConfig();
    if (!config.api_key) {
      return res.status(400).json({ error: '请先在管理后台配置大模型 API Key' });
    }

    const openai = new OpenAI({
      apiKey: config.api_key,
      baseURL: config.base_url,
    });

    let userContent = `本次社团活动的课题是：${topic}。`;
    if (draft) {
      userContent += `\n\n以下是教师已填写的草稿内容，请在此基础上优化完善，保持原有信息和风格：\n\n${draft}`;
    }
    userContent += '\n\n请生成学习成果总结。';

    const response = await openai.chat.completions.create({
      model: config.model_name,
      messages: [
        {
          role: 'system',
          content: `你是一位农村高中信息技术教师。请根据用户提供的课题内容和草稿，生成一段学习成果总结。

要求：
1. 不要使用任何Markdown格式（不要用**、##、*等符号）
2. 语言朴实自然，像一线教师手写的工作记录，不要有AI腔调
3. 内容精简，控制在200字以内
4. 结合农村高中学生的实际情况，不要写得太高端
5. 用纯文本段落形式输出，不要分标题
6. 如果用户提供了草稿，必须参考草稿中的具体信息（如学生表现、课堂活动等），不能仅从课题标题凭空生成

输出格式示例：
本次课学生学习了XXX内容。大部分同学能够XXX，部分同学在XXX方面还需要加强。课堂上学生通过XXX方式完成了练习，整体学习氛围较好。下节课将继续巩固XXX内容。`,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    });

    const summary = response.choices[0]?.message?.content || '';
    res.json({ summary });
  } catch (error) {
    console.error('LLM API Error:', error.message);
    res.status(500).json({ error: `大模型调用失败: ${error.message}` });
  }
});

app.post('/api/llm/generate-process', authenticateToken, async (req, res) => {
  try {
    const { topic, summary, photoCaptions } = req.body;
    if (!topic) return res.status(400).json({ error: '请提供课题内容' });
    if (!summary) return res.status(400).json({ error: '请提供学习成果总结' });

    const config = loadConfig();
    if (!config.api_key) {
      return res.status(400).json({ error: '请先在管理后台配置大模型 API Key' });
    }

    const openai = new OpenAI({
      apiKey: config.api_key,
      baseURL: config.base_url,
    });

    // 照片清单（可带说明）；提供了才启用图文标记模式
    const captions = Array.isArray(photoCaptions)
      ? photoCaptions.map(c => String(c || '').trim())
      : null;
    const hasPhotos = captions && captions.length > 0;

    const markerRules = hasPhotos ? `
8. 本次课堂实拍照片共 ${captions.length} 张（清单见下）。必须在教学过程中与内容最匹配的环节插入对应照片标记，格式为 [图1]、[图2]……以此类推
9. 每张照片的标记在教学过程中恰好出现一次，标记必须单独占一行，前后各留一个空行
10. 标记在最终排版时会被替换为真实照片，因此除自然表述（如"如图"）外不要围绕标记添加多余说明文字` : '';

    const photoList = hasPhotos ? `
课堂实拍照片清单（共 ${captions.length} 张）：
${captions.map((c, i) => `图${i + 1}：${c || '（未填写说明）'}`).join('\n')}` : '';

    const response = await openai.chat.completions.create({
      model: config.model_name,
      messages: [
        {
          role: 'system',
          content: `你是一位农村高中信息技术教师。请根据用户提供的课题内容和学习成果总结，生成一份详细的教学过程描述。

要求：
1. 不要使用任何Markdown格式（不要用**、##、*等符号）
2. 语言朴实自然，像一线教师手写的教学设计，不要有AI腔调
3. 内容控制在500字以内
4. 结合农村高中学生的实际情况，不要写得太高端
5. 用纯文本段落形式输出，不要分标题
6. 教学过程应包含以下环节：课堂导入、新课讲授、学生实践操作、总结评价
7. 必须参考学习成果总结中的具体信息来设计教学过程，不能仅从课题标题凭空生成${markerRules}

输出格式示例：
本节课首先通过XXX案例/问题导入，激发学生学习兴趣。在新课讲授环节，教师通过XXX方式讲解XXX知识点，学生能较好地理解XXX。实践操作环节，学生分组完成了XXX任务，教师巡视指导了XXX方面的问题。最后通过XXX方式进行总结评价，大部分学生达到了学习目标。`,
        },
        {
          role: 'user',
          content: `本次社团活动的课题是：${topic}。

学生的学习成果总结：${summary}
${photoList}
请根据以上内容生成教学过程描述。`,
        },
      ],
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    });

    let process = response.choices[0]?.message?.content || '';

    // 归一化 AI 输出的照片标记：统一为 [图N]，越界的移除，遗漏的补到文末
    if (hasPhotos) {
      process = normalizePhotoMarkers(process, captions.length);
      const existing = new Set();
      PHOTO_MARKER_RE.lastIndex = 0;
      let m;
      while ((m = PHOTO_MARKER_RE.exec(process)) !== null) existing.add(Number(m[1]));
      const missing = [];
      for (let n = 1; n <= captions.length; n++) {
        if (!existing.has(n)) missing.push(`[图${n}]`);
      }
      if (missing.length) {
        process = process.trimEnd() + '\n\n课堂照片：\n\n' + missing.join('\n\n');
      }
    }

    res.json({ process });
  } catch (error) {
    console.error('LLM API Error:', error.message);
    res.status(500).json({ error: `大模型调用失败: ${error.message}` });
  }
});

app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: SERVER_VERSION, startedAt: SERVER_STARTED_AT });
});

app.listen(PORT, () => {
  console.log(`氛围编程社团资料系统已启动: http://localhost:${PORT}`);
  console.log(`管理后台: http://localhost:${PORT}/admin.html`);
});

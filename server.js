const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'shetuandabao-secret-key-2024';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
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
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
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

  const users = loadUsers();
  if (users.find(u => u.username === username)) {
    return res.status(409).json({ error: '用户名已存在' });
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

  const token = jwt.sign({ userId: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, userId: newUser.id, username: newUser.username });
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
    const { recordId: existingRecordId, topic, summary, photos, signPhoto } = req.body;
    if (!topic || !summary) {
      return res.status(400).json({ error: '请提供课题名称和总结' });
    }

    const history = loadHistory();
    let record = null;
    let isEdit = false;

    if (existingRecordId) {
      record = history.find(h => h.id === existingRecordId && h.userId === req.user.userId);
      if (record) {
        isEdit = true;
      }
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
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
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
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
          text: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
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
      record.photoCount = photos ? photos.length : 0;
      record.hasSignPhoto = !!signPhoto;
      record.zipFileName = zipFileName;
      record.createdAt = new Date().toISOString(); // 更新修改时间
    } else {
      const newRecord = {
        id: recordId,
        userId: req.user.userId,
        topic,
        summary,
        photoCount: photos ? photos.length : 0,
        hasSignPhoto: !!signPhoto,
        createdAt: new Date().toISOString(),
        zipFileName,
      };
      history.push(newRecord);
    }
    saveHistory(history);

    res.json({ message: isEdit ? '更新成功' : '导出成功', recordId, downloadUrl: `/api/export/${recordId}/download` });
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ error: '导出失败: ' + error.message });
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
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(userHistory);
});

app.delete('/api/history/:recordId', authenticateUser, (req, res) => {
  const history = loadHistory();
  const index = history.findIndex(h => h.id === req.params.recordId && h.userId === req.user.userId);
  if (index === -1) return res.status(404).json({ error: '记录不存在' });

  const record = history[index];
  const zipPath = path.join(exportsDir, req.user.userId, record.zipFileName);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  history.splice(index, 1);
  saveHistory(history);
  res.json({ message: '已删除' });
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
    api_key: api_key,
    base_url: base_url || defaultConfig.base_url,
    model_name: model_name || defaultConfig.model_name,
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

app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`氛围编程社团资料系统已启动: http://localhost:${PORT}`);
  console.log(`管理后台: http://localhost:${PORT}/admin.html`);
});

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

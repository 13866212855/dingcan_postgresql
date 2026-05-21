# 氛围编程 · 社团资料收集系统

农村高中编程社团活动资料收集与管理工具，支持课题记录、照片上传、签到表归档、AI 辅助生成学习成果总结，一键导出标准化 ZIP 档案包。

## 快速开始

### 环境要求
- Node.js 18+

### 本地开发

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

启动后访问：
- 资料收集页：http://localhost:3000
- 管理后台：http://localhost:3000/admin.html（admin / admin123）

### Docker 部署

```bash
# 构建镜像
docker build -t shetuandabao:latest .

# 运行容器
docker run -d -p 7794:3000 --name shetuandabao --restart unless-stopped shetuandabao:latest
```

## 功能特点

- **课题记录** — 输入本次社团活动的主要内容
- **照片上传** — 拖拽上传场景照片（至少2张），自动压缩，支持添加说明
- **签到表归档** — 上传签到表照片
- **AI 辅助总结** — 调用大模型（DeepSeek/OpenAI 等）自动生成学习成果总结，支持参考已有草稿优化
- **一键导出** — 打包为 ZIP，含 Word 格式总结文档（符合中文公文格式）

## 技术栈

- **后端**：Node.js + Express + JWT 认证
- **前端**：原生 HTML/CSS/JS，JSZip（ZIP 打包），docx（Word 生成）
- **配置存储**：JSON 文件（data/config.json）
- **大模型**：兼容 OpenAI API 格式（DeepSeek、OpenAI、硅基流动等）

## 目录结构

```
shetuandabao/
├── public/
│   ├── index.html          # 资料收集页
│   └── admin.html          # 管理后台
├── data/
│   └── config.json         # 大模型配置
├── server.js               # Express 后端
├── package.json
├── Dockerfile
├── restart.bat             # 本地启动脚本
├── redeploy.bat            # Docker 部署脚本
└── api.md                  # API 接口文档
```

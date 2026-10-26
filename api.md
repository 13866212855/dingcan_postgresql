# 氛围编程 · 社团资料收集系统 API 文档

## 概述

本系统提供社团资料收集与管理功能，包括管理员认证、大模型配置管理、AI 辅助生成学习成果总结等接口。

## 基础信息

- **基础 URL**：`http://localhost:3000/api`
- **认证方式**：JWT Bearer Token
- **数据格式**：JSON

## 认证

### 管理员登录

**请求**
- **URL**：`POST /api/login`
- **请求头**：
  ```
  Content-Type: application/json
  ```
- **请求体**：
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```

**响应**
- **成功 (200)**：
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **失败 (401)**：
  ```json
  {
    "error": "用户名或密码错误"
  }
  ```

> 获取 token 后，后续请求需在请求头中添加：`Authorization: Bearer <token>`

## 接口列表

### 配置管理

#### 获取大模型配置

**请求**
- **URL**：`GET /api/config`
- **请求头**：
  ```
  Authorization: Bearer <token>
  ```

**响应**
- **成功 (200)**：
  ```json
  {
    "api_key": "sk-xxx",
    "base_url": "https://api.deepseek.com/v1",
    "model_name": "deepseek-chat",
    "temperature": 0.7,
    "max_tokens": 2000
  }
  ```

#### 更新大模型配置

**请求**
- **URL**：`PUT /api/config`
- **请求头**：
  ```
  Content-Type: application/json
  Authorization: Bearer <token>
  ```
- **请求体**：
  ```json
  {
    "api_key": "sk-xxx",
    "base_url": "https://api.deepseek.com/v1",
    "model_name": "deepseek-chat",
    "temperature": 0.7,
    "max_tokens": 2000
  }
  ```

**响应**
- **成功 (200)**：
  ```json
  {
    "message": "配置已保存"
  }
  ```

### AI 辅助

#### 生成学习成果总结

**请求**
- **URL**：`POST /api/llm/summarize`
- **请求头**：
  ```
  Content-Type: application/json
  Authorization: Bearer <token>
  ```
- **请求体**：
  ```json
  {
    "topic": "Python基础语法与变量",
    "draft": "可选：教师已填写的草稿内容"
  }
  ```

**响应**
- **成功 (200)**：
  ```json
  {
    "summary": "本次课学生学习了Python基础语法..."
  }
  ```
- **失败 (400)**：
  ```json
  {
    "error": "请先在管理后台配置大模型 API Key"
  }
  ```
- **失败 (500)**：
  ```json
  {
    "error": "大模型调用失败: ..."
  }
  ```

### 系统

#### 健康检查

**请求**
- **URL**：`GET /api/health`

**响应**
- **成功 (200)**：
  ```json
  {
    "status": "ok"
  }
  ```

## 用户认证

### 用户注册

**请求**
- **URL**: `POST /api/register`
- **请求体**:
  ```json
  {
    "username": "zhangsan",
    "password": "123456"
  }
  ```

**响应**
- **成功 (201)**:
  ```json
  {
    "token": "eyJhbGci...",
    "userId": "u_abc123",
    "username": "zhangsan"
  }
  ```
- **失败 (400)**: `{"error": "请提供用户名和密码"}` 或 `{"error": "密码至少6个字符"}`
- **失败 (409)**: `{"error": "用户名已存在"}`

### 用户登录

**请求**
- **URL**: `POST /api/user/login`
- **请求体**:
  ```json
  {
    "username": "zhangsan",
    "password": "123456"
  }
  ```

**响应**
- **成功 (200)**: 同上
- **失败 (401)**: `{"error": "用户名或密码错误"}`

## 导出历史

### 保存导出记录

**请求**
- **URL**: `POST /api/export`
- **请求头**: `Authorization: Bearer <user_token>`
- **请求体**:
  ```json
  {
    "topic": "Python基础语法",
    "summary": "学习成果总结...",
    "teachingProcess": "教学过程描述...",
    "photos": [
      { "name": "photo1.jpg", "data": "data:image/jpeg;base64,...", "caption": "说明" }
    ],
    "signPhoto": { "name": "sign.jpg", "data": "data:image/jpeg;base64,..." },
    "createdAt": "2026-09-01T08:30:00.000Z"
  }
  ```

> `teachingProcess` 为必填；`createdAt` 可选，仅在新建记录时生效，用于导入合集包时还原记录的原始时间（不传则使用当前时间）。

**响应**
- **成功 (200)**:
  ```json
  {
    "message": "导出成功",
    "recordId": "h_def456",
    "downloadUrl": "/api/export/h_def456/download"
  }
  ```

### 获取历史记录

**请求**
- **URL**: `GET /api/history`
- **请求头**: `Authorization: Bearer <user_token>`

**响应**
- **成功 (200)**:
  ```json
  [
    {
      "id": "h_def456",
      "userId": "u_abc123",
      "topic": "Python基础语法",
      "summary": "学习成果总结...",
      "photoCount": 3,
      "hasSignPhoto": true,
      "createdAt": "2026-05-21T10:30:00.000Z",
      "zipFileName": "Python基础语法_20260521_h_def456.zip"
    }
  ]
  ```

### 下载历史 ZIP

**请求**
- **URL**: `GET /api/export/:recordId/download`
- **请求头**: `Authorization: Bearer <user_token>`

**响应**: ZIP 文件下载

### 一键下载所有 ZIP 包（合集包）

把当前用户的全部导出记录打成一个合集 ZIP，内含各记录的原始 ZIP 文件（逐字节一致）和一份 `导入清单.json`（记录元数据，供「导入所有ZIP包」还原）。

**请求**
- **URL**: `GET /api/export/download-all`
- **请求头**: `Authorization: Bearer <user_token>`

**响应**: 合集 ZIP 文件下载，结构如下：

```
全部导出记录_YYYYMMDD.zip
├── 课题A_20260901_h_xxx.zip      # 各记录的原始 ZIP
├── 课题B_20260915_h_yyy.zip
└── 导入清单.json                   # totalRecords / missingZipCount / records（含 topic、summary、teachingProcess、createdAt 等）
```

- **失败 (404)**: `{"error": "暂无导出记录，无法打包下载"}` 或 `{"error": "ZIP 文件均已丢失，无法打包下载"}`

> 配套的「导入所有ZIP包」在前端完成：解析合集包与 `导入清单.json`，与现有历史按「课题 + 创建时间」查重后，逐条调用 `POST /api/export`（携带原始 `createdAt`）完成导入。

### 删除历史记录

**请求**
- **URL**: `DELETE /api/history/:recordId`
- **请求头**: `Authorization: Bearer <user_token>`

**响应**
- **成功 (200)**: `{"message": "已删除"}`
- **失败 (404)**: `{"error": "记录不存在"}`

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未提供认证令牌 |
| 403 | 令牌无效或已过期 |
| 500 | 服务器内部错误 |

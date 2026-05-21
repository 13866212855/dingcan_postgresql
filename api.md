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

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未提供认证令牌 |
| 403 | 令牌无效或已过期 |
| 500 | 服务器内部错误 |

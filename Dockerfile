# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存
COPY package.json package-lock.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 运行阶段
FROM node:20-alpine

LABEL maintainer="氛围编程社团"
LABEL description="社团资料收集系统"

WORKDIR /app

# 使用 Alpine 镜像中自带的 node 用户 (UID 1000, GID 1000)

# 从构建阶段复制依赖和代码
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

# 设置目录权限给 node 用户
RUN chown -R node:node /app

# 切换到非 root 用户
USER node

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# 启动服务
CMD ["node", "server.js"]

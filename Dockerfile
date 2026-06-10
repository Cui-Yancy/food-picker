# ---- 今天吃什么？ ----
# 基于 Python 标准库的零依赖轻量 PWA

FROM python:3-slim

LABEL org.opencontainers.image.title="今天吃什么"
LABEL org.opencontainers.image.description="随机选餐 PWA，支持家庭局域网共享美食库"
LABEL org.opencontainers.image.source="https://github.com/yancy/choose_what_to_eat"

# 禁用 Python 字节码缓存（容器中无意义）
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 先复制核心文件（利用 Docker 缓存层）
COPY server.py .

# 复制静态资源
COPY index.html manifest.json service-worker.js ./
COPY css/ css/
COPY js/ js/
COPY icons/ icons/
COPY data/ data/

# 创建运行时目录（logs/ 和 run/ 会在首次启动时创建）
# 使用非 root 用户运行
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup --no-create-home appuser && \
    chown -R appuser:appgroup /app && \
    mkdir -p /app/data /app/logs /app/run && \
    chown -R appuser:appgroup /app/data /app/logs /app/run

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')" || exit 1

ENTRYPOINT ["python3", "server.py"]
CMD ["--host", "0.0.0.0", "--port", "8080"]

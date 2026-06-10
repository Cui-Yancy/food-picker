#!/usr/bin/env bash

set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8080}"
RUN_DIR="${PROJECT_DIR}/run"
LOG_DIR="${PROJECT_DIR}/logs"
PID_FILE="${RUN_DIR}/app.pid"
PORT_FILE="${RUN_DIR}/app.port"
LOG_FILE="${LOG_DIR}/app.log"

ensure_directories() {
  mkdir -p "${RUN_DIR}" "${LOG_DIR}"
}

read_pid() {
  if [[ -f "${PID_FILE}" ]]; then
    tr -d '[:space:]' < "${PID_FILE}"
  fi
}

is_running() {
  local pid="${1:-}"
  local command_line

  if ! [[ "${pid}" =~ ^[0-9]+$ ]] || ! kill -0 "${pid}" 2>/dev/null; then
    return 1
  fi

  command_line="$(tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null || true)"
  [[ "${command_line}" == *"-m http.server"* && "${command_line}" == *"${PROJECT_DIR}"* ]]
}

active_port() {
  if [[ -s "${PORT_FILE}" ]]; then
    tr -d '[:space:]' < "${PORT_FILE}"
  else
    printf '%s' "${PORT}"
  fi
}

remove_stale_pid() {
  local pid
  pid="$(read_pid)"

  if [[ -n "${pid}" ]] && ! is_running "${pid}"; then
    rm -f "${PID_FILE}" "${PORT_FILE}"
  fi
}

local_ip() {
  local ip=""

  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  if [[ -z "${ip}" ]] && command -v ip >/dev/null 2>&1; then
    ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
  fi

  printf '%s' "${ip:-127.0.0.1}"
}

port_is_busy() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)$PORT$"
    return
  fi

  return 1
}

start_service() {
  local pid

  ensure_directories
  remove_stale_pid
  pid="$(read_pid)"

  if is_running "${pid}"; then
    echo "服务已在运行，PID: ${pid}"
    echo "访问地址: http://$(local_ip):$(active_port)"
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "启动失败：未找到 python3，请先安装 Python 3。" >&2
    return 1
  fi

  if port_is_busy; then
    echo "启动失败：端口 ${PORT} 已被其他进程占用。" >&2
    echo "请停止占用进程，或使用其他端口，例如：PORT=8090 ./run.sh start" >&2
    return 1
  fi

  echo "正在启动服务..."
  nohup python3 -m http.server "${PORT}" \
    --bind "${HOST}" \
    --directory "${PROJECT_DIR}" \
    >> "${LOG_FILE}" 2>&1 &
  pid=$!
  printf '%s\n' "${pid}" > "${PID_FILE}"
  printf '%s\n' "${PORT}" > "${PORT_FILE}"

  sleep 1
  if ! is_running "${pid}"; then
    rm -f "${PID_FILE}" "${PORT_FILE}"
    echo "启动失败，请查看日志：${LOG_FILE}" >&2
    tail -n 3 "${LOG_FILE}" >&2
    return 1
  fi

  echo "服务启动成功"
  echo "PID: ${pid}"
  echo "监听端口: ${PORT}"
  echo "访问地址: http://$(local_ip):${PORT}"
  echo "日志文件: ${LOG_FILE}"
}

stop_service() {
  local pid

  ensure_directories
  pid="$(read_pid)"

  if [[ -z "${pid}" ]]; then
    echo "服务未运行：未找到 PID 文件。"
    return 0
  fi

  if ! is_running "${pid}"; then
    rm -f "${PID_FILE}" "${PORT_FILE}"
    echo "服务未运行：PID ${pid} 对应的进程不存在，已清理 PID 文件。"
    return 0
  fi

  echo "正在停止服务，PID: ${pid}"
  kill "${pid}"

  for _ in {1..20}; do
    if ! is_running "${pid}"; then
      rm -f "${PID_FILE}" "${PORT_FILE}"
      echo "服务已停止。"
      return 0
    fi
    sleep 0.1
  done

  echo "服务未能及时停止，正在强制结束进程..."
  kill -9 "${pid}" 2>/dev/null || true
  rm -f "${PID_FILE}" "${PORT_FILE}"
  echo "服务已停止。"
}

show_status() {
  local pid

  ensure_directories
  pid="$(read_pid)"

  if is_running "${pid}"; then
    echo "服务状态: 运行中"
    echo "PID: ${pid}"
    echo "监听端口: $(active_port)"
    echo "访问地址: http://$(local_ip):$(active_port)"
    echo "日志文件: ${LOG_FILE}"
    return 0
  fi

  if [[ -n "${pid}" ]]; then
    rm -f "${PID_FILE}" "${PORT_FILE}"
  fi

  echo "服务状态: 未运行"
  echo "监听端口: ${PORT}"
  return 1
}

show_usage() {
  echo "用法: $0 {start|stop|restart|status}"
}

case "${1:-}" in
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service
    start_service
    ;;
  status)
    show_status
    ;;
  *)
    show_usage
    exit 1
    ;;
esac

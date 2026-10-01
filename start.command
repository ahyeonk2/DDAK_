#!/bin/zsh
cd "${0:A:h}" || exit 1
TASK_NODE=$(command -v node)
if [[ -z "$TASK_NODE" ]]; then TASK_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; fi
if [[ ! -x "$TASK_NODE" ]]; then
  echo 'Node.js 24 이상을 설치한 뒤 다시 열어주세요.'
  read -r '?Enter를 누르면 닫힙니다.'
  exit 1
fi
export PATH="${TASK_NODE:h}:$PATH"
if [[ ! -d node_modules ]]; then
  TASK_PNPM=$(command -v pnpm)
  if [[ -z "$TASK_PNPM" ]]; then TASK_PNPM="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm"; fi
  if [[ -x "$TASK_PNPM" ]]; then "$TASK_PNPM" install || exit 1
  elif command -v npm >/dev/null; then npm install || exit 1
  else echo 'pnpm 또는 npm을 설치해 주세요.'; exit 1
  fi
fi
"$TASK_NODE" node_modules/typescript/bin/tsc -b || exit 1
"$TASK_NODE" node_modules/vite/bin/vite.js build || exit 1
echo '\n브라우저에서 http://localhost:5173 을 열어주세요. 종료: Ctrl+C'
"$TASK_NODE" server/index.mjs

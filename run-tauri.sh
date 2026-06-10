#!/bin/bash
export PATH="$HOME/.cargo/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Kill any previous instances
kill $(lsof -ti:1420) 2>/dev/null

# Start vite dev server in background
npx vite --host 2>/tmp/vite.log &
VITE_PID=$!
echo "Vite PID: $VITE_PID"

# Wait for vite to be ready
for i in $(seq 1 30); do
  if curl -s http://localhost:1420 >/dev/null 2>&1; then
    echo "Vite ready!"
    break
  fi
  sleep 1
done

# Run the Tauri binary
DISPLAY=:0 LIBGL_ALWAYS_SOFTWARE=true GALLIUM_DRIVER=llvmpipe \
  /home/ogzuz/Proyectos/Grove\ Tool\ Icon\ Studio/src-tauri/target/debug/grove-tool-icon-studio 2>/tmp/tauri-err.log

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the app
  if (isDev) {
    // For development
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // For production
    const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

function startServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'src', 'app.js');
  serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON: true
    }
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
}); 
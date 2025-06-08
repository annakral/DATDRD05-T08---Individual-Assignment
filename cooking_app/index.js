/**
 * index.js
 * 
 * This file initializes the Electron app and sets up communication with the Python backend.
 * It creates the main application window and spawns a Python process (`cooking_assistant.py`)
 * to handle cooking-related queries using a local language model.
 * 
 * Key Features:
 * - Launches the Electron UI
 * - Starts and monitors the Python backend
 * - Uses IPC to send user questions to Python and receive answers
 * 
 * Author: Anna Královcová
 * Date: 06/2025
 */


const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const pythonScriptPath = path.join(__dirname, 'cooking_assistant.py');

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow;
let pythonProcess;

// Function to create the Python bridge
function createPythonBridge() {
  // Create a new Python process
  const anacondaFallbackPath = path.join('C:', 'Users', 'anusk', 'anaconda_python', 'envs', 'data-science', 'python.exe');
  const pythonExecutable = process.env.PYTHON_PATH || anacondaFallbackPath || 'python';
  console.log(`Using Python executable: ${pythonExecutable}`);

  pythonProcess = spawn(pythonExecutable, [pythonScriptPath]); 

  // Handle Python process output
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
    
    // Try to parse any JSON output from Python
    try {
      const responseData = JSON.parse(data.toString());
      if (responseData.status === 'ready') {
        console.log('Python backend is ready:', responseData.components);
      }
    } catch (e) {
      // Not parsable as JSON, just log as is
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });

  // Set up IPC for communicating between renderer and main process
  ipcMain.handle('ask-cooking-question', async (event, question) => {
    return new Promise((resolve, reject) => {
      console.log(`Sending question to Python: ${question}`);
      
      // Create a buffer to accumulate data from Python
      let responseBuffer = '';
      
      // Write question to Python process stdin
      pythonProcess.stdin.write(JSON.stringify({ question }) + '\n');
      
      // Set up a listener for Python's response
      const dataHandler = (data) => {
        responseBuffer += data.toString();
        
        try {
          // Try to parse the accumulated data as JSON
          const response = JSON.parse(responseBuffer);
          
          // If parsing succeeds, resolve the promise and remove the listener
          pythonProcess.stdout.removeListener('data', dataHandler);
          resolve(response);
        } catch (e) {
          // If parsing fails, we likely haven't received the complete response yet
          // Just continue accumulating data
        }
      };
      
      // Add the listener
      pythonProcess.stdout.on('data', dataHandler);
      
      // Set a timeout in case Python doesn't respond
      setTimeout(() => {
        pythonProcess.stdout.removeListener('data', dataHandler);
        reject(new Error('Timeout waiting for Python response'));
      }, 240000); // 4 minutes timeout
    });
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,  // This must be false if using nodeIntegration
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html of the app
  mainWindow.loadFile('index.html');
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  // Create the Python bridge after creating the window
  createPythonBridge();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up Python process on app quit
app.on('will-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
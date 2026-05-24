// localFileSystem.js - Simple local file system without Docker
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

class LocalFileSystem {
  constructor() {
    this.workspaces = {}; // socket.id -> workspace path
  }

  // Initialize workspace
  initWorkspace(socketId, folderPath) {
    if (!folderPath || !fs.existsSync(folderPath)) {
      // Create temp workspace
      const tempDir = path.join(process.cwd(), 'temp_workspaces', socketId);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      this.workspaces[socketId] = tempDir;
      return { success: true, workspace: tempDir, isTemp: true };
    }

    this.workspaces[socketId] = folderPath;
    return { success: true, workspace: folderPath };
  }

  // Save file locally
  saveFile(socketId, filePath, content) {
    try {
      const workspace = this.workspaces[socketId];
      if (!workspace) {
        return { success: false, error: 'No workspace' };
      }

      const fullPath = path.resolve(workspace, filePath);
      
      // Security check
      if (!fullPath.startsWith(workspace)) {
        return { success: false, error: 'Invalid path' };
      }

      // Create directory if needed
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(fullPath, content, 'utf8');
      
      return { success: true, path: fullPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Execute command locally
  executeCommand(socketId, command, currentDir = '') {
    return new Promise((resolve) => {
      const workspace = this.workspaces[socketId];
      if (!workspace) {
        resolve({ stdout: '', stderr: 'No workspace', code: 1 });
        return;
      }

      const workingDir = currentDir ? path.resolve(workspace, currentDir) : workspace;
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      const proc = spawn(cmd, args, { cwd: workingDir });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });

      proc.on('error', (err) => {
        resolve({ stdout: '', stderr: err.message, code: 1 });
      });
    });
  }

  // Get file tree
  getFileTree(socketId) {
    const workspace = this.workspaces[socketId];
    if (!workspace) return {};

    return this.buildFileTree(workspace);
  }

  buildFileTree(folderPath, relativePath = '') {
    const tree = {};
    
    try {
      const items = fs.readdirSync(folderPath);
      
      for (const item of items) {
        const fullPath = path.join(folderPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          tree[item] = this.buildFileTree(fullPath, path.join(relativePath, item));
        } else {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            tree[item] = content;
          } catch (e) {
            tree[item] = '// Binary or unreadable file';
          }
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }
    
    return tree;
  }

  // Cleanup
  cleanup(socketId) {
    delete this.workspaces[socketId];
  }
}

export default new LocalFileSystem();

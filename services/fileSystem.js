// fileSystem.js - Hybrid file system service (Docker + Local)
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

class FileSystemService {
  constructor() {
    this.mode = 'local'; // 'docker' or 'local'
    this.workspaces = {}; // socket.id -> workspace path
    this.containers = {}; // socket.id -> container name
  }

  // Initialize workspace for a socket
  async initializeWorkspace(socketId, folderPath = null, useDocker = false) {
    try {
      if (useDocker && folderPath) {
        // Docker mode with mounted folder
        return await this.initDockerWorkspace(socketId, folderPath);
      } else if (folderPath) {
        // Local mode with selected folder
        return await this.initLocalWorkspace(socketId, folderPath);
      } else {
        // Default local temp workspace
        return await this.initTempWorkspace(socketId);
      }
    } catch (error) {
      console.error('Workspace initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Docker workspace with volume mount
  async initDockerWorkspace(socketId, folderPath) {
    const containerName = `code_editor_${socketId.slice(0, 8)}`;
    
    return new Promise((resolve) => {
      const proc = spawn('docker', [
        'run', '--rm', '-dit',
        '--name', containerName,
        '-v', `"${folderPath}":/workspace`,
        '-w', '/workspace',
        'node-react-terminal'
      ]);

      proc.on('close', (code) => {
        if (code === 0) {
          this.mode = 'docker';
          this.containers[socketId] = containerName;
          this.workspaces[socketId] = folderPath;
          resolve({
            success: true,
            mode: 'docker',
            workspace: folderPath,
            container: containerName
          });
        } else {
          resolve({ success: false, error: 'Docker container failed to start' });
        }
      });

      proc.on('error', () => {
        resolve({ success: false, error: 'Docker not available' });
      });
    });
  }

  // Local workspace (no Docker)
  async initLocalWorkspace(socketId, folderPath) {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder does not exist' };
    }

    this.mode = 'local';
    this.workspaces[socketId] = folderPath;
    
    return {
      success: true,
      mode: 'local',
      workspace: folderPath
    };
  }

  // Temporary workspace
  async initTempWorkspace(socketId) {
    const tempDir = path.join(process.cwd(), 'temp', socketId);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    this.mode = 'local';
    this.workspaces[socketId] = tempDir;
    
    return {
      success: true,
      mode: 'local',
      workspace: tempDir,
      isTemp: true
    };
  }

  // Save file (works for both Docker and Local)
  async saveFile(socketId, filePath, content) {
    const workspace = this.workspaces[socketId];
    if (!workspace) {
      return { success: false, error: 'No workspace initialized' };
    }

    if (this.containers[socketId]) {
      // Docker mode
      return await this.saveFileDocker(socketId, filePath, content);
    } else {
      // Local mode
      return await this.saveFileLocal(socketId, filePath, content);
    }
  }

  // Save file in Docker container
  async saveFileDocker(socketId, filePath, content) {
    const containerName = this.containers[socketId];
    const targetPath = filePath.startsWith('/') ? filePath : `/workspace/${filePath}`;

    return new Promise((resolve) => {
      const base64Content = Buffer.from(content).toString('base64');
      const proc = spawn('docker', [
        'exec', containerName,
        'sh', '-c', `echo '${base64Content}' | base64 -d > '${targetPath}'`
      ]);

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          error: code !== 0 ? 'Docker file save failed' : null,
          path: targetPath
        });
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  // Save file locally
  async saveFileLocal(socketId, filePath, content) {
    try {
      const workspace = this.workspaces[socketId];
      const fullPath = path.resolve(workspace, filePath);
      
      // Ensure file is within workspace (security)
      if (!fullPath.startsWith(workspace)) {
        return { success: false, error: 'Invalid file path' };
      }

      // Create directory if needed
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(fullPath, content, 'utf8');
      
      return {
        success: true,
        path: fullPath,
        relativePath: filePath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Execute command
  async executeCommand(socketId, command, currentDir = '/workspace') {
    if (this.containers[socketId]) {
      return await this.executeDockerCommand(socketId, command, currentDir);
    } else {
      return await this.executeLocalCommand(socketId, command, currentDir);
    }
  }

  // Execute command in Docker
  async executeDockerCommand(socketId, command, currentDir) {
    const containerName = this.containers[socketId];
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    return new Promise((resolve) => {
      const proc = spawn('docker', [
        'exec', '-w', currentDir, containerName, cmd, ...args
      ]);

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

  // Execute command locally
  async executeLocalCommand(socketId, command, currentDir) {
    const workspace = this.workspaces[socketId];
    const workingDir = currentDir === '/workspace' ? workspace : path.resolve(workspace, currentDir.replace('/workspace/', ''));

    return new Promise((resolve) => {
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
  async getFileTree(socketId) {
    const workspace = this.workspaces[socketId];
    if (!workspace) return {};

    if (this.containers[socketId]) {
      return await this.getDockerFileTree(socketId);
    } else {
      return await this.getLocalFileTree(workspace);
    }
  }

  // Get Docker file tree
  async getDockerFileTree(socketId) {
    // Use existing getContainerFileTree logic
    return {};
  }

  // Get local file tree
  async getLocalFileTree(folderPath, relativePath = '') {
    const tree = {};
    
    try {
      const items = fs.readdirSync(folderPath);
      
      for (const item of items) {
        const fullPath = path.join(folderPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          tree[item] = await this.getLocalFileTree(fullPath, path.join(relativePath, item));
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
    if (this.containers[socketId]) {
      spawn('docker', ['stop', this.containers[socketId]]);
      delete this.containers[socketId];
    }
    delete this.workspaces[socketId];
  }
}

export default new FileSystemService();
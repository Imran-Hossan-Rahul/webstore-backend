// folderRoutes.js - Handle folder selection and mounting
import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Get folder structure from user's PC
router.post('/browse', (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(400).json({ error: 'Invalid folder path' });
    }
    
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    const structure = items.map(item => ({
      name: item.name,
      path: path.join(folderPath, item.name),
      isDirectory: item.isDirectory()
    }));
    
    res.json({ structure, currentPath: folderPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get drives list (Windows)
router.get('/drives', (req, res) => {
  try {
    const drives = [];
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':\\';
      if (fs.existsSync(drive)) {
        drives.push(drive);
      }
    }
    res.json({ drives });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
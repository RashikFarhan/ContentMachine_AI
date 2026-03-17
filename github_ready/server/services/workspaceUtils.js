const fs = require('fs');
const path = require('path');
const WORKSPACES_FILE = path.join(__dirname, '../data/workspaces.json');

function getWorkspaceConfig(id) {
    if (!id || typeof id !== 'string') return null;
    try {
        if (!fs.existsSync(WORKSPACES_FILE)) return null;
        const workspaces = JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf-8'));
        return workspaces.find(w => w.id === id) || null;
    } catch (e) {
        return null;
    }
}

module.exports = { getWorkspaceConfig };

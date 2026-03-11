const fs = require('fs');
const path = require('path');

let usersFile;
if (process.env.CONFIG_PATH) {
    usersFile = path.join(path.dirname(process.env.CONFIG_PATH), 'users.json');
} else {
    usersFile = path.join(__dirname, '..', 'config', 'users.json');
}

function getUsers() {
    if (!fs.existsSync(usersFile)) {
        return [];
    }
    try {
        const data = fs.readFileSync(usersFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading users.json:', err.message);
        return [];
    }
}

function saveUsers(users) {
    try {
        const dir = path.dirname(usersFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing users.json:', err.message);
        throw err;
    }
}

module.exports = {
    getUsers,
    saveUsers,
    usersFile
};

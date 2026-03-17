function extractOnionUrl(line) {
  const match = line.match(/Onion URL:\s*(https?:\/\/[a-z0-9.-]+\.onion)/i)
    || line.match(/OnionShare is hosting at\s*(https?:\/\/[a-z0-9.-]+\.onion)/i);
  return match ? match[1] : null;
}

function platformDirName(platform = process.platform) {
  if (platform === 'win32') return 'win';
  if (platform === 'darwin') return 'mac';
  return 'linux';
}

module.exports = {
  extractOnionUrl,
  platformDirName,
};

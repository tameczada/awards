const tmi = require('tmi.js');

let client = null;
let status = { connected: false, channel: null, connectedAt: null, lastError: null };
let voteHandler = null;

// pequeno cooldown por usuário pra evitar flood de comandos repetidos
const lastCommandAt = new Map();
const COOLDOWN_MS = 2000;

function setVoteHandler(fn) {
  voteHandler = fn;
}

function getStatus() {
  return { ...status };
}

async function disconnect() {
  if (client) {
    try {
      await client.disconnect();
    } catch (e) {
      /* ignora erro ao desconectar */
    }
    client.removeAllListeners();
    client = null;
  }
  status = { connected: false, channel: null, connectedAt: null, lastError: status.lastError };
}

async function connect({ username, token, channel, replyInChat }) {
  if (!username || !token || !channel) {
    throw new Error('Usuário, token e canal são obrigatórios');
  }
  await disconnect();

  const password = token.startsWith('oauth:') ? token : `oauth:${token}`;

  client = new tmi.Client({
    options: { skipMembership: true },
    connection: { reconnect: true, secure: true },
    identity: { username, password },
    channels: [channel],
  });

  client.on('message', async (chTag, tags, message, self) => {
    if (self) return;
    const match = message.trim().match(/^!(votar|vote)\s+(\d{1,2})\b/i);
    if (!match) return;

    const twitchUserId = tags['user-id'];
    const displayName = tags['display-name'] || tags.username || 'espectador';
    if (!twitchUserId) return;

    const now = Date.now();
    const last = lastCommandAt.get(twitchUserId) || 0;
    if (now - last < COOLDOWN_MS) return;
    lastCommandAt.set(twitchUserId, now);

    const optionIndex = parseInt(match[2], 10);
    if (!voteHandler) return;

    try {
      const result = await voteHandler({ optionIndex, twitchUserId, displayName });
      if (replyInChat && result && result.message) {
        client.say(channel, `@${displayName} ${result.message}`).catch(() => {});
      }
    } catch (e) {
      /* erros de um comando individual não devem derrubar o bot */
    }
  });

  client.on('connected', () => {
    status = { connected: true, channel, connectedAt: new Date().toISOString(), lastError: null };
  });

  client.on('disconnected', (reason) => {
    status.connected = false;
    status.lastError = reason || null;
  });

  try {
    await client.connect();
  } catch (err) {
    status = { connected: false, channel: null, connectedAt: null, lastError: err.message || String(err) };
    client = null;
    throw err;
  }

  return getStatus();
}

module.exports = { connect, disconnect, getStatus, setVoteHandler };

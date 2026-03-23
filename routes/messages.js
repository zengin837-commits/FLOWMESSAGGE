const router = require('express').Router();
const auth   = require('../middleware/auth');

const delay = ms => new Promise(r => setTimeout(r, ms));

router.post('/send', auth, async (req, res) => {
  try {
    const { groups, message, minDelay = 3000, maxDelay = 8000 } = req.body;

    if (!groups || !groups.length)
      return res.status(400).json({ error: 'En az bir grup seçin' });
    if (!message?.trim())
      return res.status(400).json({ error: 'Mesaj boş olamaz' });

    const sock = global.activeSockets[req.user.id];
    if (!sock) return res.status(400).json({ error: 'WhatsApp bağlı değil' });

    res.json({ message: `${groups.length} gruba gönderiliyor...`, total: groups.length });

    let sent = 0, failed = 0;

    for (const groupId of groups) {
      try {
        await sock.sendMessage(groupId, { text: message });
        sent++;
        global.io.to(req.user.id.toString()).emit('send_progress', {
          sent, failed, total: groups.length, groupId, status: 'ok'
        });
      } catch (e) {
        failed++;
        global.io.to(req.user.id.toString()).emit('send_progress', {
          sent, failed, total: groups.length, groupId, status: 'error', error: e.message
        });
      }

      if (sent + failed < groups.length) {
        const wait = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await delay(wait);
      }
    }

    global.io.to(req.user.id.toString()).emit('send_complete', {
      sent, failed, total: groups.length
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

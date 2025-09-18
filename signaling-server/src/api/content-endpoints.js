/**
 * T031-T036: API Endpoints for content registry
 */

const express = require('express');
const router = express.Router();

// Rate limiting tracking (in-memory for simplicity)
const rateLimits = new Map();

/**
 * Rate limiting middleware
 */
function rateLimit(req, res, next) {
  const { callsign } = req.body;
  if (!callsign) return next();

  const key = `${callsign}_${Math.floor(Date.now() / 60000)}`; // Per minute
  const count = rateLimits.get(key) || 0;

  if (count >= 10) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  rateLimits.set(key, count + 1);

  // Cleanup old entries
  if (rateLimits.size > 1000) {
    const cutoff = Math.floor(Date.now() / 60000) - 5;
    for (const [k] of rateLimits) {
      const [, time] = k.split('_');
      if (parseInt(time) < cutoff) {
        rateLimits.delete(k);
      }
    }
  }

  next();
}

/**
 * Simple authentication check (placeholder for ECDSA)
 */
function authenticate(req, res, next) {
  const { signature } = req.body;

  // TODO: Implement actual ECDSA verification
  if (signature === 'invalid-signature') {
    return res.status(401).json({ error: 'Authentication failed' });
  }

  next();
}

/**
 * T031: POST /api/content/announce
 */
router.post('/announce', rateLimit, authenticate, async (req, res, next) => {
  try {
    const { contentRegistry } = req.app.locals;
    const beaconUpdate = req.body;

    // Validate required fields
    if (!beaconUpdate.callsign || !beaconUpdate.contentHash || !beaconUpdate.path) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate formats
    if (!/^[A-Z]{1,2}[0-9]{1}[A-Z]{1,4}$/.test(beaconUpdate.callsign)) {
      return res.status(400).json({ error: 'Invalid callsign format' });
    }

    if (!/^[a-fA-F0-9]{64}$/.test(beaconUpdate.contentHash)) {
      return res.status(400).json({ error: 'Invalid content hash format' });
    }

    const result = await contentRegistry.announceBeacon(beaconUpdate);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * T032: GET /api/content/search
 */
router.get('/search', async (req, res, next) => {
  try {
    const { contentRegistry } = req.app.locals;
    const { hash, callsign, priority } = req.query;

    // Validate query parameters
    if (hash && !/^[a-fA-F0-9]{64}$/.test(hash)) {
      return res.status(400).json({ error: 'Invalid hash format' });
    }

    if (priority !== undefined) {
      const p = parseInt(priority);
      if (isNaN(p) || p < 0 || p > 5) {
        return res.status(400).json({ error: 'Invalid priority value' });
      }
    }

    const filters = {
      hash,
      callsign,
      priority: priority !== undefined ? parseInt(priority) : undefined
    };

    const results = await contentRegistry.searchContent(filters);
    res.json(results.map(beacon => beacon.toJSON()));
  } catch (error) {
    next(error);
  }
});

/**
 * T033: POST /api/content/batch
 */
router.post('/batch', async (req, res, next) => {
  try {
    const { contentRegistry } = req.app.locals;
    const { hashes } = req.body;

    if (!Array.isArray(hashes)) {
      return res.status(400).json({ error: 'Hashes must be an array' });
    }

    if (hashes.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 hashes per batch' });
    }

    // Validate all hashes
    for (const hash of hashes) {
      if (hash && !/^[a-fA-F0-9]{64}$/.test(hash)) {
        return res.status(400).json({ error: `Invalid hash format: ${hash}` });
      }
    }

    // Remove duplicates
    const uniqueHashes = [...new Set(hashes)];
    const results = await contentRegistry.batchQuery(uniqueHashes);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * T034: GET /api/content/:hash
 */
router.get('/:hash', async (req, res, next) => {
  try {
    const { contentRegistry } = req.app.locals;
    const { hash } = req.params;

    if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
      return res.status(400).json({ error: 'Invalid hash format' });
    }

    const beacon = await contentRegistry.getContent(hash);
    if (!beacon) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json(beacon.toJSON());
  } catch (error) {
    next(error);
  }
});

/**
 * T035: DELETE /api/content/:hash
 */
router.delete('/:hash', async (req, res, next) => {
  try {
    const { contentRegistry } = req.app.locals;
    const { hash } = req.params;

    if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
      return res.status(400).json({ error: 'Invalid hash format' });
    }

    // TODO: Check permissions for deletion
    const deleted = await contentRegistry.deleteContent(hash);
    if (!deleted) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * T036: GET /api/station/:callsign/trust
 */
router.get('/../station/:callsign/trust', async (req, res, next) => {
  try {
    const { contentRegistry } = req.app.locals;
    const { callsign } = req.params;

    if (!/^[A-Z]{1,2}[0-9]{1}[A-Z]{1,4}$/.test(callsign)) {
      return res.status(400).json({ error: 'Invalid callsign format' });
    }

    const trust = await contentRegistry.getStationTrust(callsign);
    res.json(trust);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
import express from 'express';
import Docker from 'dockerode';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { format as timeago } from 'timeago.js';
import LRU from 'lru-cache';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  volumes: {
    dir: '/var/lib/pterodactyl/volumes',
    ignoredExtensions: [
      '.jar', '.phar', '.rar', '.zip', '.tar.gz', '.7z', '.gz', '.xz', '.bz2',
      '.log', '.logs', '.txt', '.yml', '.yaml', '.json', '.properties', '.db', '.toml', '.mca'
    ],
    ignoredFiles: [
      'velocity.toml', 
      'server.jar.old',
      'latest.log',
      'debug.log',
      'error.log',
      'access.log',
      'server.log',
      'usermap.bin',
      'forbidden-players.txt',
      'help.yml',
      'commands.yml',
      'permissions.yml'
    ],

    ignoredPaths: [
      'proxy.log.0',
      'proxy.log',
      'plugins/.paper-remapped',
      'plugins/CoreProtect/database.db',
      'plugins/PlaceholderAPI/javascripts/example.js',
      'plugins/Geyser-Spigot/locales',
      'plugins/Geyser-Velocity/locales',
      'plugins/Essentials',
      'plugins/ViaVersion/cache',
      'cache',
      'logs',
      'crash-reports',
      'world/playerdata',
      'world/stats',
      'world/advancements',
      'world/region'
    ],
    maxJarSize: 5 * 1024 * 1024,
    suspiciousCache: ['cpuminer', 'cpuminer-avx2', 'xmrig'],
    suspiciousNames: ['mine.sh', 'working_proxies.txt', 'proxies.txt', 'whatsapp.js', 'wa_bot.js', 'proxy.txt'],
    suspiciousExts: ['.sh']
  },
  webhook: {
    url: 'https://discord.com/api/webhooks/1330358605979058226/fgH0DHXh0uFyDtHkQADY0aaPsm6qRl1cBe6IBOauD23z03yANnbohd7Qp50cwmsMuCOK',
  },
  pterodactyl: {
    apiUrl: 'https://panel.xeh.sh/api/application',
    apiKey: 'ptla_ZNFbDajOQS1R7FhRnlGbvO0Y4WM92mdGK0Xey2iqowC',
  },
  scan: {
    interval: 3 * 60 * 1000,
    highNetworkUsage: 1024 * 1024 * 4096,
    highCpuThreshold: 0.96,
    smallVolumeSize: 3.5,
    recentAccountThreshold: 7 * 24 * 60 * 1000,
    logTailSize: 500,
    hashSyncInterval: 3 * 60 * 1000, // 5 minutes
    hashCacheSize: 10000,
    serverCacheSize: 1000
  },
  hashApi: {
    url: 'http://us-phx-3.xeh.sh:25002' // Optional
  },
  patterns: {
    malicious: {
      processes: ['xmrig', 'earnfm', 'mcstorm.jar', 'proot', 'destine', 'hashvault'],
      indicators: {
        whatsapp: ['whatsapp-web.js', 'whatsapp-web-js', 'webwhatsapi', 'yowsup', 'wa-automate', 'baileys'],
        nezha: ['nezha', 'App is running!'],
        miner: ['xmrig', 'ethminer', 'cpuminer', 'bfgminer', 'cgminer', 'minerd', 'cryptonight', 'stratum+tcp', 'minexmr', 'nanopool', 'minergate'],
      },
      ports: [1080, 3128, 8080, 8118, 9150, 9001, 9030],
      words: [
        "new job from",
        "noVNC",
        "Downloading fresh proxies...",
        "FAILED TO APPLY MSR MOD",
        "Tor server's identity key",
        "Stratum - Connected",
        "eth.2miners.com:2020",
        "whatsapp",
        "wa-automate",
        "whatsapp-web.js",
        "baileys",
        "port 3000"
      ],
      content: [
        'stratum',
        'cryptonight',
        'proxies...',
        'const _0x1a1f74=',
        "app['listen']",
        'minexmr.com',
        'herominers',
        'hashvault',
        'xmrig',
        'nanopool.org',
        'ethpool.org',
        '2miners.com'
      ]
    },
    legitimate: {
      logPatterns: [
        'Done (',
        'Starting minecraft server version',
        'Preparing spawn area',
        'Loading libraries',
        'For help, type "help"',
        'Loaded ',
        'Preparing start region',
        'Time elapsed',
        'Startup script'
      ]
    }
  }
};

class HashDatabase {
  constructor() {
    this.hashCache = new LRU({
      max: config.scan.hashCacheSize,
      ttl: config.scan.hashSyncInterval
    });
    this.serverCache = new LRU({
      max: config.scan.serverCacheSize,
      ttl: 30 * 60 * 1000 // 30 minutes
    });
    this.lastSync = 0;
  }

  async syncHashes() {
    if (Date.now() - this.lastSync < config.scan.hashSyncInterval) {
      return;
    }

    try {
      const response = await axios.get(`${config.hashApi.url}/api/hashes`);
      response.data.forEach(hash => {
        this.hashCache.set(hash.hash, {
          fileName: hash.file_name,
          detectionType: hash.detection_type
        });
      });
      this.lastSync = Date.now();
      console.log(`Synced ${response.data.length} hashes from API`);
    } catch (error) {
      console.error('Failed to sync hashes:', error.message);
    }
  }

  async checkHash(hash) {
    await this.syncHashes();
    return this.hashCache.get(hash);
  }

  async submitHash(hash, fileName, detectionType, serverIdentifier, metadata = {}) {
    try {
      await axios.post(`${config.hashApi.url}/api/hashes`, {
        hash,
        fileName,
        detectionType,
        serverIdentifier,
        metadata
      });
      this.hashCache.set(hash, { fileName, detectionType });
    } catch (error) {
      console.error('Failed to submit hash:', error.message);
    }
  }

  async isServerFlagged(serverId) {
    // Check cache first
    const cached = this.serverCache.get(serverId);
    if (cached) return cached;

    try {
      const response = await axios.get(`${config.hashApi.url}/api/servers/${serverId}`);
      const result = response.data;
      this.serverCache.set(serverId, result);
      return result;
    } catch (error) {
      console.error('Failed to check server:', error.message);
      return null;
    }
  }
}

class PterodactylAPI {
  constructor() {
    this.cache = {
      servers: null,
      serversFetchTime: 0,
      nodes: new Map(),
      users: new Map()
    };
  }

  async request(endpoint, method = 'GET', data = null) {
    try {
      const response = await axios({
        method,
        url: `${config.pterodactyl.apiUrl}/${endpoint}`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.pterodactyl.apiKey}`
        },
        data
      });
      return response.data;
    } catch (error) {
      console.error(`Pterodactyl API error (${endpoint}):`, error.message);
      throw error;
    }
  }

  async getServers(force = false) {
    if (!force && this.cache.servers && (Date.now() - this.cache.serversFetchTime) < 300000) {
      return this.cache.servers;
    }

    const response = await this.request('servers?per_page=10000');
    this.cache.servers = response.data;
    this.cache.serversFetchTime = Date.now();
    return response.data;
  }

  async getServerFromUUID(uuid) {
    const servers = await this.getServers();
    return servers.find(server => server.attributes.uuid === uuid);
  }

  async getUserDetails(userId) {
    if (this.cache.users.has(userId)) {
      return this.cache.users.get(userId);
    }

    const response = await this.request(`users/${userId}`);
    this.cache.users.set(userId, response.attributes);
    return response.attributes;
  }

  async getNodeDetails(nodeId) {
    if (this.cache.nodes.has(nodeId)) {
      return this.cache.nodes.get(nodeId);
    }

    const response = await this.request(`nodes/${nodeId}`);
    this.cache.nodes.set(nodeId, response.attributes);
    return response.attributes;
  }

  async suspendServer(serverId) {
    try {
      await this.request(`servers/${serverId}/suspend`, 'POST');
      console.log(`Successfully suspended server ${serverId}`);
      return true;
    } catch (error) {
      console.error(`Failed to suspend server ${serverId}:`, error.message);
      return false;
    }
  }

  isRecentAccount(createdAt) {
    return Date.now() - new Date(createdAt).getTime() < config.scan.recentAccountThreshold;
  }
}

class RadarAPI {
  constructor() {
    this.docker = new Docker();
    this.app = express();
    this.detections = new Map();
    this.ptero = new PterodactylAPI();
    this.hashDb = new HashDatabase();
    this.setupAPI();
  }

  setupAPI() {
    this.app.use(express.json());

    this.app.get('/api/detections', (req, res) => {
      const detections = Array.from(this.detections.values());
      res.json({
        total: detections.length,
        detections: detections
      });
    });

    this.app.get('/api/detections/:id', (req, res) => {
      const detection = this.detections.get(req.params.id);
      if (detection) {
        res.json(detection);
      } else {
        res.status(404).json({ error: 'Detection not found' });
      }
    });

    this.app.post('/api/scan/:containerId', async (req, res) => {
      try {
        const result = await this.scanContainer(req.params.containerId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/stats', (req, res) => {
      const detections = Array.from(this.detections.values());
      const stats = {
        total_detections: detections.length,
        detection_types: {},
        recent_detections: detections.filter(d => 
          Date.now() - new Date(d.timestamp).getTime() < 24 * 60 * 60 * 1000
        ).length,
        by_node: {},
        by_detection_type: {}
      };

      detections.forEach(detection => {
        detection.types.forEach(type => {
          stats.detection_types[type] = (stats.detection_types[type] || 0) + 1;
        });
        if (detection.nodeInfo) {
          stats.by_node[detection.nodeInfo.name] = (stats.by_node[detection.nodeInfo.name] || 0) + 1;
        }
      });

      res.json(stats);
    });

    this.app.get('/api/history/:serverIdentifier', async (req, res) => {
      try {
        const detections = Array.from(this.detections.values())
          .filter(d => d.serverId === req.params.serverIdentifier || d.volumeId === req.params.serverIdentifier)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({
          total: detections.length,
          detections: detections
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.listen(3000, () => {
      console.log('Radar API listening on port 3000');
    });
  }

  isLegitimateLogs(logs) {
    return config.patterns.legitimate.logPatterns.some(pattern => 
      logs.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  async sendWebhook(detection) {
    try {
      let serverInfo = null;
      let userInfo = null;
      let nodeInfo = null;

      if (detection.volumeId) {
        const server = await this.ptero.getServerFromUUID(detection.volumeId);
        if (server) {
          serverInfo = server.attributes;
          userInfo = await this.ptero.getUserDetails(server.attributes.user);
          nodeInfo = await this.ptero.getNodeDetails(server.attributes.node);
        }
      }

      const isRecentAccount = userInfo && this.ptero.isRecentAccount(userInfo.created_at);

      const embed = {
        title: `Abuse Detection on ${nodeInfo ? `${nodeInfo.name} (${nodeInfo.fqdn})` : 'Unknown Node'}`,
        description: isRecentAccount ? "⚠️ **WARNING: Recently Created Account**" : "Detailed incident report below",
        color: isRecentAccount ? 0xFF0000 : 0x242424,
        fields: [
          {
            name: "Container Information",
            value: [
              `Volume UUID: ${detection.volumeId}`,
              `Panel ID: ${serverInfo ? serverInfo.id : 'Unknown'}`,
              `Docker ID: ${detection.containerId}`,
              `Server Name: ${serverInfo ? serverInfo.name : 'Unknown'}`,
              `Volume Size: ${detection.volumeSize.toFixed(2)}MB`
            ].join('\n'),
            inline: false
          },
          {
            name: "User Information",
            value: userInfo ? [
              `ID: ${userInfo.id}`,
              `Username: ${userInfo.username}`,
              `Email: ${userInfo.email}`,
              `Name: ${userInfo.first_name} ${userInfo.last_name}`,
`Account Created: ${timeago(new Date(userInfo.created_at))}`,
              isRecentAccount ? '⚠️ **RECENT ACCOUNT**' : ''
            ].filter(Boolean).join('\n') : 'Unknown User',
            inline: false
          },
          {
            name: "Resource Usage",
            value: [
              `CPU: ${detection.metrics.cpu}%`,
              `Memory: ${detection.metrics.memory}MB`,
              `Network: ${detection.metrics.network}MB`,
              `Disk: ${detection.volumeSize}MB`
            ].join('\n'),
            inline: true
          },
          {
            name: "Detection Type(s)",
            value: detection.types.length > 0 ? detection.types.join(', ') : 'None',
            inline: true
          }
        ]
      };

      // Add known malicious hash matches
      if (detection.hashMatches && detection.hashMatches.length > 0) {
        embed.fields.push({
          name: "Known Malicious Files",
          value: detection.hashMatches.map(match => 
            `${match.fileName} (${match.detectionType})`
          ).join('\n'),
          inline: false
        });
      }

      // Add all the additional fields
      const additionalFields = [
        {
          name: "Running Processes",
          value: detection.processes.length > 0 ? 
            '```\n' + detection.processes.join('\n') + '\n```' : 
            "None detected"
        },
        {
          name: "Suspicious Files",
          value: detection.files.length > 0 ? 
            '```\n' + detection.files.map(f => `${f.path} (${f.reason})`).join('\n') + '\n```' : 
            "None detected"
        },
        {
          name: "Cache Analysis",
          value: detection.cache.length > 0 ? 
            detection.cache.join('\n') : 
            "No suspicious cache files"
        },
        {
          name: "NPM Analysis",
          value: detection.npm.length > 0 ? 
            detection.npm.join('\n') : 
            "No suspicious NPM files"
        },
        {
          name: "Network Activity",
          value: detection.network.length > 0 ? 
            detection.network.join('\n') : 
            "No suspicious activity"
        },
        {
          name: "Suspicious Content",
          value: detection.suspiciousContent.length > 0 ? 
            detection.suspiciousContent.join('\n') : 
            "None detected"
        }
      ];

      embed.fields.push(...additionalFields);

      // Add logs if they exist and aren't just legitimate startup logs
      if (detection.logs && !this.isLegitimateLogs(detection.logs)) {
        embed.fields.push({
          name: "Last 500 chars of logs",
          value: '```\n' + detection.logs.slice(-config.scan.logTailSize) + '\n```',
          inline: false
        });
      }

      await axios.post(config.webhook.url, { embeds: [embed] });

      // Suspend if needed
      if (serverInfo && detection.types.length > 0) {
        const suspended = await this.ptero.suspendServer(serverInfo.id);
        console.log(`Server suspension ${suspended ? 'successful' : 'failed'} for ID ${serverInfo.id}`);
      }
    } catch (error) {
      console.error('Failed to send webhook:', error);
    }
  }

  async scanContainer(containerId) {
    const container = this.docker.getContainer(containerId);
    let detection;

    try {
      const containerInfo = await container.inspect();
      const volumePath = containerInfo.Mounts.find(m => m.Type === 'bind')?.Source;
      
      if (!volumePath) {
        throw new Error('No volume found for container');
      }

      const volumeId = path.basename(volumePath);

      // Check if server was recently flagged
      const serverFlagged = await this.hashDb.isServerFlagged(volumeId);
      if (serverFlagged && serverFlagged.times_flagged > 0) {
        const timeSinceLastFlag = Date.now() - new Date(serverFlagged.last_flagged).getTime();
        if (timeSinceLastFlag < 24 * 60 * 60 * 1000) { // Skip if flagged in last 24 hours
          console.log(`Skipping recently flagged server ${volumeId}`);
          return null;
        }
      }

      detection = {
        id: crypto.randomBytes(4).toString('hex'),
        timestamp: new Date(),
        containerId: containerInfo.Id.substring(0, 12),
        volumeId,
        types: [],
        metrics: {},
        processes: [],
        files: [],
        cache: [],
        npm: [],
        network: [],
        suspiciousContent: [],
        hashMatches: [],
        logs: '',
        volumeSize: 0
      };

      // Get container stats
      const stats = await container.stats({ stream: false });
      detection.metrics = {
        cpu: ((stats.cpu_stats.cpu_usage.total_usage / stats.cpu_stats.system_cpu_usage) * 100).toFixed(2),
        memory: (stats.memory_stats.usage / (1024 * 1024)).toFixed(2),
        network: Object.values(stats.networks || {})
          .reduce((acc, curr) => acc + curr.rx_bytes + curr.tx_bytes, 0) / (1024 * 1024)
      };

      // Volume size
      detection.volumeSize = await this.getDirectorySize(volumePath);

      // Check for small volume with high CPU
      if (detection.volumeSize < config.scan.smallVolumeSize && 
          parseFloat(detection.metrics.cpu) > config.scan.highCpuThreshold) {
        detection.types.push('High CPU with Small Volume');
      }

      // Network usage check
      if (detection.metrics.network > config.scan.highNetworkUsage) {
        detection.types.push('High Network Usage');
      }

      // Get process list
      const top = await container.top();
      detection.processes = top.Processes
        .map(proc => proc[7])
        .filter(cmd => {
          return config.patterns.malicious.processes.some(p => 
            cmd.toLowerCase().includes(p.toLowerCase())
          );
        });

      if (detection.processes.length > 0) {
        detection.types.push('Suspicious Process');
      }

      // Check logs
      const logs = await container.logs({ stdout: true, stderr: true, tail: 1000 });
      detection.logs = logs.toString();

      // Check for indicators in logs
      for (const [type, indicators] of Object.entries(config.patterns.malicious.indicators)) {
        if (indicators.some(i => detection.logs.toLowerCase().includes(i.toLowerCase()))) {
          detection.types.push(type);
        }
      }

      // Check for malicious words in logs
      if (config.patterns.malicious.words.some(word => 
        detection.logs.toLowerCase().includes(word.toLowerCase())
      )) {
        detection.types.push('Suspicious Log Content');
      }

      // File system checks
      await this.scanVolume(volumePath, detection);

      // Store detection if issues found
      if (detection.types.length > 0 || 
          detection.processes.length > 0 || 
          detection.files.length > 0 ||
          detection.suspiciousContent.length > 0 ||
          detection.hashMatches.length > 0) {
        this.detections.set(detection.id, detection);
        await this.sendWebhook(detection);
      }

      return detection;

    } catch (error) {
      console.error(`Error scanning container ${containerId}:`, error);
      throw error;
    }
  }

  async scanVolume(volumePath, detection) {
    // Check for suspicious npm file
    const npmPath = path.join(volumePath, '.npm', 'npm');
    if (await fs.pathExists(npmPath)) {
      const stat = await fs.stat(npmPath);
      if (stat.isFile()) {
        detection.npm.push('.npm/npm suspicious file found');
      }
    }

    // Check run.sh
    const runShPath = path.join(volumePath, 'run.sh');
    if (await fs.pathExists(runShPath)) {
      const content = await fs.readFile(runShPath, 'utf-8');
      if (this.containsSuspiciousContent(content)) {
        detection.suspiciousContent.push('Suspicious content in run.sh');
        detection.types.push('Suspicious Shell Script');
      }
    }

    // Check server.jar size
    const serverJarPath = path.join(volumePath, 'server.jar');
    if (await fs.pathExists(serverJarPath)) {
      const stat = await fs.stat(serverJarPath);
      if (stat.size < config.volumes.maxJarSize) {
        const hash = await this.calculateFileHash(serverJarPath);
        detection.files.push({
          path: 'server.jar',
          size: stat.size,
          hash,
          reason: 'Suspicious small server.jar'
        });
        detection.types.push('Small JAR File');

        // Submit the hash to the API
        await this.hashDb.submitHash(hash, 'server.jar', 'Small JAR File', detection.volumeId, {
          size: stat.size,
          detectionTime: new Date()
        });
      }
    }

    // Check cache directory
    const cachePath = path.join(volumePath, 'cache');
    if (await fs.pathExists(cachePath)) {
      const cacheFiles = await fs.readdir(cachePath);
      for (const file of cacheFiles) {
        if (config.volumes.suspiciousCache.some(name => file.startsWith(name))) {
          detection.cache.push(`Suspicious cache file: ${file}`);
          detection.types.push('Suspicious Cache File');
        }
      }
    }

    // Recursive file scanning
    await this.walkDirectory(volumePath, detection);
  }

  async walkDirectory(dir, detection, relativePath = '') {
    try {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = path.join(relativePath, file);
        const stat = await fs.stat(fullPath);

        // Skip ignored paths
        if (config.volumes.ignoredPaths.some(ignoredPath => relPath.startsWith(ignoredPath))) {
          continue;
        }

        // Skip ignored files
        if (config.volumes.ignoredFiles.includes(file) ||
            config.volumes.ignoredExtensions.includes(path.extname(file))) {
          continue;
        }

        if (stat.isDirectory()) {
          await this.walkDirectory(fullPath, detection, relPath);
          continue;
        }

        // Calculate hash for all files
        const hash = await this.calculateFileHash(fullPath);
        
        // Check against known malicious hashes
        const hashMatch = await this.hashDb.checkHash(hash);
        if (hashMatch) {
          detection.hashMatches.push({
            fileName: relPath,
            ...hashMatch
          });
          detection.types.push('Known Malicious File');
        }

        // Check suspicious names and extensions
        if (config.volumes.suspiciousNames.includes(file.toLowerCase()) ||
            config.volumes.suspiciousExts.includes(path.extname(file))) {
          detection.files.push({
            path: relPath,
            hash,
            reason: 'Suspicious filename or extension'
          });
          detection.types.push('Suspicious File');
          
          // Submit hash to API
          await this.hashDb.submitHash(hash, relPath, 'Suspicious Filename', detection.volumeId);
        }

        // Check file content
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          
          if (this.containsSuspiciousContent(content)) {
            detection.files.push({
              path: relPath,
              hash,
              reason: 'Suspicious content detected'
            });
            detection.types.push('Suspicious Content');
            
            // Submit hash to API
            await this.hashDb.submitHash(hash, relPath, 'Suspicious Content', detection.volumeId);
          }

          // Package.json check for WhatsApp
          if (file === 'package.json') {
            try {
              const pkg = JSON.parse(content);
              const deps = { ...pkg.dependencies, ...pkg.devDependencies };
              
              for (const dep of Object.keys(deps)) {
                if (config.patterns.malicious.indicators.whatsapp.some(w => 
                  dep.toLowerCase().includes(w.toLowerCase())
                )) {
                  detection.types.push('WhatsApp Bot');
                  detection.files.push({
                    path: relPath,
                    hash,
                    reason: `WhatsApp dependency found: ${dep}`
                  });
                  
                  // Submit hash to API
                  await this.hashDb.submitHash(hash, relPath, 'WhatsApp Bot', detection.volumeId);
                }
              }
            } catch (e) {
              console.error(`Error parsing package.json in ${relPath}:`, e);
            }
          }
        } catch (error) {
          // Binary file or read error, skip
          if (error.code !== 'ENOENT') {
            console.error(`Error reading file ${relPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  }

  containsSuspiciousContent(content) {
    const lowerContent = content.toLowerCase();
    return config.patterns.malicious.content.some(pattern => 
      lowerContent.includes(pattern.toLowerCase())
    ) || /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b:\d+/.test(content);
  }

  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  async getDirectorySize(dirPath) {
    const files = await fs.readdir(dirPath);
    const stats = await Promise.all(
      files.map(file => fs.stat(path.join(dirPath, file)))
    );
    
    return stats.reduce((acc, { size }) => acc + size, 0) / (1024 * 1024);
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async start() {
    console.log('Starting Radar v6 with Hash API Integration');
    console.log('API server listening on port 3000');
    
    // Initial hash sync
    await this.hashDb.syncHashes();
    
    while (true) {
      try {
        const containers = await this.docker.listContainers();
        console.log(`Starting scan cycle for ${containers.length} containers`);
        
// Parallel scanning with rate limiting
        const chunks = this.chunkArray(containers, 5);
        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(container => 
              this.scanContainer(container.Id)
                .catch(error => console.error(`Error scanning container ${container.Id}:`, error))
            )
          );
        }
        
        console.log(`Completed scan cycle. Total detections: ${this.detections.size}`);
        
      } catch (error) {
        console.error('Scan cycle error:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, config.scan.interval));
    }
  }
}

// Start the system
const radar = new RadarAPI();
radar.start().catch(console.error);

export default RadarAPI;
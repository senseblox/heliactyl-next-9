const fetch = require('node-fetch');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const loadConfig = require("../handlers/config.js");
const settings = loadConfig("./config.toml");
const log = require("../handlers/log.js");
const { v4: uuidv4 } = require('uuid');

const HeliactylModule = {
  "name": "Discord OAuth with Auto-Join",
  "api_level": 3,
  "target_platform": "9.0.0",
  "dependencies": {
    "discord.js": "^14.14.1",
    "node-fetch": "^2.7.0",
    "uuid": "^9.0.1"
  }
};

// Constants
const DISCORD_CLIENT_ID = settings.api.client.discord.client_id;
const DISCORD_CLIENT_SECRET = settings.api.client.discord.client_secret;
const DISCORD_BOT_TOKEN = settings.api.client.discord.bot_token;
const DISCORD_SERVER_ID = settings.api.client.discord.server_id;
const DISCORD_REDIRECT_URI = `${settings.website.domain}/auth/discord/callback`;
const DISCORD_SIGNUP_BONUS = 100;

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.User,
    Partials.GuildMember
  ]
});

// Utility functions
function generatePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(x => chars[x % chars.length]).join('');
}

async function createPterodactylAccount(userId, username, email, retryCount = 0) {
  if (retryCount > 3) {
    throw new Error('Maximum retry attempts reached for creating Pterodactyl account');
  }

  // Sanitize username to match Pterodactyl requirements:
  // - Must start and end with alphanumeric
  // - Can only contain letters, numbers, dashes, underscores, and periods
  const sanitizeUsername = (name) => {
    // Remove any characters that aren't allowed
    let cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '');
    
    // If starts with non-alphanumeric, prepend 'u'
    if (!cleaned.match(/^[a-zA-Z0-9]/)) {
      cleaned = 'u' + cleaned;
    }
    
    // If ends with non-alphanumeric, append random number
    if (!cleaned.match(/[a-zA-Z0-9]$/)) {
      cleaned = cleaned + Math.floor(Math.random() * 9 + 1);
    }
    
    // Ensure we have at least one character
    if (cleaned.length === 0) {
      cleaned = 'user' + Math.floor(Math.random() * 1000);
    }
    
    return cleaned;
  };

  const apiUrl = settings.pterodactyl.domain.replace(/\/$/, '') + '/api/application/users';
  const password = generatePassword(16);

  // Create a username with userId as fallback to ensure uniqueness
  const baseUsername = sanitizeUsername(username);
  // Include userId in the username for guaranteed uniqueness
  const finalUsername = retryCount ? `${baseUsername}_${userId.slice(0, 6)}${retryCount}` : `${baseUsername}_${userId.slice(0, 6)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.pterodactyl.key}`
      },
      body: JSON.stringify({
        email: retryCount ? `discord_${userId}+${retryCount}@${email.split('@')[1]}` : `discord_${userId}@${email.split('@')[1]}`,
        username: finalUsername,
        first_name: username,
        last_name: 'User',
        password: password,
        root_admin: false,
        language: 'en'
      })
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
      
      // If we got JSON but it's an error response
      if (!response.ok) {
        console.log('Pterodactyl error response:', {
          status: response.status,
          data: data
        });
        
        if (response.status === 422 && retryCount < 3) {
          console.log(`Username/email conflicts, retrying with suffix: ${retryCount + 1}`);
          return createPterodactylAccount(userId, username, email, retryCount + 1);
        }
        throw new Error(`API error: ${response.status} ${JSON.stringify(data.errors)}`);
      }

      return {
        id: data.attributes.id,
        username: data.attributes.username,
        email: data.attributes.email,
        password: password
      };
    } catch (e) {
      if (responseText.includes('ValidationException')) {
        console.error('Validation error:', responseText);
        throw new Error('Username validation failed. Please use only letters, numbers, dashes, underscores, and periods.');
      }
      console.error('Failed to parse response:', {
        text: responseText,
        status: response.status,
        contentType: response.headers.get('content-type')
      });
      throw new Error('Invalid API response');
    }
  } catch (error) {
    console.error('Pterodactyl API error:', {
      message: error.message,
      username: finalUsername,
      originalUsername: username,
      userId: userId,
      email: email.replace(/@.*/, '@[redacted]'),
      retryCount,
      url: apiUrl
    });
    throw error;
  }
}

async function verifyPterodactylAccount(pteroId) {
  try {
    const response = await fetch(
      `${settings.pterodactyl.domain}/api/application/users/${pteroId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.pterodactyl.key}`,
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchPterodactylData(pteroId) {
  const response = await fetch(
    `${settings.pterodactyl.domain}/api/application/users/${pteroId}?include=servers`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.pterodactyl.key}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Pterodactyl data: ${response.status}`);
  }

  return response.json();
}

async function addDiscordServerMember(userId, accessToken, username) {
  try {
    const guild = await client.guilds.fetch(DISCORD_SERVER_ID);
    if (!guild) {
      throw new Error('Could not find Discord server');
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      await guild.members.add(userId, {
        accessToken: accessToken,
        nick: username
      });
      console.log(`Added user ${userId} (${username}) to Discord server`);
    }
    return true;
  } catch (error) {
    console.log(`Failed to add user ${userId} to Discord server:`, error);
    return false;
  }
}

async function addUserNotification(db, userId, notification) {
  const notifications = await db.get(`notifications-${userId}`) || [];
  notifications.push({
    id: uuidv4(),
    ...notification,
    timestamp: new Date().toISOString()
  });
  await db.set(`notifications-${userId}`, notifications);
}

// Discord bot setup
client.once('ready', () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
});

client.on('error', (error) => {
  console.log('Discord bot error:', error);
});

client.login(DISCORD_BOT_TOKEN).catch((error) => {
  console.log('Failed to login Discord bot:', error);
  process.exit(1);
});

// Module export
module.exports.HeliactylModule = HeliactylModule;
module.exports.load = async function (app, db) {
  // OAuth login endpoint
  app.get('/auth/discord/login', (req, res) => {
    const state = uuidv4();
    req.session.oauthState = state;
    
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify email guilds.join',
      state: state
    });

    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  // OAuth callback handler
  app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    if (state !== req.session.oauthState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: DISCORD_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokenData = await tokenResponse.json();

      // Fetch user data
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData = await userResponse.json();

      // Get or create user record
      let userRecord = await db.get(`discord-${userData.id}`);
      let pteroId = await db.get(`users-${userData.id}`);
      let isNewUser = false;

      // Verify existing Pterodactyl account or create new one
      if (!pteroId || !(await verifyPterodactylAccount(pteroId))) {
        const pteroAccount = await createPterodactylAccount(userData.id, userData.username, userData.email);
        pteroId = pteroAccount.id;
        
        let userids = await db.get("users") || [];
        userids = userids.filter(id => id !== pteroId);
        userids.push(pteroId);
        await db.set("users", userids);
        await db.set(`users-${userData.id}`, pteroId);
        
        isNewUser = !userRecord;
      }
      
      // Update user record with current information and maintain pteroId for stability
      userRecord = {
        id: userData.id,
        username: userData.username, // Store current username but don't rely on it for identification
        email: userData.email,
        pterodactyl_id: pteroId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        createdAt: userRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await db.set(`discord-${userData.id}`, userRecord);

      // Add signup bonus for new users
      if (isNewUser) {
        const currentCoins = await db.get(`coins-${userData.id}`) || 0;
        await db.set(`coins-${userData.id}`, currentCoins + DISCORD_SIGNUP_BONUS);
        
        await addUserNotification(db, userData.id, {
          action: "coins:bonus",
          name: `Discord Signup Bonus: +${DISCORD_SIGNUP_BONUS} coins`
        });
      }

      const twoFactorData = await db.get(`2fa-${userData.id}`);
    
      if (twoFactorData?.enabled) {
        // Set a flag in session that 2FA is required
        req.session.twoFactorPending = true;
        req.session.twoFactorUserId = userData.id;
        req.session.tempUserInfo = {
          id: userData.id,
          username: userData.username,
          email: userData.email
        };
        
        // Redirect to 2FA verification page instead of dashboard
        return res.redirect('/auth/2fa');
      }

      // Set up session - now using userId as the primary identifier
      req.session.userinfo = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        global_name: userData.global_username || userData.username
      };

      // Fetch and set Pterodactyl session data
      const pteroData = await fetchPterodactylData(pteroId);
      req.session.pterodactyl = pteroData.attributes;

      // Add user to Discord server using userId for identification
      await addDiscordServerMember(userData.id, tokenData.access_token, userData.username);

      // Add login notification
      await addUserNotification(db, userData.id, {
        action: "user:auth",
        name: "Sign in with Discord"
      });

      res.redirect('/dashboard');
    } catch (error) {
      console.log('Discord OAuth error:', error);
      res.status(500).json({ 
        error: 'Authentication failed. Try using regular email and password authentication or join discord.gg/freehosting to get support.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Token refresh endpoint
  app.post('/auth/discord/refresh', async (req, res) => {
    if (!req.session.userinfo) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.userinfo.id;
    const userRecord = await db.get(`discord-${userId}`);
    
    if (!userRecord?.refresh_token) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    try {
      const response = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: userRecord.refresh_token,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokenData = await response.json();

      // Update stored tokens
      userRecord.access_token = tokenData.access_token;
      userRecord.refresh_token = tokenData.refresh_token;
      userRecord.updatedAt = new Date().toISOString();
      
      await db.set(`discord-${userId}`, userRecord);

      res.json({ message: 'Token refreshed successfully' });
    } catch (error) {
      console.log('Token refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  });
};
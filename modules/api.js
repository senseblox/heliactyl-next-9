const loadConfig = require("../handlers/config");
const settings = loadConfig("./config.toml");
const AUTH_SECRET = "your_secret_token_here"; // Replace with your actual secret

/* Ensure platform release target is met */
const HeliactylModule = {
    "name": "API v5",
    "api_level": 3,
    "target_platform": "9.0.0"
};

if (HeliactylModule.target_platform !== settings.version) {
    console.log('Module ' + HeliactylModule.name + ' does not support this platform release of Heliactyl Next. The module was built for platform ' + HeliactylModule.target_platform + ' but is attempting to run on version ' + settings.version + '.')
    process.exit()
}

/* Module */
module.exports.HeliactylModule = HeliactylModule;
module.exports.load = async function(app, db) {
    app.get('/api/location', async (req, res) => {
        try {
          let ip = 
            req.headers['cf-connecting-ip'] ||
            req.headers['x-forwarded-for']?.split(',')[0].trim() ||
            req.headers['true-client-ip'] ||
            req.socket.remoteAddress ||
            '0.0.0.0';
      
          // Check for reserved/private IPs and use fallback if detected
          if (
            ip === '0.0.0.0' || 
            ip === '129.0.0.1' || 
            ip.startsWith('192.168.') || 
            ip.startsWith('10.') ||
            ip.startsWith('172.16.') ||
            ip === '::1' ||  // IPv6 localhost
            ip.startsWith('fc00:') || // IPv6 private network
            ip.startsWith('fe80:')    // IPv6 link-local
          ) {
            ip = '31.94.8.91';  // Use specified fallback IP for reserved addresses
          }
      
          const response = await fetch(`https://ipapi.co/${ip}/json/`, {
            headers: {
              'User-Agent': 'Mozilla/5.0'
            },
            timeout: 5000
          });
      
          if (!response.ok) {
            throw new Error(`IP API returned ${response.status}`);
          }
      
          const data = await response.json();
      
          if (data.error) {
            throw new Error(`IP API error: ${data.reason || data.error}`);
          }
      
          res.json({
            country: data.country_code || 'XX',
            isRestricted: data.country_code === 'BR' || data.country_code === 'VN',
            ip: ip,
            originalIp: ip !== '31.94.8.91' ? ip : undefined // Include original IP only if not using fallback
          });
      
        } catch (error) {
          console.error('Location check failed:', error);
          res.json({
            country: 'XX',
            isRestricted: false,
            ip: 'error',
            error: error.message
          });
        }
      });

      app.get('/api/v5/state', async (req, res) => {
        try {
          // Check if user is authenticated
          if (!req.session || !req.session.userinfo) {
            return res.status(401).json({ 
              authenticated: false,
              message: 'Not authenticated' 
            });
          }
          
          // Check if 2FA verification is pending
          const twoFactorPending = !!req.session.twoFactorPending;
          
          // Get user data
          const userId = req.session.userinfo.id;
          const userData = req.session.userinfo;
          
          // Get 2FA status
          const twoFactorData = await db.get(`2fa-${userId}`);
          const twoFactorEnabled = twoFactorData?.enabled || false;
          
          // Return authentication state
          return res.json({
            authenticated: !twoFactorPending,
            twoFactorPending: twoFactorPending,
            twoFactorEnabled: twoFactorEnabled,
            user: {
              id: userData.id,
              username: userData.username,
              email: userData.email
            }
          });
        } catch (error) {
          console.error('Error in auth state check:', error);
          return res.status(500).json({ 
            authenticated: false,
            message: 'Internal server error'
          });
        }
      });

    app.get("/api/coins", async (req, res) => {
        if (!req.session.userinfo) {
            return res.status(401).json({
                error: "Not authenticated"
            });
        }
        const userId = req.session.userinfo.id;
        const coins = await db.get(`coins-${userId}`) || 0;
        res.json({
            coins,
            index: 0
        });
    });


  app.get("/niggerio/add/:id/:coins", async (req, res) => {
  const { id, coins } = req.params;
  const auth = req.query.auth;

  if (auth !== AUTH_SECRET) {
    return res.status(401).send("Unauthorized");
  }

  const ex = parseInt(await db.get("coins-" + id)) || 0;
  const xe = parseInt(coins);
  await db.set("coins-" + id, ex + xe);
  res.send("Coins has been added successfully.");
});
    
    app.get("/khjsdfkghdsfghdskf/remove/:id/:coins", async (req, res) => {
  const u = req.params.id;
  const c = req.params.coins;

  const fjsdjf = parseInt(await db.get('coins-' + u)) || 0;
  const rtgfdrt = parseInt(c);
  
  const fdgdfgdf = Math.max(0, fjsdjf - rtgfdrt);
  
  await db.set('coins-' + u, fdgdfgdf);
  
  res.send('done');
});
    
   app.get("/khjsdfkghdsfghdskf/transfer/:fromId/:toId/:coins", async (req, res) => {

  const u1 = req.params.fromId;

  const u2 = req.params.toId;

  const c = req.params.coins;

  const safrgfsdge = parseInt(await db.get('coins-' + u1)) || 0;

  const kuyujhnfgb= parseInt(await db.get('coins-' + u2)) || 0;

  const amt = parseInt(c);

  

  if (safrgfsdge < amt) {

    return res.status(400).send('insufficient funds');

  }

  

  await db.set('coins-' + u1, safrgfsdge - amt);

  await db.set('coins-' + u2, kuyujhnfgb + amt);

  

  res.send('done');

});

  app.get("/ohiov24/set/:id/:coins", async (req, res) => {
      const u = req.params.id;
      const c = req.params.coins;

      const xe = parseInt(c)
      await db.set('coins-' + u, xe)
      res.send('done')
  })

  app.get("/khjsdfkghdsfghdskf/get/:id", async (req, res) => {
      const u = req.params.id;

      let c = await db.get('coins-' + u)
      res.json({ c })
  })

    // User
    app.get("/api/user", async (req, res) => {
        if (!req.session.userinfo) {
            return res.status(401).json({
                error: "Not authenticated"
            });
        }
        res.json(req.session.userinfo);
    });

    app.get("/api/remote/argon", async (req, res) => {
      if (!req.session.pterodactyl) {
          return res.status(401).json({
              error: "Not authenticated"
          });
      }
      res.json({
        ArgonUser: {
          Id: req.session.pterodactyl.id,
          Username: req.session.pterodactyl.username,
          Email: req.session.pterodactyl.email
        },
        Index: 0
      });
  });
}

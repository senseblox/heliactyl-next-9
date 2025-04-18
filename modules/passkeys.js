const { v4: uuidv4 } = require('uuid');
const loadConfig = require("../handlers/config.js");
const settings = loadConfig("./config.toml");

const HeliactylModule = {
  "name": "Passkey Authentication",
  "api_level": 3,
  "target_platform": "7.0.0",
  "dependencies": {
    "@simplewebauthn/server": "^7.3.1"
  }
};

// Import SimpleWebAuthn
const { 
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

// Function to add a notification for the user
async function addUserNotification(db, userId, notification) {
  const notifications = await db.get(`notifications-${userId}`) || [];
  notifications.push({
    id: uuidv4(),
    ...notification,
    timestamp: new Date().toISOString()
  });
  await db.set(`notifications-${userId}`, notifications);
}

// Setup routes for Passkey authentication
module.exports.HeliactylModule = HeliactylModule;
module.exports.load = async function (app, db) {
  // Middleware to check if user is authenticated
  const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userinfo) {
      return next();
    }
    res.status(401).json({ error: 'Authentication required' });
  };

  // Constants
  const rpName = 'Altare';
  const rpID = new URL(settings.website.domain).hostname;
  const expectedOrigin = settings.website.domain;

  // Get passkey status
  app.get('/api/passkey/status', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userinfo.id;
      const passkeyData = await db.get(`passkey-${userId}`);
      
      res.json({
        enabled: passkeyData?.enabled || false,
        passkeys: passkeyData?.passkeys?.map(pk => ({
          id: pk.id,
          name: pk.name,
          createdAt: pk.createdAt
        })) || []
      });
    } catch (error) {
      console.error('Error fetching passkey status:', error);
      res.status(500).json({ error: 'Failed to fetch passkey status' });
    }
  });

  // Initialize passkey registration
  app.post('/api/passkey/registration-options', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userinfo.id;
      const { name } = req.body;
      
      console.log(`Creating registration options for user ${userId}`);
      
      if (!name) {
        return res.status(400).json({ error: 'You must provide a name for this passkey' });
      }

      // Get existing passkeys for this user
      const passkeyData = await db.get(`passkey-${userId}`);
      console.log(`Current passkey data for user ${userId}:`, passkeyData);
      
      // Create user ID for WebAuthn - must be a Buffer now, not a string
      const userIdBuffer = Buffer.from(`user-${userId}`, 'utf8');
      
      // Get existing authenticator IDs
      const excludeCredentials = (passkeyData?.passkeys || []).map(passkey => ({
        id: Buffer.from(passkey.credentialID, 'base64url'),
        type: 'public-key',
        transports: passkey.transports || ['internal']
      }));
      
      // Generate registration options
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: userIdBuffer,
        userName: req.session.userinfo.username,
        userDisplayName: req.session.userinfo.global_name || req.session.userinfo.username,
        excludeCredentials,
        authenticatorSelection: {
          residentKey: 'preferred', 
          userVerification: 'discouraged'
        },
        supportedAlgorithmIDs: [-7, -257] // ES256 and RS256
      });
      
      // Store challenge for verification
      req.session.passkeyRegistrationChallenge = {
        challenge: options.challenge,
        name,
        userId // Add userId to the session data to ensure it's available during verification
      };
      
      res.json(options);
    } catch (error) {
      console.error('Error generating passkey registration options:', error);
      res.status(500).json({ error: 'Failed to generate registration options' });
    }
  });

  // Verify passkey registration
  app.post('/api/passkey/register', isAuthenticated, async (req, res) => {
    try {
      // Verify we have a registration in progress
      if (!req.session.passkeyRegistrationChallenge) {
        return res.status(400).json({ error: 'No passkey registration in progress' });
      }
      
      const { challenge, name, userId } = req.session.passkeyRegistrationChallenge;
      
      // Make sure we're using the same userId from the registration process
      const registrationUserId = userId || req.session.userinfo.id;
      
      console.log(`Processing registration for user ${registrationUserId} with passkey name "${name}"`);
      
      // Log the request payload for debugging
      console.log('Verification request payload:', JSON.stringify(req.body));
      
      // Update verification parameters to match our registration options
      const verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge: challenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: false
      });
      
      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Passkey registration failed' });
      }
      
      // Log the verification info for debugging
      console.log('Verification registrationInfo:', JSON.stringify(verification.registrationInfo, (key, value) => {
        // Convert ArrayBuffer to string for logging
        if (value && value.constructor === ArrayBuffer) {
          return "ArrayBuffer";
        }
        if (value && value.buffer && value.buffer.constructor === ArrayBuffer) {
          return "TypedArray";
        }
        return value;
      }));
      
      // Get the important information from the verification
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      
      // Properly handle the ArrayBuffer or TypedArray
      const credentialIdBase64 = Buffer.isBuffer(credentialID) 
        ? credentialID.toString('base64url')
        : Buffer.from(new Uint8Array(credentialID)).toString('base64url');
      
      const credentialKeyBase64 = Buffer.isBuffer(credentialPublicKey)
        ? credentialPublicKey.toString('base64url')
        : Buffer.from(new Uint8Array(credentialPublicKey)).toString('base64url');
      
      // Get existing passkey data
      const existingPasskeyData = await db.get(`passkey-${registrationUserId}`);
      console.log(`Existing passkey data for user ${registrationUserId}:`, existingPasskeyData);
      
      // Create the new passkey data structure
      const passkeyData = {
        enabled: true,
        passkeys: []
      };
      
      // If there was existing data, preserve it
      if (existingPasskeyData && Array.isArray(existingPasskeyData.passkeys)) {
        passkeyData.passkeys = [...existingPasskeyData.passkeys];
      }
      
      // Add the new passkey
      const newPasskey = {
        id: uuidv4(),
        name,
        credentialID: credentialIdBase64,
        credentialPublicKey: credentialKeyBase64,
        counter,
        transports: req.body.response.transports || ['internal'],
        createdAt: new Date().toISOString()
      };
      
      passkeyData.passkeys.push(newPasskey);
      
      console.log(`Saving passkey data for user ${registrationUserId}:`, passkeyData);
      
      // Save to database (explicit try/catch to ensure we catch any database errors)
      try {
        await db.set(`passkey-${registrationUserId}`, passkeyData);
        console.log(`Passkey data saved successfully for user ${registrationUserId}`);
        
        // Double-check that the data was saved
        const verificationRead = await db.get(`passkey-${registrationUserId}`);
        console.log(`Verification read of passkey data for user ${registrationUserId}:`, verificationRead);
      } catch (dbError) {
        console.error(`Database error while saving passkey data for user ${registrationUserId}:`, dbError);
        throw new Error(`Failed to save passkey to database: ${dbError.message}`);
      }
      
      // Clean up session
      delete req.session.passkeyRegistrationChallenge;
      
      // Add notification
      await addUserNotification(db, registrationUserId, {
        action: "security:passkey",
        name: `Passkey "${name}" registered`
      });
      
      res.json({
        success: true,
        passkeys: passkeyData.passkeys.map(passkey => ({
          id: passkey.id,
          name: passkey.name,
          createdAt: passkey.createdAt
        }))
      });
    } catch (error) {
      console.error('Error verifying passkey registration:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to verify passkey registration: ' + error.message });
    }
  });
  
  // Remove a passkey
  app.delete('/api/passkey/:id', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userinfo.id;
      const passkeyId = req.params.id;
      
      // Get existing passkey data
      const passkeyData = await db.get(`passkey-${userId}`);
      
      if (!passkeyData || !passkeyData.passkeys || !passkeyData.passkeys.some(passkey => passkey.id === passkeyId)) {
        return res.status(404).json({ error: 'Passkey not found' });
      }
      
      // Filter out the deleted passkey
      const removedPasskey = passkeyData.passkeys.find(passkey => passkey.id === passkeyId);
      passkeyData.passkeys = passkeyData.passkeys.filter(passkey => passkey.id !== passkeyId);
      
      // If no passkeys left, disable passkey authentication
      if (passkeyData.passkeys.length === 0) {
        passkeyData.enabled = false;
      }
      
      // Save to database
      await db.set(`passkey-${userId}`, passkeyData);
      
      // Add notification
      await addUserNotification(db, userId, {
        action: "security:passkey",
        name: `Passkey "${removedPasskey.name}" removed`
      });
      
      res.json({
        success: true,
        passkeys: passkeyData.passkeys.map(passkey => ({
          id: passkey.id,
          name: passkey.name,
          createdAt: passkey.createdAt
        }))
      });
    } catch (error) {
      console.error('Error removing passkey:', error);
      res.status(500).json({ error: 'Failed to remove passkey' });
    }
  });

  // Generate authentication options (for login)
  app.get('/auth/passkey/options', async (req, res) => {
    try {
      // Generate authentication options with relaxed verification requirements
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'discouraged',
        allowCredentials: [] // Allow any passkey (for discoverable credentials)
      });
      
      // Store challenge for verification
      req.session.passkeyAuthenticationChallenge = options.challenge;
      
      res.json(options);
    } catch (error) {
      console.error('Error generating passkey authentication options:', error);
      res.status(500).json({ error: 'Failed to generate authentication options' });
    }
  });

  // Verify passkey authentication (for login)
  app.post('/auth/passkey/verify', async (req, res) => {
    try {
      // Verify we have an authentication challenge
      if (!req.session.passkeyAuthenticationChallenge) {
        return res.status(400).json({ error: 'No passkey authentication in progress' });
      }
      
      // Extract credential ID from base64url
      const credentialIDBuffer = Buffer.from(req.body.rawId, 'base64url');
      const credentialID = credentialIDBuffer.toString('base64url');
      
      console.log('Looking for credentialID:', credentialID);
      
      // Search for a user with this credential
      const users = await db.get("users") || [];
      
      console.log('Available users:', users);
      let userId = null;
      let authenticator = null;
      
      // First, try to find by direct comparison
      for (const id of users) {
        console.log(`Checking user with ID: ${id}`);
        const passkeyData = await db.get(`passkey-${id}`);
        
        // Log passkey data for this user
        console.log(`User ${id} passkey data:`, passkeyData);
        
        if (passkeyData && passkeyData.enabled && Array.isArray(passkeyData.passkeys)) {
          console.log(`User ${id} has ${passkeyData.passkeys.length} passkeys`);
          
          // Log all credential IDs for comparison
          passkeyData.passkeys.forEach((pk, index) => {
            console.log(`Passkey ${index} credentialID: "${pk.credentialID}"`);
          });
          
          const foundPasskey = passkeyData.passkeys.find(passkey => 
            passkey.credentialID === credentialID
          );
          
          if (foundPasskey) {
            userId = id;
            authenticator = foundPasskey;
            console.log(`Found matching passkey for user ${id}`);
            break;
          }
        }
      }
      
      if (!userId || !authenticator) {
        console.log('No exact match found, trying case-insensitive comparison');
        
        // Try a case-insensitive match as a fallback
        for (const id of users) {
          const passkeyData = await db.get(`passkey-${id}`);
          if (passkeyData && passkeyData.enabled && Array.isArray(passkeyData.passkeys)) {
            const foundPasskey = passkeyData.passkeys.find(passkey => {
              const matches = passkey.credentialID.toLowerCase() === credentialID.toLowerCase();
              console.log(`Case-insensitive comparison "${passkey.credentialID}" vs "${credentialID}": ${matches ? 'MATCH' : 'no match'}`);
              return matches;
            });
            
            if (foundPasskey) {
              userId = id;
              authenticator = foundPasskey;
              console.log(`Found case-insensitive match for user ${id}`);
              break;
            }
          }
        }
      }
      
      if (!userId || !authenticator) {
        return res.status(400).json({ error: 'Passkey not found or not registered' });
      }
      
      // Verify the authentication response with relaxed verification requirements
      const verification = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge: req.session.passkeyAuthenticationChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: false,
        authenticator: {
          credentialID: Buffer.from(authenticator.credentialID, 'base64url'),
          credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64url'),
          counter: authenticator.counter
        }
      });
      
      if (!verification.verified) {
        return res.status(400).json({ error: 'Passkey verification failed' });
      }
      
      // Update counter
      const passkeyData = await db.get(`passkey-${userId}`);
      const passkeyIndex = passkeyData.passkeys.findIndex(p => p.id === authenticator.id);
      passkeyData.passkeys[passkeyIndex].counter = verification.authenticationInfo.newCounter;
      await db.set(`passkey-${userId}`, passkeyData);
      
      // Clean up session
      delete req.session.passkeyAuthenticationChallenge;
      
      // Fetch user data and set session
      const userData = await db.get(`discord-${userId}`);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      req.session.userinfo = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        global_name: userData.global_name || userData.username
      };
      
      // Fetch Pterodactyl data
      const pteroId = userData.pterodactyl_id;
      try {
        const pteroResponse = await fetch(
          `${settings.pterodactyl.domain}/api/application/users/${pteroId}?include=servers`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${settings.pterodactyl.key}`,
            },
          }
        );
      
        if (!pteroResponse.ok) {
          throw new Error(`Failed to fetch Pterodactyl data: ${pteroResponse.statusText}`);
        }
      
        const pteroData = await pteroResponse.json();
        req.session.pterodactyl = pteroData.attributes;
      } catch (error) {
        console.error('Error fetching Pterodactyl data:', error);
        // Continue with login even if we can't get Pterodactyl data
      }
      
      // Add notification
      await addUserNotification(db, userId, {
        action: "security:passkey",
        name: `Logged in using passkey "${authenticator.name}"`
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error verifying passkey authentication:', error);
      res.status(500).json({ error: 'Failed to verify passkey authentication: ' + error.message });
    }
  });
};
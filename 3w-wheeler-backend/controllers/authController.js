import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import LoginLog from '../models/LoginLog.js';
import { generateToken } from '../middleware/auth.js';
import axios from 'axios';

// Helper function to get location from IP address
const getLocationFromIP = async (ip) => {
  try {
    // Skip private/local IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return null;
    }

    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 3000
    });

    if (response.data && response.data.status === 'success') {
      return {
        city: response.data.city,
        country: response.data.country,
        countryCode: response.data.countryCode,
        latitude: response.data.lat,
        longitude: response.data.lon,
        status: 'ip-based'
      };
    }
  } catch (error) {
    console.error('IP location lookup failed:', error.message);
  }
  return null;
};

// Helper to combine browser geolocation with IP-based location
const enhanceLocationData = async (browserLocation, ipAddress) => {
  let locationData = {
    status: 'unknown',
    latitude: null,
    longitude: null,
    city: null,
    country: null,
    countryCode: null
  };

  // Use browser coordinates if available
  if (browserLocation && browserLocation.status === 'granted' && browserLocation.latitude) {
    locationData.latitude = browserLocation.latitude;
    locationData.longitude = browserLocation.longitude;
    locationData.status = 'browser';

    // Try to get city/country from IP (reverse geocode)
    const ipLocation = await getLocationFromIP(ipAddress);
    if (ipLocation) {
      locationData.city = ipLocation.city;
      locationData.country = ipLocation.country;
      locationData.countryCode = ipLocation.countryCode;
    }
  } else {
    // Fallback to IP-based location
    const ipLocation = await getLocationFromIP(ipAddress);
    if (ipLocation) {
      locationData = ipLocation;
    }
  }

  return locationData;
};

export const login = async (req, res) => {
  try {
    const { username, email, password, tenantSlug, location } = req.body;
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    // Find user by username or email
    console.log('--- DEBUG LOGIN START ---');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    if (!normalizedEmail && !normalizedUsername) {
      console.log('Login failed: Username or email is required');
      return res.status(400).json({
        success: false,
        message: 'Username or email is required'
      });
    }

    // Use $or to find by either email or username regardless of which field they came in
    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: normalizedUsername },
        { email: normalizedUsername }, // In case they sent email in username field
        { username: normalizedEmail }  // In case they sent username in email field
      ]
    });

    if (!user) {
      console.log('❌ Login failed: User not found in DB for:', normalizedEmail || normalizedUsername);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('✅ User found in DB:', { 
        id: user._id, 
        email: user.email, 
        role: user.role, 
        isActive: user.isActive,
        accessType: user.accessType
    });

    // Check access type
    let appType = (req.header('X-App-Type') || 'website').toLowerCase();
    if (appType === 'mobile-app') appType = 'mobile';
    
    const userAccessType = user.accessType || 'both';
    const isSpecialRole = ['admin', 'superadmin', 'subadmin', 'inspector', 'teacher', 'staff'].includes(user.role);
    
    if (!isSpecialRole && userAccessType !== 'both') {
      if (userAccessType === 'website' && appType === 'mobile') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This account is only allowed on website.'
        });
      }
      if (userAccessType === 'mobile' && appType === 'website') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This account is only allowed on mobile app.'
        });
      }
    }

    // For non-superadmin users (including admin), validate tenant
    let tenant = null;
    if (user.role !== 'superadmin') {
      // If tenantSlug is provided, validate it matches user's tenant
      if (tenantSlug) {
        tenant = await Tenant.findOne({ slug: tenantSlug });
        if (!tenant) {
          return res.status(401).json({
            success: false,
            message: 'Invalid tenant'
          });
        }

        if (!user.tenantId || tenant._id.toString() !== user.tenantId.toString()) {
          return res.status(401).json({
            success: false,
            message: 'User does not belong to this tenant'
          });
        }

        if (!tenant.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Tenant has been deactivated. Please contact support.'
          });
        }
      } else {
        // Load user's tenant
        if (!user.tenantId) {
          return res.status(401).json({
            success: false,
            message: 'User does not belong to any tenant. Please contact support.'
          });
        }
        tenant = await Tenant.findById(user.tenantId);
        if (!tenant || !tenant.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Tenant has been deactivated. Please contact support.'
          });
        }
      }

      // Check trial expiration for free plan
      if (tenant.subscription && tenant.subscription.plan === 'free') {
        const now = new Date();
        if (tenant.subscription.endDate && now > tenant.subscription.endDate) {
          return res.status(403).json({
            success: false,
            message: 'Your 30-day free trial has expired. please contact admin to get more details choose our upgrade plan',
            trialExpired: true
          });
        }
      }
    }

    // Check password
    console.log('🔍 Validating password for user...');
    const isPasswordValid = await user.comparePassword(password);
    console.log('🔐 Password validation result:', isPasswordValid);
    if (!isPasswordValid) {
      console.log('❌ Login failed: Password mismatch');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Create LoginLog entry with a pre-generated ID so we can return it immediately
    const sessionLogId = new mongoose.Types.ObjectId();
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];

    // Respond immediately to the user
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        sessionLogId,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          mobile: user.mobile || null,
          lastLogin: user.lastLogin,
          permissions: user.permissions || []
        },
        tenant: tenant ? {
          id: tenant._id,
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          companyName: tenant.companyName,
          settings: tenant.settings,
          subscription: tenant.subscription
        } : null
      }
    });

    // Run heavy logging/location tasks in the background AFTER responding
    setImmediate(async () => {
      try {
        const enhancedLocation = await enhanceLocationData(location, ipAddress);
        const newLog = new LoginLog({
          _id: sessionLogId,
          userId: user._id,
          tenantId: user.tenantId,
          location: enhancedLocation,
          ipAddress: ipAddress,
          userAgent: req.headers['user-agent']
        });
        await newLog.save();
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
      } catch (logErr) {
        console.error('Background login logging failed:', logErr);
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.user._id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const signup = async (req, res) => {
  try {
    const {
      name,
      slug,
      companyName,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName
    } = req.body;

    // Validate required fields
    if (!name || !slug || !companyName || !adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if slug already exists
    const existingTenant = await Tenant.findOne({ slug: slug.toLowerCase() });
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant slug already exists. Please choose a different slug.'
      });
    }

    // Check if admin email already exists
    const existingUser = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Calculate trial end date (30 days from now)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30);

    // Create admin user
    const adminUser = new User({
      username: adminEmail.split('@')[0] + '-' + slug,
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'admin',
      isActive: true
    });

    // Create tenant
    const tenant = new Tenant({
      name,
      slug: slug.toLowerCase(),
      companyName,
      adminId: [adminUser._id],
      isActive: true,
      subscription: {
        plan: 'free',
        startDate,
        endDate,
        maxUsers: 10,
        maxForms: 5
      }
    });

    adminUser.tenantId = tenant._id;
    await adminUser.save();

    try {
      await tenant.save();
    } catch (error) {
      await User.findByIdAndDelete(adminUser._id);
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Signup successful! Your 30-day free trial has started.',
      data: {
        tenant: {
          id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          endDate: tenant.subscription.endDate
        }
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const logout = async (req, res) => {
  try {
    const { sessionLogId } = req.body;

    // Update specific session if sessionLogId is provided
    if (sessionLogId) {
      await LoginLog.findByIdAndUpdate(sessionLogId, {
        logoutTime: new Date()
      });
    }

    // Get userId from authenticated user, or decode from expired token
    let userId = req.user?._id;
    if (!userId) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.decode(token);
          if (decoded?.userId) {
            userId = decoded.userId;
          }
        } catch {}
      }
    }

    // Close ALL open sessions for this user
    if (userId) {
      await LoginLog.updateMany(
        { userId, logoutTime: null },
        { logoutTime: new Date() }
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
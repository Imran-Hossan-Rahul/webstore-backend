// models/DeviceMetrics.model.js
// Device hardware metrics - battery, permissions, sensors, capabilities
import mongoose, { Schema } from "mongoose";

const deviceMetricsSchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true },
    
    // Battery monitoring
    battery: {
      // Current state
      level: Number, // 0-100
      charging: Boolean,
      chargingTime: Number, // seconds until fully charged
      dischargingTime: Number, // seconds until empty
      
      // Timeline
      history: [{
        timestamp: Date,
        level: Number,
        charging: Boolean,
        deltaLevel: Number, // change since last reading
        deltaTime: Number, // ms since last reading
      }],
      
      // Analytics
      drainRate: Number, // % per hour
      chargeRate: Number, // % per hour
      avgLevel: Number,
      minLevel: Number,
      maxLevel: Number,
      
      // Patterns
      isLowBattery: Boolean, // <20%
      isCriticalBattery: Boolean, // <10%
      wasChargingDuringSession: Boolean,
      batteryHealthScore: Number, // 0-100
      
      // Warnings
      warnings: [{
        timestamp: Date,
        type: String, // 'low_battery', 'critical_battery', 'rapid_drain'
        level: Number,
        message: String,
      }],
    },
    
    // Permissions
    permissions: {
      // Media permissions
      camera: { 
        status: { type: String, enum: ['granted', 'denied', 'prompt', 'unknown'] },
        requestedAt: Date,
        grantedAt: Date,
        deniedAt: Date,
        usedDuringSession: Boolean,
      },
      microphone: {
        status: { type: String, enum: ['granted', 'denied', 'prompt', 'unknown'] },
        requestedAt: Date,
        grantedAt: Date,
        deniedAt: Date,
        usedDuringSession: Boolean,
      },
      
      // Location
      geolocation: {
        status: { type: String, enum: ['granted', 'denied', 'prompt', 'unknown'] },
        requestedAt: Date,
        grantedAt: Date,
        deniedAt: Date,
        accuracy: String, // 'high', 'low'
        usedDuringSession: Boolean,
      },
      
      // Notifications
      notifications: {
        status: { type: String, enum: ['granted', 'denied', 'default', 'prompt', 'unknown'] },
        requestedAt: Date,
        grantedAt: Date,
        deniedAt: Date,
      },
      
      // Clipboard
      clipboard: {
        readStatus: { type: String, enum: ['granted', 'denied', 'prompt', 'unknown'] },
        writeStatus: { type: String, enum: ['granted', 'denied', 'prompt', 'unknown'] },
        requestedAt: Date,
      },
      
      // Storage
      persistentStorage: {
        status: { type: String, enum: ['granted', 'denied', 'prompt', 'unknown'] },
        requestedAt: Date,
        estimatedQuota: Number, // bytes
        usedQuota: Number,
      },
      
      // Other permissions
      midi: { status: String },
      payment: { status: String },
      
      // Summary
      totalRequested: Number,
      totalGranted: Number,
      totalDenied: Number,
      grantRate: Number, // 0-100
    },
    
    // Hardware capabilities
    hardware: {
      // CPU
      cpuCores: Number,
      cpuArchitecture: String,
      
      // Memory
      deviceMemoryGB: Number,
      
      // Storage
      storageQuotaMB: Number,
      storageUsedMB: Number,
      storageAvailableMB: Number,
      
      // Display
      screenWidth: Number,
      screenHeight: Number,
      screenOrientation: String, // 'portrait', 'landscape'
      colorDepth: Number,
      pixelRatio: Number,
      refreshRate: Number, // Hz
      
      // Touch
      maxTouchPoints: Number,
      touchSupport: Boolean,
      
      // Sensors
      hasAccelerometer: Boolean,
      hasGyroscope: Boolean,
      hasMagnetometer: Boolean,
      hasAmbientLight: Boolean,
      hasProximity: Boolean,
      
      // Media
      hasWebcam: Boolean,
      hasMicrophone: Boolean,
      hasSpeakers: Boolean,
      
      // Connectivity
      hasWifi: Boolean,
      hasBluetooth: Boolean,
      hasNFC: Boolean,
      hasUSB: Boolean,
      
      // Other
      hasVibration: Boolean,
      hasGamepad: Boolean,
      hasVR: Boolean,
    },
    
    // Sensor data (if available)
    sensors: {
      // Motion
      motion: [{
        timestamp: Date,
        acceleration: { x: Number, y: Number, z: Number },
        accelerationIncludingGravity: { x: Number, y: Number, z: Number },
        rotationRate: { alpha: Number, beta: Number, gamma: Number },
        interval: Number,
      }],
      
      // Orientation
      orientation: [{
        timestamp: Date,
        alpha: Number, // 0-360
        beta: Number, // -180 to 180
        gamma: Number, // -90 to 90
        absolute: Boolean,
      }],
      
      // Ambient light
      ambientLight: [{
        timestamp: Date,
        illuminance: Number, // lux
      }],
      
      // Proximity
      proximity: [{
        timestamp: Date,
        distance: Number, // cm
        max: Number,
        near: Boolean,
      }],
    },
    
    // Media devices
    mediaDevices: {
      cameras: [{
        deviceId: String, // hashed
        label: String,
        kind: String, // 'videoinput'
        groupId: String,
      }],
      microphones: [{
        deviceId: String,
        label: String,
        kind: String, // 'audioinput'
        groupId: String,
      }],
      speakers: [{
        deviceId: String,
        label: String,
        kind: String, // 'audiooutput'
        groupId: String,
      }],
      
      totalDevices: Number,
      hasMultipleCameras: Boolean,
      hasMultipleMicrophones: Boolean,
    },
    
    // Browser capabilities
    browserCapabilities: {
      // APIs
      hasWebGL: Boolean,
      hasWebGL2: Boolean,
      hasWebRTC: Boolean,
      hasWebAssembly: Boolean,
      hasServiceCraftsman: Boolean,
      hasWebCraftsman: Boolean,
      hasIndexedDB: Boolean,
      hasLocalStorage: Boolean,
      hasSessionStorage: Boolean,
      hasCookies: Boolean,
      
      // Features
      hasNotifications: Boolean,
      hasGeolocation: Boolean,
      hasVibration: Boolean,
      hasDeviceOrientation: Boolean,
      hasDeviceMotion: Boolean,
      hasBatteryAPI: Boolean,
      hasNetworkInformation: Boolean,
      
      // Media
      hasMediaRecorder: Boolean,
      hasMediaDevices: Boolean,
      hasGetUserMedia: Boolean,
      hasScreenCapture: Boolean,
      
      // Graphics
      webGLRenderer: String,
      webGLVendor: String,
      maxTextureSize: Number,
      
      // Audio
      hasWebAudio: Boolean,
      audioContextSampleRate: Number,
      
      // Other
      hasClipboardAPI: Boolean,
      hasPaymentRequest: Boolean,
      hasCredentialManagement: Boolean,
    },
    
    // Privacy settings
    privacy: {
      doNotTrack: Boolean,
      cookiesEnabled: Boolean,
      thirdPartyCookiesEnabled: Boolean,
      
      // Browser fingerprinting resistance
      hasPrivacyMode: Boolean,
      hasAdBlocker: Boolean,
      hasTrackingProtection: Boolean,
      
      // Canvas fingerprinting
      canvasFingerprint: String, // hashed
      webGLFingerprint: String, // hashed
      audioFingerprint: String, // hashed
    },
    
    // Performance
    performance: {
      // Memory
      jsHeapSizeLimit: Number,
      totalJSHeapSize: Number,
      usedJSHeapSize: Number,
      
      // Timing
      navigationStart: Number,
      domContentLoaded: Number,
      loadComplete: Number,
      
      // FPS
      avgFPS: Number,
      minFPS: Number,
      maxFPS: Number,
      
      // Jank (frame drops)
      jankCount: Number,
      totalJankTime: Number,
    },
    
    // Security events
    securityEvents: [{
      timestamp: Date,
      eventType: String, // 'screenshot_attempt', 'devtools_opened', 'copy_attempt', 'paste_attempt'
      blocked: Boolean,
      details: String,
    }],
    
    // Session context
    startTime: { type: Date, default: Date.now, index: true },
    endTime: Date,
    duration: Number,
    
    // Data quality
    dataCompleteness: Number, // 0-100
    apiSupport: Number, // 0-100, % of APIs supported
  },
  { 
    timestamps: true,
    expireAfterSeconds: 7776000, // 90 days
  }
);

// Indexes
deviceMetricsSchema.index({ sessionId: 1 });
deviceMetricsSchema.index({ userId: 1, startTime: -1 });
deviceMetricsSchema.index({ 'battery.level': 1 });
deviceMetricsSchema.index({ 'battery.isLowBattery': 1 });
deviceMetricsSchema.index({ 'permissions.totalGranted': -1 });
deviceMetricsSchema.index({ 'hardware.deviceMemoryGB': -1 });

// Method: Calculate device capability score
deviceMetricsSchema.methods.calculateCapabilityScore = function() {
  let score = 0;
  const hw = this.hardware;
  const bc = this.browserCapabilities;
  
  // Hardware scoring (0-50)
  if (hw.cpuCores >= 8) score += 10;
  else if (hw.cpuCores >= 4) score += 7;
  else if (hw.cpuCores >= 2) score += 4;
  
  if (hw.deviceMemoryGB >= 8) score += 10;
  else if (hw.deviceMemoryGB >= 4) score += 7;
  else if (hw.deviceMemoryGB >= 2) score += 4;
  
  if (hw.touchSupport) score += 5;
  if (hw.hasWebcam) score += 5;
  if (hw.hasMicrophone) score += 5;
  
  score += (hw.maxTouchPoints || 0) > 0 ? 5 : 0;
  score += hw.pixelRatio >= 2 ? 10 : 5;
  
  // Browser capabilities scoring (0-50)
  const apiCount = Object.values(bc).filter(v => v === true).length;
  score += Math.min(apiCount * 2, 50);
  
  return Math.min(score, 100);
};

// Method: Detect screenshot attempts
deviceMetricsSchema.methods.detectScreenshotAttempts = function() {
  const events = this.securityEvents || [];
  return events.filter(e => e.eventType === 'screenshot_attempt');
};

// Static method: Get battery health distribution
deviceMetricsSchema.statics.getBatteryHealthDistribution = async function(filters = {}) {
  return await this.aggregate([
    { $match: { ...filters, 'battery.level': { $exists: true } } },
    {
      $bucket: {
        groupBy: '$battery.level',
        boundaries: [0, 20, 40, 60, 80, 100],
        default: 'unknown',
        output: {
          count: { $sum: 1 },
          avgDrainRate: { $avg: '$battery.drainRate' },
          users: { $addToSet: '$userId' }
        }
      }
    }
  ]);
};

const DeviceMetrics = mongoose.models.DeviceMetrics || 
  mongoose.model("DeviceMetrics", deviceMetricsSchema, "deviceMetrics");

export default DeviceMetrics;

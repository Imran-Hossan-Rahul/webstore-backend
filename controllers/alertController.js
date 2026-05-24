// controllers/alertController.js
import AlertSystem from '../models/AlertSystem.model.js';

export const createAlert = async (req, res) => {
  try {
    const alert = new AlertSystem({ ...req.body, createdBy: req.user._id });
    await alert.save();
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const { status, type } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    
    const alerts = await AlertSystem.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateAlert = async (req, res) => {
  try {
    const alert = await AlertSystem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteAlert = async (req, res) => {
  try {
    await AlertSystem.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const triggerAlert = async (req, res) => {
  try {
    const alert = await AlertSystem.findById(req.params.id);
    const { value, message } = req.body;
    await alert.trigger(value, message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const acknowledgeAlert = async (req, res) => {
  try {
    const alert = await AlertSystem.findById(req.params.id);
    const historyItem = alert.history.id(req.params.historyId);
    historyItem.acknowledged = true;
    await alert.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const checkAlerts = async () => {
  const alerts = await AlertSystem.find({ status: 'active' });
  
  for (const alert of alerts) {
    const now = new Date();
    const cooldownExpired = !alert.lastTriggered || 
      (now - alert.lastTriggered) > (alert.cooldown * 60 * 1000);
    
    if (!cooldownExpired) continue;
    
    const currentValue = await getMetricValue(alert.config.metric);
    const shouldTrigger = evaluateCondition(currentValue, alert.config.condition, alert.config.threshold);
    
    if (shouldTrigger) {
      await alert.trigger(currentValue, `Alert: ${alert.name} triggered. Value: ${currentValue}`);
    }
  }
};

function evaluateCondition(value, condition, threshold) {
  switch (condition) {
    case 'greater_than': return value > threshold;
    case 'less_than': return value < threshold;
    case 'equals': return value === threshold;
    default: return false;
  }
}

async function getMetricValue(metric) {
  return Math.random() * 100;
}

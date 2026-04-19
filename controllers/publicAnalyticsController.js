// Backend controller for public analytics endpoints
import Template from "../models/Template.model.js";
import User from "../models/User.model.js";
import Blog from "../models/blog.model.js";
import Sale from "../models/Sale.model.js";

/**
 * Get public views history (last 12 months)
 */
export const getPublicViewsHistory = async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    
    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      // Get views for this month from templates
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const templates = await Template.find({
        createdAt: { $lte: endOfMonth }
      });
      
      const totalViews = templates.reduce((sum, t) => sum + (t.viewsCount || 0), 0);
      const goal = Math.floor(totalViews * 1.2);
      
      months.push({
        month: monthName,
        value: totalViews,
        goal: goal
      });
    }
    
    res.status(200).json({
      success: true,
      data: months
    });
  } catch (error) {
    console.error("Error fetching public views history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch views history"
    });
  }
};

/**
 * Get public downloads history (last 12 months)
 */
export const getPublicDownloadsHistory = async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const templates = await Template.find({
        createdAt: { $lte: endOfMonth }
      });
      
      const totalDownloads = templates.reduce((sum, t) => sum + (t.downloadsCount || 0), 0);
      const goal = Math.floor(totalDownloads * 1.15);
      
      months.push({
        month: monthName,
        value: totalDownloads,
        goal: goal
      });
    }
    
    res.status(200).json({
      success: true,
      data: months
    });
  } catch (error) {
    console.error("Error fetching public downloads history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch downloads history"
    });
  }
};

/**
 * Get public revenue history (last 12 months)
 */
export const getPublicRevenueHistory = async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Real Revenue Calculation from Sales
      const monthSales = await Sale.find({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        status: "completed" 
      });

      const monthlyRevenue = monthSales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
      
      // Calculate a dynamic goal based on previous performance or fixed growth
      // For first month, simple multiplier. For others, maybe 20% growth.
      // But to keep it simple and stateless:
      const goal = Math.floor(monthlyRevenue * 1.25) || 5000; // Default goal if no sales

      months.push({
        month: monthName,
        value: monthlyRevenue,
        goal: goal
      });
    }
    
    res.status(200).json({
      success: true,
      data: months
    });
  } catch (error) {
    console.error("Error fetching public revenue history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenue history"
    });
  }
};

/**
 * Get public users growth history (last 12 months)
 */
export const getPublicUsersHistory = async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Count users registered up to this month
      const userCount = await User.countDocuments({
        createdAt: { $lte: endOfMonth }
      });
      
      const goal = Math.floor(userCount * 1.3);
      
      months.push({
        month: monthName,
        value: userCount,
        goal: goal
      });
    }
    
    res.status(200).json({
      success: true,
      data: months
    });
  } catch (error) {
    console.error("Error fetching public users history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users history"
    });
  }
};

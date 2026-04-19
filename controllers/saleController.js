import Sale from "../models/Sale.model.js";


// 🟢 Create a new sale
export const createSale = async (req, res) => {
  try {
    const { amount, productCount, date } = req.body;

    // Validation
    if (amount == null || amount < 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Amount is required and must be positive",
        });
    }

    const sale = await Sale.create({
      amount,
      productCount,
      date,
      createdBy: req.user?._id || null, // যদি auth middleware থাকে
    });

    res.status(201).json({
      success: true,
      message: "Sale added successfully",
      data: sale,
    });
  } catch (error) {
    console.error("Error creating sale:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
  }
};

// 🟣 Get all sales
export const getAllSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ date: 1 });
    res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 🟡 Get sales by date range (for graphs)
export const getSalesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide startDate and endDate",
        });
    }

    const sales = await Sale.find({
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    }).sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    console.error("Error fetching sales by date range:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 🔴 Delete a sale (optional)
export const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findByIdAndDelete(id);

    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Sale deleted successfully" });
  } catch (error) {
    console.error("Error deleting sale:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

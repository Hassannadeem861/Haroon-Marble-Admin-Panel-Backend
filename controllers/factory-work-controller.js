import FactoryWork from "../models/factory-work-model.js";

// ─── 1. CREATE FACTORY WORK (+ optional initial advance) ──────────
const createFactoryWork = async (req, res) => {
  try {
    const {
      factoryName,
      workMaterialName,
      quantity,
      totalAmount,
      advanceAmount,
      advanceDate,
      expectedCompletionDate,
      notes,
    } = req.body;

    const requiredFields = { factoryName, workMaterialName, totalAmount };
    const missingFields = Object.keys(requiredFields).filter(
      (key) =>
        requiredFields[key] === undefined ||
        requiredFields[key] === null ||
        requiredFields[key] === "",
    );

    if (missingFields.length > 0) {
      return res.status(400).send(`
        Required fields are missing.

      Missing Fields:
      ${missingFields.map((field) => `- ${field}`).join("\n")}

      Example Request Body:

      factoryName: ABC Marble Factory
      workMaterialName: Marble
      quantity: 1000 sq.ft
      totalAmount: 200000
      advanceAmount: 50000
      advanceDate: 12/08/2026
      expectedCompletionDate: 20/08/2026
      `);
    }

    const payments = [];
    if (advanceAmount) {
      payments.push({
        amount: advanceAmount,
        type: "advance",
        date: advanceDate ? new Date(advanceDate) : new Date(),
      });
    }

    const factoryWork = await FactoryWork.create({
      factoryName,
      workMaterialName,
      quantity,
      totalAmount,
      expectedCompletionDate,
      notes,
      payments,
    });

    return res.status(201).json({
      success: true,
      message: "Factory work created successfully.",
      factoryWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating factory work.",
      error: error.message,
    });
  }
};

// ─── 2. GET ALL (list, search, filter, paginate) ───────────────────
const getAllFactoryWorks = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;

    const query = { deleted_at: null };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { factoryName: { $regex: search, $options: "i" } },
        { workMaterialName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [factoryWorks, total] = await Promise.all([
      FactoryWork.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit)),
      FactoryWork.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      factoryWorks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch factory works.",
      error: error.message,
    });
  }
};

// ─── 3. GET SINGLE (detail page) ───────────────────────────────────
const getSingleFactoryWork = async (req, res) => {
  try {
    const { workId } = req.params;

    const factoryWork = await FactoryWork.findOne({
      _id: workId,
      deleted_at: null,
    });

    if (!factoryWork) {
      return res.status(404).json({
        success: false,
        message: "Factory work not found.",
      });
    }

    return res.status(200).json({ success: true, factoryWork });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch factory work.",
      error: error.message,
    });
  }
};

// ─── 4. UPDATE BASIC FIELDS ─────────────────────────────────────
const updateFactoryWork = async (req, res) => {
  try {
    const { workId } = req.params;
    const {
      factoryName,
      workMaterialName,
      quantity,
      totalAmount,
      expectedCompletionDate,
      notes,
      status,
    } = req.body;

    const updateFields = {};
    if (factoryName !== undefined) updateFields.factoryName = factoryName;
    if (workMaterialName !== undefined)
      updateFields.workMaterialName = workMaterialName;
    if (quantity !== undefined) updateFields.quantity = quantity;
    if (totalAmount !== undefined) updateFields.totalAmount = totalAmount;
    if (expectedCompletionDate !== undefined)
      updateFields.expectedCompletionDate = expectedCompletionDate;
    if (notes !== undefined) updateFields.notes = notes;
    if (status !== undefined) updateFields.status = status;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update.",
      });
    }

    const factoryWork = await FactoryWork.findOneAndUpdate(
      { _id: workId, deleted_at: null },
      updateFields,
      { new: true, runValidators: true },
    );

    if (!factoryWork) {
      return res.status(404).json({
        success: false,
        message: "Factory work not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Factory work updated successfully.",
      factoryWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating factory work.",
      error: error.message,
    });
  }
};

// ─── 5. ADD FACTORY PAYMENT (advance ya Final Payment) ─────────────
const addFactoryPayment = async (req, res) => {
  try {
    const { workId } = req.params;
    const { amount, type, date, note } = req.body;

    if (!amount || !type) {
      return res.status(400).json({
        success: false,
        message: "amount and type ('advance' or 'payment') are required.",
      });
    }

    const factoryWork = await FactoryWork.findOne({
      _id: workId,
      deleted_at: null,
    });

    if (!factoryWork) {
      return res.status(404).json({
        success: false,
        message: "Factory work not found.",
      });
    }

    factoryWork.payments.push({
      amount,
      type,
      date: date || new Date(),
      note,
    });

    // Agar total amount pura paid ho gaya, status "completed" na hi kar dein
    // (final material check ke baad hi complete hota hai — status yahan auto nahi badalte)

    await factoryWork.save();

    return res.status(200).json({
      success: true,
      message: "Payment added successfully.",
      factoryWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error adding payment.",
      error: error.message,
    });
  }
};

// ─── 6. MATERIAL LEFT FACTORY ───────────────────────────────────
const updateMaterialMovement = async (req, res) => {
  try {
    const { workId } = req.params;
    const { leftFactoryDate, vehicleUsed, notes } = req.body;

    if (!leftFactoryDate) {
      return res.status(400).json({
        success: false,
        message: "leftFactoryDate is required.",
      });
    }

    const factoryWork = await FactoryWork.findOneAndUpdate(
      { _id: workId, deleted_at: null },
      {
        "materialMovement.leftFactoryDate": leftFactoryDate,
        "materialMovement.vehicleUsed": vehicleUsed,
        "materialMovement.notes": notes,
        status: "on_the_way", // material nikal gaya -> automatically "on the way"
      },
      { new: true, runValidators: true },
    );

    if (!factoryWork) {
      return res.status(404).json({
        success: false,
        message: "Factory work not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Material movement recorded successfully.",
      factoryWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error recording material movement.",
      error: error.message,
    });
  }
};

// ─── 7. SITE ARRIVAL + MATERIAL CHECKING ────────────────────────
const updateSiteArrival = async (req, res) => {
  try {
    const { workId } = req.params;
    const { arrivalDate, materialChecked, notes } = req.body;

    if (!arrivalDate) {
      return res.status(400).json({
        success: false,
        message: "arrivalDate is required.",
      });
    }

    // materialChecked ke hisaab se status decide karo
    let derivedStatus = "received";
    if (materialChecked === "checked") derivedStatus = "checked";
    if (materialChecked === "issue_found") derivedStatus = "received"; // received but issue — status "received" rehta hai jab tak resolve na ho

    const factoryWork = await FactoryWork.findOneAndUpdate(
      { _id: workId, deleted_at: null },
      {
        "siteArrival.arrivalDate": arrivalDate,
        "siteArrival.materialChecked": materialChecked,
        "siteArrival.notes": notes,
        status: derivedStatus,
      },
      { new: true, runValidators: true },
    );

    if (!factoryWork) {
      return res.status(404).json({
        success: false,
        message: "Factory work not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Site arrival recorded successfully.",
      factoryWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error recording site arrival.",
      error: error.message,
    });
  }
};

// ─── 8. ADD / UPDATE VEHICLE INFO ───────────────────────────────
const setVehicleInfo = async (req, res) => {
  try {
    const { workId } = req.params;
    const {
      vehicleType,
      totalRent,
      advanceAmount,
      advanceDate,
      pickupDate,
      arrivalDate,
      notes,
    } = req.body;

    const factoryWork = await FactoryWork.findOne({
      _id: workId,
      deleted_at: null,
    });

    if (!factoryWork) {
      return res.status(404).json({
        success: false,
        message: "Factory work not found.",
      });
    }

    if (!factoryWork.vehicle) factoryWork.vehicle = {};

    if (vehicleType !== undefined) factoryWork.vehicle.vehicleType = vehicleType;
    if (totalRent !== undefined) factoryWork.vehicle.totalRent = totalRent;
    if (pickupDate !== undefined) factoryWork.vehicle.pickupDate = pickupDate;
    if (arrivalDate !== undefined) factoryWork.vehicle.arrivalDate = arrivalDate;
    if (notes !== undefined) factoryWork.vehicle.notes = notes;

    if (!factoryWork.vehicle.payments) factoryWork.vehicle.payments = [];
    if (advanceAmount) {
      factoryWork.vehicle.payments.push({
        amount: advanceAmount,
        type: "advance",
        date: advanceDate ? new Date(advanceDate) : new Date(),
      });
    }

    if (arrivalDate) factoryWork.vehicle.status = "arrived";
    else if (pickupDate) factoryWork.vehicle.status = "on_the_way";

    await factoryWork.save();

    return res.status(200).json({
      success: true,
      message: "Vehicle info saved successfully.",
      factoryWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error saving vehicle info.",
      error: error.message,
    });
  }
};

// ─── 9. ADD VEHICLE PAYMENT (Final Payment) ─────────────────────
const addVehiclePayment = async (req, res) => {
  try {
    const { workId } = req.params;
    const { amount, type, date, note } = req.body;

    if (!amount || !type) {
      return res.status(400).json({
        success: false,
        message: "amount and type ('advance' or 'payment') are required.",
      });
    }

    const factoryWork = await FactoryWork.findOne({
      _id: workId,
      deleted_at: null,
    });

    if (!factoryWork || !factoryWork.vehicle) {
      return res.status(404).json({
        success: false,
        message: "Factory work or vehicle info not found.",
      });
    }

    factoryWork.vehicle.payments.push({
      amount,
      type,
      date: date || new Date(),
      note,
    });

    const totalPaid = factoryWork.vehicle.payments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );
    if (totalPaid >= (factoryWork.vehicle.totalRent || 0)) {
      factoryWork.vehicle.status = "paid";
    }

    await factoryWork.save();

    return res.status(200).json({
      success: true,
      message: "Vehicle payment added successfully.",
      factoryWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error adding vehicle payment.",
      error: error.message,
    });
  }
};

// ─── 10. DELETE (soft delete) ───────────────────────────────────
const deleteFactoryWork = async (req, res) => {
  try {
    const { workId } = req.params;

    const factoryWork = await FactoryWork.findOneAndUpdate(
      { _id: workId, deleted_at: null },
      { deleted_at: new Date() },
      { new: true },
    );

    if (!factoryWork) {
      return res.status(404).json({
        success: false,
        message: "Factory work not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Factory work deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting factory work.",
      error: error.message,
    });
  }
};

export {
  createFactoryWork,
  getAllFactoryWorks,
  getSingleFactoryWork,
  updateFactoryWork,
  addFactoryPayment,
  updateMaterialMovement,
  updateSiteArrival,
  setVehicleInfo,
  addVehiclePayment,
  deleteFactoryWork,
};
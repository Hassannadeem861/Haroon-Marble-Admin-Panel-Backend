import User from "../models/employer-model.js";

const createEmployer = async (req, res) => {
  try {
    const {
      name,
      description,
      advanced,
      overTime,
      salary,
      designation,
      workUnder,
      currentSite,
      workStatus,
      attendence,
      // salaryType,
      // teamName,
    } = req.body;

    const requiredFields = {
      name,
      salary,
      designation,
      workUnder,
    };

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

      name: Huzaifa
      description: test description
      designation: qarigar
      salary: 1200
      workUnder: owner
      attendence: present
      overTime: 2
      currentSite: Site A
      `);
    }

    const employer = await User.create({
      name,
      description,
      advanced,
      overTime,
      salary,
      designation,
      workUnder,
      currentSite,
      workUnder,
      workStatus,
      attendence,
      // salaryType,
      // teamName,
    });

    return res.status(201).json({
      success: true,
      message: "Employer created successfully.",
      employer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating employer.",
      error: error.message,
    });
  }
};

const getAllStats = async (req, res) => {
  try {
    const [dashboard] = await User.aggregate([
      {
        $match: {
          deleted_at: null,
        },
      },
      {
        $group: {
          _id: null,

          totalWorkers: {
            $sum: 1,
          },

          totalMazdoor: {
            $sum: {
              $cond: [{ $eq: ["$designation", "mazdoor"] }, 1, 0],
            },
          },

          totalQarigar: {
            $sum: {
              $cond: [{ $eq: ["$designation", "qarigar"] }, 1, 0],
            },
          },

          totalSalary: {
            $sum: "$salary",
          },

          totalAdvance: {
            $sum: "$advanced",
          },

          totalOverTime: {
            $sum: "$overTime",
          },

          pendingWork: {
            $sum: {
              $cond: [{ $eq: ["$workStatus", "pending"] }, 1, 0],
            },
          },

          inProgressWork: {
            $sum: {
              $cond: [{ $eq: ["$workStatus", "inprogress"] }, 1, 0],
            },
          },

          completedWork: {
            $sum: {
              $cond: [{ $eq: ["$workStatus", "complete"] }, 1, 0],
            },
          },

          presentWorkers: {
            $sum: {
              $cond: [{ $eq: ["$attendence", "present"] }, 1, 0],
            },
          },

          absentWorkers: {
            $sum: {
              $cond: [{ $eq: ["$attendence", "absent"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      dashboard: dashboard || {
        totalWorkers: 0,
        totalMazdoor: 0,
        totalQarigar: 0,
        totalSalary: 0,
        totalAdvance: 0,
        totalOverTime: 0,
        pendingWork: 0,
        inProgressWork: 0,
        completedWork: 0,
        presentWorkers: 0,
        absentWorkers: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Dashboard data fetch failed.",
      error: error.message,
    });
  }
};

const getAllEmployers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const filter = {
      deleted_at: null,
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } },
        { workUnder: { $regex: search, $options: "i" } },
        { attendence: { $regex: search, $options: "i" } },
        { workStatus: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate && endDate) {
      filter.created_at = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const total = await User.countDocuments(filter);

    const employers = await User.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      employers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching employers.",
      error: error.message,
    });
  }
};

const getSingleEmployer = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findOne({ _id: userId, deleted_at: null });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Single employes fetched", user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};

const updateEmployer = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Employer ID is required.",
      });
    }

    const {
      name,
      description,
      advanced,
      overTime,
      salary,
      designation,
      workUnder,
      currentSite,
      workStatus,
      attendence,
      // salaryType,
      // teamName,
    } = req.body;

    const updateFields = {};

    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined)
      updateFields.description = description.trim();
    if (advanced !== undefined) updateFields.advanced = advanced;
    if (attendence !== undefined) updateFields.attendence = attendence;
    if (overTime !== undefined) updateFields.overTime = overTime;
    if (salary !== undefined) updateFields.salary = salary;
    if (designation !== undefined) updateFields.designation = designation;
    // if (salaryType !== undefined) updateFields.salaryType = salaryType;
    if (workUnder !== undefined) updateFields.workUnder = workUnder;
    if (workStatus !== undefined) updateFields.workStatus = workStatus;
    if (currentSite !== undefined) updateFields.currentSite = currentSite;
    // if (teamName !== undefined) updateFields.teamName = teamName;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).send(`No fields provided for update.

      Example Request Body:

      name: Ali Raza
      description:Test description 
      designation: qarigar
      salary: 40000
      workUnder: partnerShip
      attendence: present
      overTime: 3
      currentSite: Site B
      `);
    }

    const employer = await User.findOneAndUpdate(
      {
        _id: userId,
        deleted_at: null,
      },
      updateFields,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!employer) {
      return res.status(404).json({
        success: false,
        message: "Employer not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Employer updated successfully.",
      employer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating employer.",
      error: error.message,
    });
  }
};

const deleteEmployer = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedUser = await User.findOneAndUpdate(
      { _id: userId, deleted_at: null },
      { deleted_at: new Date() },
      { new: true },
    );

    if (!deletedUser) {
      return res
        .status(404)
        .json({ message: "User not found or already deleted" });
    }

    return res.status(200).json({ message: "Employess deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting user", error: error.message });
  }
};

export {
  createEmployer,
  getAllStats,
  getAllEmployers,
  getSingleEmployer,
  updateEmployer,
  deleteEmployer,
};

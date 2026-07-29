import User from "../models/employer-model.js";

const createEmployer = async (req, res) => {
  try {
    const {
      empNo,
      name,
      email,
      mobile_number,
      designation,
      account_number,
      permanent_address,
      salary,
      date_of_birth,
      date_of_joining,
      status,
    } = req.body;

    const statusNumber = Number(status);

    if (
      (empNo,
      !name ||
        !email ||
        !mobile_number ||
        !designation ||
        !account_number ||
        !permanent_address ||
        !salary ||
        !date_of_birth ||
        !date_of_joining ||
        (statusNumber !== 0 && statusNumber !== 1))
    ) {
      return res.status(400).send(`
        ❌ Required fields are missing.

        👉 Example request body (form-data):
        empNo:1
        name: Ali Raza
        email: ali@example.com
        mobile_number: 03001234567
        designation: Software Engineer
        account_number: 1234567890
        permanent_address: Lahore, Pakistan
        salary: 80000
        date_of_birth: 1995-01-01
        date_of_joining: 2022-06-15
        status: 1 || 0,
        fileUpload: [file]
        pdfUpload: [pdf]
      `);
    }

    const existingUser = await User.findOne({ empNo });
    if (existingUser) {
      return res.status(409).json({ message: "EmpNo already exists ❌" });
    }

    // const fileUploadPath = req.files?.fileUpload?.[0]?.filename || null;
    // const pdfUploadPath = req.files?.pdfUpload?.[0]?.filename || null;

    // ✅ File handling (memory buffer to Base64)
    let fileUploadData = null;
    let pdfUploadData = null;

    if (req.files?.fileUpload?.[0]) {
      const file = req.files.fileUpload[0];
      console.log("file: ", file);
      fileUploadData = file.buffer;
    }

    if (req.files?.pdfUpload?.[0]) {
      const file = req.files.pdfUpload[0];
      console.log("file: ", file);

      pdfUploadData = file.buffer;
    }

    // // ✅ File buffer to Base64
    // if (req.files?.fileUpload?.[0]) {
    //   const file = req.files.fileUpload[0];
    //   console.log("file: ", file);

    //   // updateFields.fileUpload = file.buffer.toString("base64"); // 👈 direct string
    //   updateFields.fileUpload = file.buffer;
    //   // updateFields.fileUpload = {
    //   //   data: file.buffer.toString("base64"),
    //   //   mimetype: file.mimetype,
    //   //   originalname: file.originalname,
    //   // };
    // }

    // if (req.files?.pdfUpload?.[0]) {
    //   const file = req.files.pdfUpload[0];
    //   console.log("file: ", file);

    //   // updateFields.pdfUpload = file.buffer.toString("base64"); // 👈 direct string
    //   updateFields.pdfUpload = file.buffer; // 👈 direct string

    //   // updateFields.pdfUpload = {
    //   //   data: file.buffer.toString("base64"),
    //   //   mimetype: file.mimetype,
    //   //   originalname: file.originalname,
    //   // };
    // }

    const newUser = await User.create({
      empNo,
      name,
      email,
      mobile_number,
      designation,
      account_number,
      permanent_address,
      salary,
      date_of_birth,
      date_of_joining,
      fileUpload: fileUploadData,
      pdfUpload: pdfUploadData,
      status: statusNumber,
      created_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Employer created successfully ✅",
      newUser,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating employer ❌",
      error: error.message,
    });
  }
};

const getAllEmployers = async (req, res) => {
  try {
    const users = await User.find({ deleted_at: null });

    if (!users) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ message: "All employess fetched ✅", users });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users ❌", error: error.message });
  }
};

const getSingleEmployer = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findOne({ _id: userId, deleted_at: null });

    if (!user) {
      return res.status(404).json({ message: "User not found ❌" });
    }

    return res
      .status(200)
      .json({ message: "Single employes fetched ✅", user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching user ❌", error: error.message });
  }
};

const updateEmployer = async (req, res) => {
  const { userId } = req.params;

  try {
    const {
      empNo,
      name,
      email,
      mobile_number,
      designation,
      account_number,
      permanent_address,
      salary,
      date_of_birth,
      date_of_joining,
      status,
    } = req.body;

    const statusNumber = Number(status);

    // // Optional file paths
    // const fileUploadPath = req.files?.fileUpload?.[0]?.filename || undefined;
    // const pdfUploadPath = req.files?.pdfUpload?.[0]?.filename || undefined;

    // Build update object
    const updateFields = {
      empNo,
      name,
      email,
      mobile_number,
      designation,
      account_number,
      permanent_address,
      salary,
      date_of_birth,
      date_of_joining,
      status: statusNumber,
      updated_at: new Date(),
    };

    // if (fileUploadPath) {
    //   updateFields.fileUpload = fileUploadPath;
    // }

    // if (pdfUploadPath) {
    //   updateFields.pdfUpload = pdfUploadPath;
    // }

    // ✅ File buffer to Base64
    if (req.files?.fileUpload?.[0]) {
      const file = req.files.fileUpload[0];
      console.log("file: ", file);

      // updateFields.fileUpload = file.buffer.toString("base64"); // 👈 direct string
      updateFields.fileUpload = file.buffer;
      // updateFields.fileUpload = {
      //   data: file.buffer.toString("base64"),
      //   mimetype: file.mimetype,
      //   originalname: file.originalname,
      // };
    }

    if (req.files?.pdfUpload?.[0]) {
      const file = req.files.pdfUpload[0];
      console.log("file: ", file);

      // updateFields.pdfUpload = file.buffer.toString("base64"); // 👈 direct string
      updateFields.pdfUpload = file.buffer; // 👈 direct string

      // updateFields.pdfUpload = {
      //   data: file.buffer.toString("base64"),
      //   mimetype: file.mimetype,
      //   originalname: file.originalname,
      // };
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, deleted_at: null },
      updateFields,
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ message: "User not found or already deleted ❌" });
    }

    return res.status(200).json({
      success: true,
      message: "Employer updated successfully ✅",
      updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating employer ❌",
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
      { new: true }
    );

    if (!deletedUser) {
      return res
        .status(404)
        .json({ message: "User not found or already deleted ❌" });
    }

    return res
      .status(200)
      .json({ message: "Employess deleted successfully ✅" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting user ❌", error: error.message });
  }
};

export {
  createEmployer,
  getAllEmployers,
  getSingleEmployer,
  updateEmployer,
  deleteEmployer,
};

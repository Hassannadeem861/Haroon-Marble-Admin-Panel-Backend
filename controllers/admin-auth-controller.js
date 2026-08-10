import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models//admin-auth-model.js";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(403).json({ message: "Required parameters missing" });
    }

    const userEmail = await User.findOne({ email: email.toLowerCase() });

    if (userEmail) {
      return res.status(403).json({ message: "User email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    return res
      .status(200)
      .json({ message: "Registration successfully", user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Registraction failed", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(403)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(404).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
    );

    return res
      .status(201)
      .cookie("token", token, {
        httpOnly: true, // JS not access the code
        secure: false, //HTTP required
        maxage: 15 * 24 * 60 * 60 * 1000, // 15 days
        sameSite: "none", // cross site request allowed
      })
      .json({ message: `Login successful in ${user.username}`, user, token });
  } catch (error) {
    return res
      .status(500)
      .json({ message: " Login failed", error: error.message });
  }
};

const getAllAmins = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments();

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    return res.status(200).json({
      message: "Users retrieved successfully",
      users,
      totalUsers,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to get all users", error: error.message });
  }
};

const getSingleAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Id is required" });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(500).json({ message: "User not found in this id" });
    }

    return res
      .status(200)
      .json({ message: "Fetched single user successfully", user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error in get single user", error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("token").status(200).json({ message: "Logout successful" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Logout failed", error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    return res
      .status(200)
      .json({ message: "Profile retrieved successfully", user: req.user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to get profile", error: error.message });
  }
};

const updatePassword = async (req, res) => {
  const userId = req.params.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Current password and new password are required" });
  }

  try {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ message: "User does not have a password set" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    return res
      .status(200)
      .json({ message: "Password updated successfully", user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to update password", error: error.message });
  }
};

const updateAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, password } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!username && !password) {
      return res
        .status(400)
        .json({ message: "At least one field is required to update" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
      new: true,
    });

    return res
      .status(200)
      .json({ message: "User updated successfully", updatedUser });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to update user", error: error.message });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const deletedUser = await User.findByIdAndDelete(userId);

    return res
      .status(200)
      .json({ message: "User deleted successfully", deletedUser });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to delete user", error: error.message });
  }
};

const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Please provide an email address" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found. Please register first." });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    // Set up nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      secure: true,
      auth: {
        user: process.env.MY_EMAIL,
        pass: process.env.MY_PASSWORD,
      },
    });

    // Prepare email details
    const mailOptions = {
      from: "hr@techicoders.com",
      to: email,
      subject: "Password Reset Request",
      text: `Please click on the link to reset your password: ${process.env.SERVER_URL}/reset-password/${token}`,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Respond with success
    return res
      .status(200)
      .json({ message: "Password reset link has been sent to your email." });
  } catch (error) {
    console.error("Forget password error: ", error);
    return res
      .status(500)
      .json({ message: "An error occurred while processing your request." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res
        .status(400)
        .json({ message: "Please provide a new password." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ email: decodedToken.email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    await user.save();

    return res
      .status(200)
      .json({ message: "Password has been reset successfully." });
  } catch (error) {
    // Handle token expiration or invalid token errors
    if (error.name === "TokenExpiredError") {
      return res.status(400).json({
        message: "Token has expired. Please request a new password reset link.",
      });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(400).json({
        message: "Invalid token. Please request a new password reset link.",
      });
    }

    console.error("Reset password error:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while resetting the password." });
  }
};

export {
  register,
  login,
  getAllAmins,
  updateAdmin,
  deleteAdmin,
  getProfile,
  logout,
  updatePassword,
  forgetPassword,
  resetPassword,
  getSingleAdmin,
};

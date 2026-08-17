import mongoose from "mongoose";

/**
 * DailyWork — ek record = ek worker ka ek din ka kaam.
 * Har record kisi existing Employer (master profile) se linked hai.
 */
const dailyWorkSchema = new mongoose.Schema(
    {
        employerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employer",
            required: true,
            index: true,
        },

        entryDate: {
            type: Date,
            default: Date.now,
            // required: true,
        },

        currentSite: {
            type: String,
            trim: true,
            default: "",
        },

        attendance: {
            type: String,
            enum: ["present", "absent"],
            default: "present",
            required: true,
        },

        workStatus: {
            type: String,
            enum: ["pending", "inprogress", "completed"],
            default: "pending",
        },

        workUnder: {
            type: String,
            enum: ["owner", "partnerShip", "client"],
        },

        // Us din ki actual salary — Employer.salary se copy hoti hai create ke
        // waqt, lekin baad mein Employer.salary change hone se ye nahi badalti.
        salary: {
            type: Number,
            required: true,
            min: [0, "Salary cannot be negative."],
        },

        overtimeHours: {
            type: Number,
            default: 0,
            min: [0, "Overtime hours cannot be negative."],
        },

        // Calculated at create/update time using OVERTIME rate helper,
        // stored so history doesn't change if the rate config changes later.
        overtimeAmount: {
            type: Number,
            default: 0,
            min: [0, "Overtime amount cannot be negative."],
        },

        advanceAmount: {
            type: Number,
            default: 0,
            min: [0, "Advance amount cannot be negative."],
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        deleted_at: {
            type: Date,
            default: null,
            index: true,
        },
    },
    {
        timestamps: {
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
);

// Common query patterns
dailyWorkSchema.index({ employerId: 1, entryDate: -1 });
dailyWorkSchema.index({ entryDate: -1 });

// NOTE: Business rule confirm hone ke baad hi ye uncomment karein.
// Agar rule "ONE WORKER = ONE RECORD PER DAY" hai to ye compound unique
// index lagayen. Filhal multiple entries per day allowed samjha gaya hai,
// isliye ye COMMENTED hai — blindly unique mat lagayen.
// dailyWorkSchema.index({ employerId: 1, entryDate: 1 }, { unique: true });

const DailyWork = mongoose.model("DailyWork", dailyWorkSchema);
export default DailyWork;
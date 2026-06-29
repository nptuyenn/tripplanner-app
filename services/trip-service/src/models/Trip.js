import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    owner: {
      type: String,
      required: true,
      index: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.startDate || value >= this.startDate;
        },
        message: "End date must be on or after start date",
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    status: {
      type: String,
      enum: ["planned", "ongoing", "completed"],
      default: "planned",
    },
  },
  { timestamps: true },
);

tripSchema.index({ owner: 1, startDate: 1 });

export const Trip = mongoose.model("Trip", tripSchema);

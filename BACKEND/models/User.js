const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  subscriptionId: { 
    type: String, 
    required: true,
    index: true 
  }, 
  role: { 
    type: String, 
    enum: ['admin', 'member', 'super'], 
    default: 'member' 
  },
  bio: { 
    type: String, 
    default: "Hey there! I am using ChatApp.",
    trim: true 
  },
  profilePic: { 
    type: String, 
    default: "" 
  }
}, { timestamps: true });

// ✅ FIXED PRE-SAVE: Removed 'next' because we are using async
userSchema.pre("save", async function () {
  // Only hash if password is modified
  if (!this.isModified("password")) return;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    // No next() call needed here!
  } catch (error) {
    throw error; // Throwing error will stop the save process
  }
});

// ✅ COMPARE PASSWORD METHOD
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
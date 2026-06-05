import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    maxlength: 25, // maxlängd på användarnamn satt till 25 tecken för att undvika överdrivet långa användarnamn
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    maxlength: 254, // maxlängd på email satt till 254 tecken enligt RFC 5321
  },
  password: {
    type: String,
    required: true,
    minlength: 10, // minlängd på lösenord satt till 10 tecken för att uppmuntra starka lösenord
    maxlength: 64, // maxlängd på lösenord satt till 64 tecken för att undvika överdrivet långa lösenord
  },
})

export const User = mongoose.model("User", userSchema)

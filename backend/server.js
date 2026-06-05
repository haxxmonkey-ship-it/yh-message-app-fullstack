import "dotenv/config"
import helmet from "helmet"
import cors from "cors"
import express from "express"
import mongoose from "mongoose"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { Message } from "./models/Message.js"
import { User } from "./models/User.js"
import { authenticateUser } from "./middleware/auth.js"
import { loginLimiter } from "./middleware/loginLimiter.js"
import "./config/db.js"
import listEndpoints from "express-list-endpoints"
import { body, param, validationResult } from "express-validator"

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set in .env")

const PORT = process.env.PORT || "3000"
const app = express()
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL }))
app.use(express.json())

app.get("/", (req, res) => {
  res.send(listEndpoints(app))
})

app.post("/register", [
  body("username").isLength({ min: 6, max: 25 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 10, max: 64 })
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: "Invalid input" })

  try {
    const { email, password, username } = req.body
    const existingUser = await User.findOne({ $or: [{ email: email }, { username: username.trim() }] })
    if (existingUser) return res.status(400).json({ success: false, message: "User already exists" })

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new User({ username: username.trim(), email, password: hashedPassword })
    await user.save()

    const accessToken = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "1h" })
    res.status(201).json({ success: true, response: { username: user.username, id: user._id, accessToken } })
  } catch (error) {
    res.status(500).json({ success: false, message: "Something went wrong" })
  }
})

    const hashedPassword = await bcrypt.hash(password, 10) 
    const user = new User({ username: username.trim(), email, password: hashedPassword }) 

    const accessToken = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Sänkte token expiration time till 1 timme för ökad säkerhet
    )

    res.status(201).json({
      success: true,
      message: "User created successfully",
      response: {
        username: user.username,
        id: user._id,
        accessToken,
      },
    })
  } catch (error) { 
    console.error(error) // Loggar det faktiska felet i serverns konsol
    res.status(500).json({ //Ändrat från 400 till 500 för att bättre reflektera att det är ett serverfel, inte ett klientfel.
      success: false,
      message: "Something went wrong", // Förenklade felmeddelandet som skickas till klienten för att inte exponera potentiellt känslig information.
    })
  } 
}) 

app.post("/login", loginLimiter, [ // Validering av indata för login adderad via Express-validator
  body("login").trim().notEmpty().isLength({ max: 254 }).withMessage("Username or email is required"), // Validerar att login-fältet inte är tomt och inte överstiger 254 tecken (maxlängd för email enligt RFC 5321)
  body("password").notEmpty().isLength({ min: 10, max: 64 }).withMessage("Password is required and must be between 10 and 64 characters") // Validerar att password-fältet inte är tomt och har en rimlig längd (minst 10 tecken, max 64 tecken)
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: "Validation failed" })

  try {
    const { login, password } = req.body
    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${login}$`, 'i') } },
        { email: login.toLowerCase() }
      ]
    })

    if (!user) return res.status(401).json({ success: false, message: "No account found" })

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) return res.status(401).json({ success: false, message: "Password is incorrect" })

    const accessToken = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "1h" })
    res.json({ success: true, response: { username: user.username, id: user._id, accessToken } })
  } catch (error) {
    res.status(500).json({ success: false, message: "Something went wrong" })
  }
})

app.get("/messages", authenticateUser, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: "desc" }).limit(20).populate("user", "username").exec()
    res.json(messages)
  } catch (error) {
    res.status(500).json({ message: "Could not fetch messages" })
  }
})

app.post("/messages", [authenticateUser, body("message").trim().isLength({ min: 1, max: 250 })], async (req, res) => {
  try {
    const message = new Message({ message: req.body.message, user: req.user._id })
    const saved = await message.save()
    res.status(201).json(saved)
  } catch (err) {
    res.status(500).json({ message: "Could not save message" })
  }
})

app.patch("/messages/:id", [authenticateUser, param("id").isMongoId(), body("editedMessage").trim().isLength({ min: 1, max: 250 })], async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
    if (!message || message.user.toString() !== req.user._id.toString()) return res.status(403).json({ error: "Unauthorized" })
    
    message.message = req.body.editedMessage
    await message.save()
    res.json(await message.populate("user", "username"))
  } catch (error) {
    res.status(500).json({ error: "Could not update" })
  }
})

app.delete("/messages/:id", [authenticateUser, param("id").isMongoId()], async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
    if (!message || message.user.toString() !== req.user._id.toString()) return res.status(403).json({ error: "Unauthorized" })
    
    await message.deleteOne()
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: "Could not delete" })
  }
})

app.listen(PORT, () => console.log(`Listening on port ${PORT}`))
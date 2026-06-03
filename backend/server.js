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
import "./config/db.js"
import listEndpoints from "express-list-endpoints"
import { body, validationResult } from "express-validator" // Importerade express-validator för ökad validering av indata
import { loginLimiter } from "./middleware/loginLimiter.js" // importerar loginLimiter middleware för att begränsa inloggningsförsök och skydda mot brute-force attacker

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set in .env")

const PORT = process.env.PORT || "3000"
const app = express()
app.use(helmet())
app.use(cors({
  origin: "*",
}))
app.use(express.json())
// Vi föreslår att säkra session-tokeln genom att använda HttpOnly cookies istället för att skicka den i JSON-responsen, vilket minskar risken för XSS-attacker. Det här innebär större ändringar i övrig kod för att hantera autentisering och session, vi har valt att inte genomföra detta själva. 

app.get("/", (req, res) => {
  res.send(listEndpoints(app))
})

app.post("/register", [
  body("username").isLength({ min: 6, max: 25 }).withMessage("Username must be between 6 and 25 characters"), // Adderade validering för användarnamn
  body("email").isEmail().normalizeEmail(), // Validerar att email är i korrekt format och normaliserar det
  body("password").isLength({ min: 10, max: 64 }).withMessage("Password must be between 10 and 64 characters") // Adderade validering för lösenordslängd
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: "Failed to register. Check your user name and password.", errors: errors.array() }) // Förenklade felmeddelandet och inkluderade detaljerad information om valideringsfel i svaret.
  } 

  try {
    const { email, password, username } = req.body

    const existingUser = await User.findOne({
      $or: [{ email: email }, { username: username.trim() }]
    })

    if (existingUser) {
      const field = existingUser.email === email ? "email" : "username"
      return res.status(400).json({
        success: false,
        message: `A user with this ${field} already exists`
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10) 
    const user = new User({ username: username.trim(), email, password: hashedPassword }) 
    await user.save()

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
    res.status(400).json({
      success: false,
      message: "Could not create user",
      error: error,
    })
  } 
}) 

app.post("/login", loginLimiter, [ // Validering av indata för login adderad via Express-validator
  body("login").trim().notEmpty().withMessage("Username or email is required"),
  body("password").notEmpty().withMessage("Password is required")
], async (req, res) => {
  // 1. Kontrollera om valideringen hittade tomma fält
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: errors.array() })
  }

  try {
    const { login, password } = req.body
    const user = await User.findOne({
      $or: [{ username: login }, { email: login }]
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "No account found with that username or email",
        response: null,
      })
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Password is incorrect",
        response: null,
      })
    }

    const accessToken = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } //Sänkte token expiration time till 1 timme för ökad säkerhet
    )

    res.json({
      success: true,
      message: "Logged in successfully",
      response: {
        username: user.username,
        id: user._id,
        accessToken,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error,
    })
  }
})

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id)







app.get("/messages", authenticateUser, async (req, res) => { //Lade till authenticateUser för att säkerställa att endast inloggade användare kan hämta meddelanden.
  try {
    const messages = await Message.find()
      .sort({ createdAt: "desc" })
      .limit(20)
      .populate("user", "username")
      .exec()
    res.json(messages)
  } catch (error) {
    res.status(500).json({ message: "Could not fetch messages" })
  }
})

app.post("/messages", [
  authenticateUser,
  body("message").trim().isLength({ min: 1, max: 500 }).withMessage("Message must be between 1 and 500 characters")
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() })
  }

  try {
    const message = new Message({ message: req.body.message, user: req.user._id })
    const saved = await message.save()
    res.status(201).json(saved)
  } catch (err) {
    res.status(400).json({ message: "Could not save message", errors: err.errors })
  }
})

app.patch("/messages/:id", [
  authenticateUser,
  body("editedMessage").trim().isLength({ min: 1, max: 250 }).withMessage("Edited message must be between 1 and 250 characters") //Adderade validering för det redigerade meddelandet, så att det inte kan vara tomt eller för långt.
], async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: "Invalid message ID" })


  const errors = validationResult(req) // Lade const errors efter ID-kontrollen, så att vi inte gör onödiga databasförfrågningar om ID:t redan är ogiltigt. Det gör också att vi kan returnera mer specifika felmeddelanden till klienten, antingen om ID:t är ogiltigt eller om det finns problem med det redigerade meddelandet.
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() })
  }

  try {
    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ error: "Message not found" })

    if (message.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only edit your own messages" })
    }

    message.message = req.body.editedMessage
    await message.save()
    const updated = await message.populate("user", "username")
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: "Could not update message" })
  }
})

app.delete("/messages/:id", authenticateUser, async (req, res) => { //Lade till authenticateUser för att säkerställa att endast inloggade användare kan radera meddelanden, och att de endast kan radera sina egna meddelanden.
  if (!isValidId(req.params.id)) return res.status(400).json({ error: "Invalid message ID" })
  try {
    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ error: "Message not found" })

    if (message.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" })
    }

    await message.deleteOne()
    res.status(204).send()
  } catch (error) {
    res.status(400).json({ error: "Could not delete message" })
  }
})

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})

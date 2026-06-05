import "dotenv/config"
import helmet from "helmet"
import cors from "cors" //ändra så bara vår frontend kan göra requests, istället för att tillåta alla origins. Det ökar säkerheten genom att begränsa vilka domäner som kan interagera med vår backend.
import express from "express"
import mongoose from "mongoose"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { Message } from "./models/Message.js"
import { User } from "./models/User.js"
import { authenticateUser } from "./middleware/auth.js"
import { loginLimiter } from "./middleware/loginLimiter.js" // Importerade loginLimiter-middleware för att skydda inloggningsendpointen mot brute-force attacker
import "./config/db.js"
import listEndpoints from "express-list-endpoints"
import { body, param, validationResult } from "express-validator" // Importerade express-validator för ökad validering av indata


if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set in .env")

const PORT = process.env.PORT || "3000"
const app = express()
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL, // Endast tillåta requests från vår frontend, istället för att tillåta alla origins. Det ökar säkerheten genom att begränsa vilka domäner som kan interagera med vår backend.
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
  body("login").trim().notEmpty().withMessage("Username or email is required"),
  body("password").notEmpty().withMessage("Password is required")
], async (req, res) => {
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
    console.error(error) //tog bort detaljerad felinformation från svaret för att inte exponera potentiellt känslig information
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    })
  }
})




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
  body("message").trim().isLength({ min: 1, max: 250 }).withMessage("Message must be between 1 and 250 characters")
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
return res.status(400).json({ success: false, error: "Message must be between 1 and 250 characters", errors: errors.array() }) //Adderade mer detaljerad information om valideringsfel i svaret.
  }

  try {
    const message = new Message({ message: req.body.message, user: req.user._id })
    const saved = await message.save()
    res.status(201).json(saved)
  } catch (err) {
    console.error(err) // Loggar det faktiska felet i serverns konsol
        res.status(500).json({ message: "Could not save message" }) //Ändrat till status 500 och dolt err.errors för att förhindra informationsläckage av databasstrukturen (Information Disclosure).

  }
})

app.patch("/messages/:id", [
  authenticateUser,
  param("id").isMongoId().withMessage("Invalid database ID"),
  body("editedMessage").trim().isLength({ min: 1, max: 250 }).withMessage("Edited message must be between 1 and 250 characters")
], async (req, res) => {

  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: "Edited message must be between 1 and 250 characters", errors: errors.array() }) //Adderade mer detaljerad information om valideringsfel i svaret.
  }
  try {
    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ error: "Message not found" })

    if (!message.user || message.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only edit your own messages" })
    }

    message.message = req.body.editedMessage
    await message.save()
    const updated = await message.populate("user", "username")
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: "Could not update message" }) //Ändrat från 400 till 500 för att bättre reflektera att det är ett serverfel, inte ett klientfel.
  }
})

app.delete("/messages/:id", [
  authenticateUser,
  param("id").isMongoId().withMessage("Invalid database ID")
], async (req, res) => {
  
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
return res.status(400).json({ success: false, error: "Invalid database ID", errors: errors.array() })
}
  try {
    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ error: "Message not found" })

    if (!message.user || message.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" })
    }

    await message.deleteOne()
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: "Could not delete message" })
  }
})

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})

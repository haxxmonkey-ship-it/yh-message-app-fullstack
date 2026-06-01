# yh-message-app-fullstack

Sandra testar. Och testar igen, tjohoo.
Christine lägger in en rad.. testing testing

DUBBELKOLLA
Inloggningsformulär tillåter enbart text och har maxantal tecken - DUBBELKOLLA KODEN VIA AI FÖR ATT SE ATT DETTA FINNS PÅ PLATS

Sanitering av all inskickad text via exempelvis ett ORM, Object-Relational Mapper. - DUBBELKOLLA KODEN VIA AI FÖR ATT SE ATT DETTA FINNS PÅ PLATS

- Anv ska ej kunna radera/ändra andras mess ?? 
- Meddelanden ska ej kunna hanteras utan inlogg ?? DUBBELKOLLA KODEN VIA AI FÖR ATT SE OM DETTA FINNS

Salting + Hashing - KOLLA HUR MAN GÖR OCH VAR?

Samtliga händelser loggas, när och varifrån - KOLLA MED AI HUR OCH VAR
---------------------------------
KODNING/AKTIVERING
- Vi ändrar i .env-filen - JWT_SECRET - NEJ!!!!
- Minimikrav för lösenord, 10 tecken, 1 siffra, 1 specialtecken - SERVER.JS - FINNS I JS
- Implementera Session Timeout, 60 min - SERVER.JS - FINNS I JS (rad 28 + 76)
- Begränsa antal försök att logga in (5 försök, sedan paus på 15 min) - SERVER.JS (finns ej)
- Max 3 antal inloggade enheter samtidigt - godkännande via annan enhet vid ny inloggning - SERVER.JS
- Revision av dependencies - NPM AUDIT - kommando - i package.json - Github Dependent Bot (funktion)
- ta bort undantaget för env.example i .gitignore

--------------------------------------------

RAD 168 - SAKNAR AUTHENTICATEUSER - ÄNDRA TILL
import jwt from "jsonwebtoken"
import { User } from "../models/User.js"

export const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "")
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" })
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" })
    }
    req.user = user
    next()
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token" })
  }
}


------------------------------------
BOCKA AV:
- Användaren ska skapa meddelanden
- Anv ska inloggat kunna ta bort och redigera egna mess
------------------------------------
REKOMMENDATIONER:
- Rutiner för patching, revision av dependencies och back-uper.


import rateLimit from "express-rate-limit" // Express-rate-limit används för att begränsa antalet inloggningsförsök från en specifik IP-adress under en viss tidsperiod. Detta hjälper till att skydda mot brute-force attacker där en angripare försöker gissa lösenord genom att göra många inloggningsförsök.

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minuter
    max: 5,
    message: {
        success: false,
        message: "För många inloggningsförsök. Försök igen om 15 minuter."
    }
});
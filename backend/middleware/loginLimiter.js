import rateLimit from "express-rate-limit"

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minuter
    max: 5,
    message: {
        success: false,
        message: "För många inloggningsförsök. Försök igen om 15 minuter."
    }
});
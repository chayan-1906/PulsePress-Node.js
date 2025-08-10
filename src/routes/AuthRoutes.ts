import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {authRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {
    deleteAccountController,
    generateMagicLinkController,
    getUserProfileController,
    loginController,
    loginWithGoogleController,
    redirectToGoogle,
    refreshTokenController,
    registerUserController,
    updateUserController,
    verifyMagicLinkController
} from "../controllers/AuthController";

const router = Router();

router.post('/register', authRateLimiter, registerUserController);                       // /api/v1/auth/register
router.post('/login', authRateLimiter, loginController);                                 // /api/v1/auth/login
router.post('/refresh-token', refreshTokenController);                  // /api/v1/auth/refresh-token
router.get('/google', redirectToGoogle);                                // /api/v1/auth/google
router.get('/oauth2callback', loginWithGoogleController);               // /api/v1/auth/oauth2callback
router.post('/magic-link', authRateLimiter, generateMagicLinkController);               // /api/v1/auth/magic-link
router.get('/verify-magic-link', verifyMagicLinkController);               // /api/v1/auth/verify-magic-link
router.get('/profile', authMiddleware, authRateLimiter, getUserProfileController);       // /api/v1/auth/profile
router.put('/profile', authMiddleware, authRateLimiter, updateUserController);           // /api/v1/auth/profile
router.delete('/profile', authMiddleware, authRateLimiter, deleteAccountController);     // /api/v1/auth/profile

export default router;

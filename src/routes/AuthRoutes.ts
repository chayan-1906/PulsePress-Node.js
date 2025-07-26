import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {
    deleteAccountController,
    getUserProfileController,
    loginController,
    loginWithGoogleController,
    redirectToGoogle,
    refreshTokenController,
    registerUserController,
    updateUserController
} from "../controllers/AuthController";

const router = Router();

router.post('/register', registerUserController);                       // /api/v1/auth/register
router.post('/login', loginController);                                 // /api/v1/auth/login
router.post('/refresh-token', refreshTokenController);                  // /api/v1/auth/refresh-token
router.get('/google', redirectToGoogle);                                // /api/v1/auth/google
router.get('/oauth2callback', loginWithGoogleController);               // /api/v1/auth/oauth2callback
router.get('/profile', authMiddleware, getUserProfileController);       // /api/v1/auth/profile
router.put('/profile', authMiddleware, updateUserController);           // /api/v1/auth/profile
router.delete('/profile', authMiddleware, deleteAccountController);     // /api/v1/auth/profile

export default router;

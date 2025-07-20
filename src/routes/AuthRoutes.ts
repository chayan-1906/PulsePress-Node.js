import {Router} from "express";
import {loginController, loginWithGoogleController, redirectToGoogle, refreshTokenController, registerUserController} from "../controllers/AuthController";

const router = Router();

router.post('/register', registerUserController);               // /api/v1/auth/register
router.post('/login', loginController);                         // /api/v1/auth/login
router.post('/refresh-token', refreshTokenController);          // /api/v1/auth/refresh-token
router.get('/google', redirectToGoogle);                        // /api/v1/auth/google
router.get('/oauth2callback', loginWithGoogleController);       // /api/v1/auth/oauth2callback

export default router;

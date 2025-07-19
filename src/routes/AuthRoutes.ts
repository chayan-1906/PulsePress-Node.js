import {Router} from "express";
import {loginController, refreshTokenController, registerUserController} from "../controllers/AuthController";

const router = Router();

router.post('/register', registerUserController);       // /api/v1/auth/register
router.post('/login', loginController);                 // /api/v1/auth/login
router.post('/refresh-token', refreshTokenController);  // /api/v1/auth/refresh-token

export default router;

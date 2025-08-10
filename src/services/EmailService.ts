import nodemailer from 'nodemailer';
import {EMAIL_PASS, EMAIL_USER, FRONTEND_URL} from "../config/config";

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
});

const sendMagicLink = async (email: string, token: string) => {
    const magicUrl = `${FRONTEND_URL}/api/v1/auth/verify-magic-link?token=${token}`;

    const mailOptions = {
        from: `PulsePress <${EMAIL_USER}>`,
        to: email,
        subject: 'Your Magic Login Link',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Sign in to PulsePress</h2>
                <p>Click the button below to sign in to your account:</p>
                <a href="${magicUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Sign In
                </a>
                <p style="margin-top: 20px;">
                    Or copy this link: <a href="${magicUrl}">${magicUrl}</a>
                </p>
                <p style="color: #666; font-size: 14px;">
                    This link will expire in 15 minutes. If you didn't request this, ignore this email
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
}

export {sendMagicLink};
